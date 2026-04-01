import { readFile } from 'node:fs/promises';
import { Server } from 'node:http';
import { fetch } from 'undici';
import { Topic } from '@cr7/types';

function resolveUrl(server: Server, path: string) {
  const { address, port } = server.address() as { address: string; port: number };
  return `http://${address}:${port}${path}`;
}

export async function uploadImage(
  server: Server,
  token: string,
  filePath: string,
): Promise<Topic.UploadedImage> {
  const data = await readFile(filePath);

  const res = await fetch(resolveUrl(server, '/assets/images'), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'image/jpeg',
    },
    body: data,
  });

  const body = await res.json() as Topic.UploadedImage;
  if (res.ok === false) {
    throw new Error(JSON.stringify(body));
  }

  return body;
}