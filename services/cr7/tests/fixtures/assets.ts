import { readFile } from 'node:fs/promises';
import { Server } from 'node:http';
import { fetch } from 'undici';

function resolveUrl(server: Server, path: string) {
  const { address, port } = server.address() as { address: string; port: number };
  return `http://${address}:${port}${path}`;
}

type UploadedAsset = { url: string };

export async function uploadImage(
  server: Server,
  token: string,
  filePath: string,
): Promise<{ url: string }> {
  const data = await readFile(filePath);

  const res = await fetch(resolveUrl(server, '/assets/images'), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'image/jpeg',
    },
    body: data,
  });

  const body = await res.json() as { url: string };
  if (res.ok === false) {
    throw new Error(JSON.stringify(body));
  }

  return body;
}

export async function uploadVideo(
  server: Server,
  token: string,
  filePath: string,
): Promise<UploadedAsset> {
  const data = await readFile(filePath);

  const res = await fetch(resolveUrl(server, '/assets/videos'), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'video/mp4',
    },
    body: data,
  });

  const body = await res.json() as UploadedAsset;
  if (res.ok === false) {
    throw new Error(JSON.stringify(body));
  }

  return body;
}