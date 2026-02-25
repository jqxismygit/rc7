import http, { Server } from 'node:http';

export function getServerAddress(server: Server) {
  const { address, port } = server.address() as { address: string; port: number };
  return `http://${address}:${port}`;
}

function closeServer(server: Server) {
  return new Promise<void>(
    (resolve, reject) => server.close((err?: Error) => err ? reject(err) : resolve())
  );
}


export async function mockJSONServer(
  mockResponse: (data: { body: unknown }) => unknown
) {
  const server = http.createServer((req, res) => {
    let body = '';
    res.on('data', async (chunk) => {
      body += chunk;
    });
    res.on('end', async () => {
      try {
        const jsonBody = JSON.parse(body);
        const response = await mockResponse({ body: jsonBody });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(response));
      } catch (error) {
        console.error('Error processing request:', error);
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON' }));
      }
    });
  });

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

