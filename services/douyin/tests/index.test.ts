import * as fs from 'node:fs';
import * as http from 'node:http';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createDouyinServer } from '../src/index.ts';

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
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'douyin-test-'));
  const file = path.join(dir, 'douyin-settings.json');
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

async function createFakeDouyinApi(tokens: string[]): Promise<{
  baseUrl: string;
  calls: () => number;
  stop: () => Promise<void>;
}> {
  let index = 0;
  let callCount = 0;

  const server = http.createServer((req, res) => {
    if (req.method === 'POST' && req.url === '/oauth/client_token/') {
      callCount += 1;
      const token = tokens[Math.min(index, tokens.length - 1)] ?? `token-${callCount}`;
      index += 1;

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          data: {
            access_token: token,
            expires_in: 7200,
            error_code: 0,
            description: '',
          },
          message: 'success',
        })
      );
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

describe('douyin token server', () => {
  it('returns health status', async () => {
    const fakeDouyin = await createFakeDouyinApi(['startup-token']);

    const settingsPath = createTempSettingsFile({
      douyin: {
        base_url: fakeDouyin.baseUrl,
        client_key: 'test-client-key',
        client_secret: 'test-client-secret',
      },
      client_token: 'cached-token',
      client_token_expires_at: Date.now() + 60_000,
    });

    const app = createDouyinServer({ settingsPath, port: 0 });
    runningServers.push({ stop: app.stop });
    const port = await app.start();

    const response = await httpGet(`http://127.0.0.1:${port}/health`);
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok' });
  });

  it('returns cached token when not expired and does not call upstream', async () => {
    const fakeDouyin = await createFakeDouyinApi(['new-token']);

    const settingsPath = createTempSettingsFile({
      douyin: {
        base_url: fakeDouyin.baseUrl,
        client_key: 'test-client-key',
        client_secret: 'test-client-secret',
      },
      client_token: 'cached-token',
      client_token_expires_at: Date.now() + 60_000,
    });

    const app = createDouyinServer({ settingsPath, port: 0 });
    runningServers.push({ stop: app.stop });
    const port = await app.start();

    const response = await httpGet(`http://127.0.0.1:${port}/client_token`);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      client_token: 'cached-token',
      source: 'cache',
    });
    expect(fakeDouyin.calls()).toBe(0);
  });

  it('refreshes expired token on startup and writes token back to settings', async () => {
    const fakeDouyin = await createFakeDouyinApi(['refreshed-token']);

    const settingsPath = createTempSettingsFile({
      douyin: {
        base_url: fakeDouyin.baseUrl,
        client_key: 'test-client-key',
        client_secret: 'test-client-secret',
      },
      client_token: 'expired-token',
      client_token_expires_at: Date.now() - 1_000,
    });

    const app = createDouyinServer({ settingsPath, port: 0, refreshOnStartup: true });
    runningServers.push({ stop: app.stop });
    const port = await app.start();

    expect(fakeDouyin.calls()).toBe(1);

    const saved = JSON.parse(fs.readFileSync(settingsPath, 'utf-8')) as {
      client_token: string;
      client_token_expires_at: number;
    };

    expect(saved.client_token).toBe('refreshed-token');
    expect(saved.client_token_expires_at).toBeGreaterThan(Date.now());

    const response = await httpGet(`http://127.0.0.1:${port}/client_token`);
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      client_token: 'refreshed-token',
      source: 'cache',
    });
    expect(fakeDouyin.calls()).toBe(1);
  });

  it('refreshes token on demand when no cached token exists', async () => {
    const fakeDouyin = await createFakeDouyinApi(['on-demand-token']);

    const settingsPath = createTempSettingsFile({
      douyin: {
        base_url: fakeDouyin.baseUrl,
        client_key: 'test-client-key',
        client_secret: 'test-client-secret',
      },
    });

    const app = createDouyinServer({ settingsPath, port: 0, refreshOnStartup: false });
    runningServers.push({ stop: app.stop });
    const port = await app.start();

    expect(fakeDouyin.calls()).toBe(0);

    const response = await httpGet(`http://127.0.0.1:${port}/client_token`);
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      client_token: 'on-demand-token',
      source: 'refresh',
    });
    expect(fakeDouyin.calls()).toBe(1);
  });

  it('returns 502 when upstream returns error_code', async () => {
    const server = http.createServer((req, res) => {
      if (req.method === 'POST' && req.url === '/oauth/client_token/') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            data: {
              access_token: '',
              expires_in: 0,
              error_code: 10003,
              description: 'client_key does not exist',
            },
            message: 'error',
          })
        );
        return;
      }
      res.writeHead(404);
      res.end();
    });

    const errorServerPort = await new Promise<number>((resolve) => {
      server.listen(0, () => {
        const address = server.address();
        if (typeof address === 'object' && address?.port) {
          resolve(address.port);
          return;
        }
        resolve(0);
      });
    });
    runningServers.push({
      stop: () =>
        new Promise<void>((resolve, reject) =>
          server.close((err) => (err ? reject(err) : resolve()))
        ),
    });

    const settingsPath = createTempSettingsFile({
      douyin: {
        base_url: `http://127.0.0.1:${errorServerPort}`,
        client_key: 'bad-key',
        client_secret: 'bad-secret',
      },
    });

    const app = createDouyinServer({ settingsPath, port: 0, refreshOnStartup: false });
    runningServers.push({ stop: app.stop });
    const port = await app.start();

    const response = await httpGet(`http://127.0.0.1:${port}/client_token`);
    expect(response.status).toBe(502);
    expect(response.body).toMatchObject({
      error_code: 10003,
      description: 'client_key does not exist',
    });
  });
});
