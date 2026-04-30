import * as fs from 'node:fs';
import * as http from 'node:http';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

interface DouyinConfig {
  base_url: string;
  client_key: string;
  client_secret: string;
}

interface DouyinSettings {
  douyin: DouyinConfig;
  client_token?: string;
  client_token_expires_at?: number;
}

interface DouyinTokenData {
  access_token: string;
  expires_in: number;
  error_code: number;
  description: string;
}

interface DouyinTokenResponse {
  data: DouyinTokenData;
  message: string;
}

interface ClientTokenResult {
  client_token: string;
  expires_at: number;
  source: 'cache' | 'refresh';
}

export class DouyinError extends Error {
  error_code: number;
  description: string;

  constructor(error_code: number, description: string) {
    super(`Douyin API Error ${error_code}: ${description}`);
    this.error_code = error_code;
    this.description = description;
  }
}

async function postJSON<T>(url: string, body: Record<string, string>): Promise<T> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const text = await response.text();

  if (!response.ok) {
    throw new Error(`Upstream HTTP ${response.status}: ${text}`);
  }

  try {
    return JSON.parse(text) as T;
  } catch (error) {
    throw new Error(
      `Invalid JSON response from upstream: ${(error as Error).message}`
    );
  }
}

export class SettingsManager {
  private readonly filePath: string;
  private settings: DouyinSettings;

  constructor(settingsPath: string) {
    this.filePath = settingsPath;
    this.settings = this.loadSettings();
  }

  getFilePath(): string {
    return this.filePath;
  }

  private loadSettings(): DouyinSettings {
    if (!fs.existsSync(this.filePath)) {
      throw new Error(`Settings file not found: ${this.filePath}`);
    }

    const content = fs.readFileSync(this.filePath, 'utf-8');
    const parsed = JSON.parse(content) as DouyinSettings;

    if (
      !parsed.douyin ||
      !parsed.douyin.base_url ||
      !parsed.douyin.client_key ||
      !parsed.douyin.client_secret
    ) {
      throw new Error(
        'Invalid settings file: missing douyin.base_url/client_key/client_secret'
      );
    }

    return parsed;
  }

  private saveSettings(): void {
    fs.writeFileSync(this.filePath, JSON.stringify(this.settings, null, 2), 'utf-8');
  }

  getConfig(): DouyinConfig {
    return this.settings.douyin;
  }

  getCachedToken(): { token: string; expiresAt: number } | null {
    if (!this.settings.client_token || !this.settings.client_token_expires_at) {
      return null;
    }

    return {
      token: this.settings.client_token,
      expiresAt: this.settings.client_token_expires_at,
    };
  }

  setClientToken(token: string, expiresInSeconds: number): { expiresAt: number } {
    const expiresAt = Date.now() + expiresInSeconds * 1000;
    this.settings.client_token = token;
    this.settings.client_token_expires_at = expiresAt;
    this.saveSettings();
    return { expiresAt };
  }
}

export class DouyinTokenService {
  private readonly settingsManager: SettingsManager;

  constructor(settingsManager: SettingsManager) {
    this.settingsManager = settingsManager;
  }

  private isExpired(expiresAt: number): boolean {
    return Date.now() >= expiresAt;
  }

  private async refreshClientToken(): Promise<ClientTokenResult> {
    const { base_url, client_key, client_secret } = this.settingsManager.getConfig();
    const url = `${base_url}/oauth/client_token/`;

    const res = await postJSON<DouyinTokenResponse>(url, {
      client_key,
      client_secret,
      grant_type: 'client_credential',
    });

    if (res.data.error_code !== 0) {
      throw new DouyinError(res.data.error_code, res.data.description);
    }

    const saved = this.settingsManager.setClientToken(
      res.data.access_token,
      res.data.expires_in
    );

    return {
      client_token: res.data.access_token,
      expires_at: saved.expiresAt,
      source: 'refresh',
    };
  }

  async getClientToken(): Promise<ClientTokenResult> {
    const cached = this.settingsManager.getCachedToken();
    if (cached && !this.isExpired(cached.expiresAt)) {
      return {
        client_token: cached.token,
        expires_at: cached.expiresAt,
        source: 'cache',
      };
    }

    return this.refreshClientToken();
  }

  async ensureFreshTokenOnStartup(): Promise<void> {
    const cached = this.settingsManager.getCachedToken();
    if (!cached || this.isExpired(cached.expiresAt)) {
      await this.refreshClientToken();
    }
  }
}

function writeJSON(res: http.ServerResponse, statusCode: number, payload: unknown): void {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(payload));
}

function handleError(error: unknown, res: http.ServerResponse): void {
  if (error instanceof DouyinError) {
    writeJSON(res, 502, {
      error_code: error.error_code,
      description: error.description,
    });
    return;
  }

  writeJSON(res, 500, {
    error: error instanceof Error ? error.message : 'Internal server error',
  });
}

export interface CreateDouyinServerOptions {
  settingsPath: string;
  port: number;
  refreshOnStartup?: boolean;
}

export function createDouyinServer(options: CreateDouyinServerOptions): {
  server: http.Server;
  start: () => Promise<number>;
  stop: () => Promise<void>;
  tokenService: DouyinTokenService;
  settingsManager: SettingsManager;
} {
  const settingsManager = new SettingsManager(options.settingsPath);
  const tokenService = new DouyinTokenService(settingsManager);

  const server = http.createServer(async (req, res) => {
    try {
      if (req.method === 'GET' && req.url === '/health') {
        writeJSON(res, 200, { status: 'ok' });
        return;
      }

      if (req.method === 'GET' && req.url === '/client_token') {
        const token = await tokenService.getClientToken();
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
  const port = Number.parseInt(process.env.DOUYIN_PORT || '3001', 10);
  const settingsPath =
    process.env.DOUYIN_SETTINGS_PATH || `${process.cwd()}/douyin-settings.json`;

  const app = createDouyinServer({
    settingsPath,
    port,
    refreshOnStartup: true,
  });

  const listenPort = await app.start();
  console.log(`Douyin token service listening on port ${listenPort}`);
  console.log(`Settings file: ${app.settingsManager.getFilePath()}`);
}

const entryFilePath = process.argv[1];
const thisFilePath = fileURLToPath(import.meta.url);

if (entryFilePath === thisFilePath) {
  bootstrap().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}
