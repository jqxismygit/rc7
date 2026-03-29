import { readFile } from 'node:fs/promises';
import { Server } from 'node:http';
import { fetch } from 'undici';
import { expect } from 'vitest';
import { Topic } from '@cr7/types';
import { deleteJSON, getJSON, patchJSON, postJSON } from '../lib/api.js';

export type DraftTopic = Topic.TopicDraft;
export type DraftArticle = Omit<Topic.ArticleDraft, 'topic_id'>;

export async function createTopic(
  server: Server,
  token: string,
  draft: DraftTopic,
) {
  return postJSON<Topic.Topic>(server, '/topics', { token, body: draft });
}

export async function updateTopic(
  server: Server,
  token: string,
  tid: string,
  patch: Topic.TopicPatch,
) {
  return patchJSON<Topic.Topic>(server, `/topics/${tid}`, { token, body: patch });
}

export async function deleteTopic(
  server: Server,
  token: string,
  tid: string,
) {
  return deleteJSON<null>(server, `/topics/${tid}`, { token });
}

export async function createArticle(
  server: Server,
  token: string,
  tid: string,
  draft: DraftArticle,
) {
  return postJSON<Topic.Article>(server, `/topics/${tid}/articles`, {
    token,
    body: draft,
  });
}

export async function updateArticle(
  server: Server,
  token: string,
  aid: string,
  patch: Topic.ArticlePatch,
) {
  return patchJSON<Topic.Article>(server, `/articles/${aid}`, {
    token,
    body: patch,
  });
}

export async function deleteArticle(
  server: Server,
  token: string,
  aid: string,
) {
  return deleteJSON<null>(server, `/articles/${aid}`, { token });
}

export async function getArticle(
  server: Server,
  aid: string,
  token?: string,
) {
  return getJSON<Topic.ArticleWithTopic>(server, `/articles/${aid}`, { token });
}

export async function listTopics(
  server: Server,
  page?: number,
  limit?: number,
  token?: string,
) {
  return getJSON<Topic.TopicListResult>(server, '/topics', {
    token,
    query: {
      page,
      limit,
    },
  });
}

export async function getTopic(
  server: Server,
  tid: string,
  token?: string,
) {
  return getJSON<Topic.TopicWithArticles>(server, `/topics/${tid}`, { token });
}

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

export function assertTopic(topic: Topic.Topic) {
  expect(topic.id).toEqual(expect.any(String));
  expect(topic.title).toEqual(expect.any(String));
  expect(topic.created_at).toEqual(expect.any(String));
  expect(topic.updated_at).toEqual(expect.any(String));
}

export function assertArticle(article: Topic.Article) {
  expect(article.id).toEqual(expect.any(String));
  expect(article.topic_id).toEqual(expect.any(String));
  expect(article.title).toEqual(expect.any(String));
  expect(article.content).toEqual(expect.any(String));
  expect(article.created_at).toEqual(expect.any(String));
  expect(article.updated_at).toEqual(expect.any(String));
}
