import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { pipeline } from 'node:stream/promises';
import Moleculer, { Context, ServiceSchema } from 'moleculer';
import sharp from 'sharp';
import { RC7BaseService } from './cr7.base.js';

const { MoleculerClientError } = Moleculer.Errors;

async function getAssetsConfig() {
  const { default: config } = await import('config');
  return config.assets;
}

async function saveUploadAsWebp(
  fileStream: NodeJS.ReadableStream,
  dataDir: string,
  baseUrl: string,
): Promise<{ url: string }> {
  const name = `${randomUUID()}.webp`;
  const target = path.join(dataDir, name);

  try {
    await pipeline(fileStream, sharp().webp(), fs.createWriteStream(target));
  } catch {
    throw new MoleculerClientError('文件格式不支持', 400, 'IMAGE_INVALID_TYPE');
  }

  return {
    url: new URL(name, `${baseUrl.replace(/\/?$/, '/')}`).toString(),
  };
}

async function saveUploadAsOriginal(
  fileStream: NodeJS.ReadableStream,
  dataDir: string,
  baseUrl: string,
  ext: string,
): Promise<{ url: string }> {
  const name = `${randomUUID()}${ext}`;
  const target = path.join(dataDir, name);

  try {
    await pipeline(fileStream, fs.createWriteStream(target));
  } catch {
    throw new MoleculerClientError('文件格式不支持', 400, 'VIDEO_INVALID_TYPE');
  }

  return {
    url: new URL(name, `${baseUrl.replace(/\/?$/, '/')}`).toString(),
  };
}

function resolveVideoExt(contentType?: string | string[]) {
  const value = Array.isArray(contentType) ? contentType[0] : contentType;
  const normalized = value?.split(';')[0]?.trim().toLowerCase();
  if (normalized === 'video/mp4') {
    return '.mp4';
  }

  throw new MoleculerClientError('文件格式不支持', 400, 'VIDEO_INVALID_TYPE');
}

export class AssetsService extends RC7BaseService {
  actions_assets: ServiceSchema['actions'] = {
    'assets.uploadImage': {
      rest: 'POST /images',
      roles: ['admin'],
      handler: this.uploadImage,
    },
    'assets.uploadVideo': {
      rest: 'POST /videos',
      roles: ['admin'],
      handler: this.uploadVideo,
    },
  };

  async ensureAssetsDir() {
    const assetsConfig = await getAssetsConfig();
    await fs.promises.mkdir(assetsConfig.path, { recursive: true });
  }

  async uploadImage(
    ctx: Context<
      NodeJS.ReadableStream & { headers?: Record<string, string | string[] | undefined> },
      { $statusCode?: number }
    >,
  ) {
    const { path: dataDir, base_url } = await getAssetsConfig();
    const result = await saveUploadAsWebp(ctx.params, dataDir, base_url);
    ctx.meta.$statusCode = 201;
    return result;
  }

  async uploadVideo(
    ctx: Context<
      NodeJS.ReadableStream & { headers?: Record<string, string | string[] | undefined> },
      { $statusCode?: number }
    >,
  ) {
    const { path: dataDir, base_url } = await getAssetsConfig();
    const ext = resolveVideoExt(ctx.params.headers?.['content-type']);
    const result = await saveUploadAsOriginal(ctx.params, dataDir, base_url, ext);
    ctx.meta.$statusCode = 201;
    return result;
  }
}