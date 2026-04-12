import * as fs from 'node:fs';
import * as http from 'node:http';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

interface WechatConfig {
  base_url: string;
  appid: string;
  secret: string;
}

interface WechatSettings {
  wechat: WechatConfig;
  access_token?: string;
  access_token_expires_at?: number;
}

interface WechatErrorResponse {
  errcode: number;
  errmsg: string;
}

interface AccessTokenSuccess {
  access_token: string;
  expires_in: number;
}

interface AccessTokenResult {
  access_token: string;
  expires_at: number;
  source: 'cache' | 'refresh';
}

type AccessTokenResponse = AccessTokenSuccess | WechatErrorResponse;

export class WechatError extends Error {
  errcode: number;
  errmsg: string;

  constructor(response: WechatErrorResponse) {
    const { errcode, errmsg } = response;
    super(`Wechat API Error ${errcode}: ${errmsg}`);
    this.errcode = errcode;
    this.errmsg = errmsg;
  }
}

function isWechatErrorResponse(data: unknown): data is WechatErrorResponse {
  return (
    typeof data === 'object' &&
    data !== null &&
    'errcode' in data &&
    typeof (data as { errcode: unknown }).errcode === 'number' &&
    'errmsg' in data &&
    typeof (data as { errmsg: unknown }).errmsg === 'string'
  );
}

async function requestJSON<T>(url: string): Promise<T> {
  const response = await fetch(url, { method: 'GET' });
  const body = await response.text();

  if (!response.ok) {
    throw new Error(`Upstream HTTP ${response.status}: ${body}`);
  }

  try {
    return JSON.parse(body) as T;
  } catch (error) {
    throw new Error(
      `Invalid JSON response from upstream: ${(error as Error).message}`
    );
  }
}

export class SettingsManager {
  private readonly filePath: string;
  private settings: WechatSettings;

  constructor(settingsPath: string) {
    this.filePath = settingsPath;
    this.settings = this.loadSettings();
  }

  getFilePath(): string {
    return this.filePath;
  }

  private loadSettings(): WechatSettings {
    if (!fs.existsSync(this.filePath)) {
      throw new Error(`Settings file not found: ${this.filePath}`);
    }

    const content = fs.readFileSync(this.filePath, 'utf-8');
    const parsed = JSON.parse(content) as WechatSettings;

    if (
      !parsed.wechat ||
      !parsed.wechat.base_url ||
      !parsed.wechat.appid ||
      !parsed.wechat.secret
    ) {
      throw new Error('Invalid settings file: missing wechat.base_url/appid/secret');
    }

    return parsed;
  }

  private saveSettings(): void {
    fs.writeFileSync(this.filePath, JSON.stringify(this.settings, null, 2), 'utf-8');
  }

  getConfig(): WechatConfig {
    return this.settings.wechat;
  }

  getCachedToken(): { token: string; expiresAt: number } | null {
    if (!this.settings.access_token || !this.settings.access_token_expires_at) {
      return null;
    }

    return {
      token: this.settings.access_token,
      expiresAt: this.settings.access_token_expires_at,
    };
  }

  setAccessToken(token: string, expiresInSeconds: number): { expiresAt: number } {
    const expiresAt = Date.now() + expiresInSeconds * 1000;
    this.settings.access_token = token;
    this.settings.access_token_expires_at = expiresAt;
    this.saveSettings();
    return { expiresAt };
  }
}

export class WechatTokenService {
  private readonly settingsManager: SettingsManager;

  constructor(settingsManager: SettingsManager) {
    this.settingsManager = settingsManager;
  }

  private isExpired(expiresAt: number): boolean {
    return Date.now() >= expiresAt;
  }

  private async refreshAccessToken(): Promise<AccessTokenResult> {
    const { base_url, appid, secret } = this.settingsManager.getConfig();
    const url = new URL(`${base_url}/cgi-bin/token`);
    url.searchParams.set('appid', appid);
    url.searchParams.set('secret', secret);
    url.searchParams.set('grant_type', 'client_credential');

    const res = await requestJSON<AccessTokenResponse>(url.toString());
    if (isWechatErrorResponse(res)) {
      throw new WechatError(res);
    }

    const saved = this.settingsManager.setAccessToken(res.access_token, res.expires_in);
    return {
      access_token: res.access_token,
      expires_at: saved.expiresAt,
      source: 'refresh',
    };
  }

  async getAccessToken(): Promise<AccessTokenResult> {
    const cached = this.settingsManager.getCachedToken();
    if (cached && !this.isExpired(cached.expiresAt)) {
      return {
        access_token: cached.token,
        expires_at: cached.expiresAt,
        source: 'cache',
      };
    }

    return this.refreshAccessToken();
  }

  async ensureFreshTokenOnStartup(): Promise<void> {
    const cached = this.settingsManager.getCachedToken();
    if (!cached || this.isExpired(cached.expiresAt)) {
      await this.refreshAccessToken();
    }
  }
}

function writeJSON(res: http.ServerResponse, statusCode: number, payload: unknown): void {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(payload));
}

function handleError(error: unknown, res: http.ServerResponse): void {
  if (error instanceof WechatError) {
    writeJSON(res, 502, { errcode: error.errcode, errmsg: error.errmsg });
    return;
  }

  writeJSON(res, 500, {
    error: error instanceof Error ? error.message : 'Internal server error',
  });
}

export interface CreateWechatServerOptions {
  settingsPath: string;
  port: number;
  refreshOnStartup?: boolean;
}

export function createWechatServer(options: CreateWechatServerOptions): {
  server: http.Server;
  start: () => Promise<number>;
  stop: () => Promise<void>;
  tokenService: WechatTokenService;
  settingsManager: SettingsManager;
} {
  const settingsManager = new SettingsManager(options.settingsPath);
  const tokenService = new WechatTokenService(settingsManager);

  const server = http.createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    try {
      if (req.method === 'GET' && req.url === '/health') {
        writeJSON(res, 200, { status: 'ok' });
        return;
      }

      if (req.method === 'GET' && req.url === '/access_token') {
        const token = await tokenService.getAccessToken();
        writeJSON(res, 200, token);
        return;
      }

      writeJSON(res, 404, { error: 'Not found' });
    } catch (error) {
      handleError(error, res);
    }
  });

  return {
    server,
    tokenService,
    settingsManager,
    start: async () => {
      if (options.refreshOnStartup !== false) {
        await tokenService.ensureFreshTokenOnStartup();
      }

      return new Promise<number>((resolve) => {
        server.listen(options.port, () => {
          const address = server.address();
          if (typeof address === 'object' && address?.port) {
            resolve(address.port);
          } else {
            resolve(options.port);
          }
        });
      });
    },
    stop: async () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      }),
  };
}

async function bootstrap(): Promise<void> {
  const port = Number.parseInt(process.env.WECHAT_PORT || '3000', 10);
  const settingsPath = process.env.WECHAT_SETTINGS_PATH || `${process.cwd()}/wechat-settings.json`;

  const app = createWechatServer({
    settingsPath,
    port,
    refreshOnStartup: true,
  });

  const listenPort = await app.start();
  console.log(`WeChat token service listening on port ${listenPort}`);
  console.log(`Settings file: ${app.settingsManager.getFilePath()}`);
}

const entryFilePath = process.argv[1];
const thisFilePath = fileURLToPath(import.meta.url);

if (entryFilePath && entryFilePath === thisFilePath) {
  bootstrap().catch((error) => {
    console.error('Failed to start WeChat token service:', error);
    process.exit(1);
  });
}
