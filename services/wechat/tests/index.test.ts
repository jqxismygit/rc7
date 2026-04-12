import * as fs from 'node:fs';
import * as http from 'node:http';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createWechatServer } from '../src/index.ts';

interface RunningServer {
  stop: () => Promise<void>;
}

const runningServers: RunningServer[] = [];

afterEach(async () => {
  while (runningServers.length > 0) {
    const server = runningServers.pop();
    if (server) {
      await server.stop();
    }
  }
});

function createTempSettingsFile(content: Record<string, unknown>): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wechat-test-'));
  const file = path.join(dir, 'wechat-settings.json');
  fs.writeFileSync(file, JSON.stringify(content, null, 2), 'utf-8');
  return file;
}

async function httpGet(url: string): Promise<{ status: number; body: unknown }> {
  const response = await fetch(url, { method: 'GET' });
  const text = await response.text();
  return {
    status: response.status,
    body: JSON.parse(text),
  };
}

async function createFakeWechatApi(tokens: string[]): Promise<{ baseUrl: string; calls: () => number; stop: () => Promise<void> }> {
  let index = 0;
  let callCount = 0;

  const server = http.createServer((req, res) => {
    if (req.url?.startsWith('/cgi-bin/token')) {
      callCount += 1;
      const token = tokens[Math.min(index, tokens.length - 1)] || `token-${callCount}`;
      index += 1;

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ access_token: token, expires_in: 7200 }));
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'not found' }));
  });

  const port = await new Promise<number>((resolve) => {
    server.listen(0, () => {
      const address = server.address();
      if (typeof address === 'object' && address?.port) {
        resolve(address.port);
        return;
      }
      resolve(0);
    });
  });

  const stop = async (): Promise<void> =>
    new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });

  runningServers.push({ stop });

  return {
    baseUrl: `http://127.0.0.1:${port}`,
    calls: () => callCount,
    stop,
  };
}

describe('wechat token server', () => {
  it('returns health status', async () => {
    const fakeWechat = await createFakeWechatApi(['startup-token']);

    const settingsPath = createTempSettingsFile({
      wechat: {
        base_url: fakeWechat.baseUrl,
        appid: 'appid',
        secret: 'secret',
      },
      access_token: 'cached-token',
      access_token_expires_at: Date.now() + 60_000,
    });

    const app = createWechatServer({ settingsPath, port: 0 });
    runningServers.push({ stop: app.stop });
    const port = await app.start();

    const response = await httpGet(`http://127.0.0.1:${port}/health`);
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok' });
  });

  it('returns cached token when not expired and does not call upstream', async () => {
    const fakeWechat = await createFakeWechatApi(['new-token']);

    const settingsPath = createTempSettingsFile({
      wechat: {
        base_url: fakeWechat.baseUrl,
        appid: 'appid',
        secret: 'secret',
      },
      access_token: 'cached-token',
      access_token_expires_at: Date.now() + 60_000,
    });

    const app = createWechatServer({ settingsPath, port: 0 });
    runningServers.push({ stop: app.stop });
    const port = await app.start();

    const response = await httpGet(`http://127.0.0.1:${port}/access_token`);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      access_token: 'cached-token',
      source: 'cache',
    });
    expect(fakeWechat.calls()).toBe(0);
  });

  it('refreshes expired token on startup and writes token back to settings', async () => {
    const fakeWechat = await createFakeWechatApi(['refreshed-token']);

    const settingsPath = createTempSettingsFile({
      wechat: {
        base_url: fakeWechat.baseUrl,
        appid: 'appid',
        secret: 'secret',
      },
      access_token: 'expired-token',
      access_token_expires_at: Date.now() - 1_000,
    });

    const app = createWechatServer({ settingsPath, port: 0, refreshOnStartup: true });
    runningServers.push({ stop: app.stop });
    const port = await app.start();

    expect(fakeWechat.calls()).toBe(1);

    const saved = JSON.parse(fs.readFileSync(settingsPath, 'utf-8')) as {
      access_token: string;
      access_token_expires_at: number;
    };

    expect(saved.access_token).toBe('refreshed-token');
    expect(saved.access_token_expires_at).toBeGreaterThan(Date.now());

    const response = await httpGet(`http://127.0.0.1:${port}/access_token`);
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      access_token: 'refreshed-token',
      source: 'cache',
    });
    expect(fakeWechat.calls()).toBe(1);
  });

  it('refreshes token on demand when no cached token exists', async () => {
    const fakeWechat = await createFakeWechatApi(['on-demand-token']);

    const settingsPath = createTempSettingsFile({
      wechat: {
        base_url: fakeWechat.baseUrl,
        appid: 'appid',
        secret: 'secret',
      },
    });

    const app = createWechatServer({ settingsPath, port: 0, refreshOnStartup: false });
    runningServers.push({ stop: app.stop });
    const port = await app.start();

    expect(fakeWechat.calls()).toBe(0);

    const response = await httpGet(`http://127.0.0.1:${port}/access_token`);
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      access_token: 'on-demand-token',
      source: 'refresh',
    });
    expect(fakeWechat.calls()).toBe(1);
  });
});
