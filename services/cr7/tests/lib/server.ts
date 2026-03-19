import http, { Server } from 'node:http';

export function getServerAddress(server: Server) {
  const { address, port } = server.address() as { address: string; port: number };
  // 处理 IPv6 地址
  const host = address === '::' ? 'localhost' : address;
  return `http://${host}:${port}`;
}

function closeServer(server: Server) {
  return new Promise<void>(
    (resolve, reject) => server.close((err?: Error) => err ? reject(err) : resolve())
  );
}

export interface MockServer {
  server: Server;
  address: string;
  close: () => Promise<void>;
}

export async function mockServer(
  requestHandler: (req: http.IncomingMessage, res: http.ServerResponse) => void
): Promise<MockServer> {
  const server = http.createServer(requestHandler);

  await new Promise((resolve, reject) => {
    server.listen(0, (error?: Error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(null);
    });
  });

  return {
    server,
    close() {
      return closeServer(server)
    },
    address: getServerAddress(server)
  }
}

export async function mockJSONServer(
  mockResponse: (data: {
    body: unknown; query: Record<string, string>
  }) => unknown
): Promise<MockServer> {
  return mockServer((req, res) => {
    let body_data = '';
    req.on('data', (chunk) => {
      body_data += chunk;
    });
    req.on('end', async () => {
      const url = new URL(req.url ?? '', `http://${req.headers.host}`);
      const query = Array.from(url.searchParams.entries()).reduce(
        (acc, [key, value]) => Object.assign(acc, { [key]: value }),
        {}
      );

      try {
        const jsonBody = body_data ? JSON.parse(body_data) : null;
        const response = await mockResponse({ body: jsonBody, query });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(response));
      } catch (error) {
        console.error('Error processing request:', error);
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON' }));
      }
    });
  });
}

export async function mockWechatServer(
  mockCode2SessionResponse: (data: {
    body: unknown; query: Record<string, string>
  }) => unknown
): Promise<MockServer> {
  return mockServer((req, res) => {
    let body_data = '';
    req.on('data', (chunk) => {
      body_data += chunk;
    });
    req.on('end', async () => {
      const url = new URL(req.url ?? '', `http://${req.headers.host}`);
      const query = Array.from(url.searchParams.entries()).reduce(
        (acc, [key, value]) => Object.assign(acc, { [key]: value }),
        {}
      );

      try {
        const jsonBody = body_data ? JSON.parse(body_data) : null;
        const response = await mockCode2SessionResponse({ body: jsonBody, query });
        res.writeHead(200, { 'content-type': 'text/plain' });
        const resBody = typeof response === 'string'
          ? response
          : JSON.stringify(response);

        res.end(resBody);
      } catch (error) {
        console.error('Error processing wechat mock server request:', error);
        res.writeHead(400, { 'content-type': 'text/plain' });
        res.end(JSON.stringify({ error: 'Invalid JSON' }));
      }
    });
  });
}