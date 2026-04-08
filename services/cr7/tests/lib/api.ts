import { URL } from 'node:url';
import { Server } from 'node:http';
import Stream from 'node:stream';
import { fetch, Response, RequestInit, HeadersInit } from 'undici';
import qs from 'qs';
import { expect } from 'vitest';

function resolveUrl(server: Server, path: string) {
  const { address, port } = server.address() as { address: string; port: number };
  const url = new URL(path, `http://${address}:${port}`);
  return url.toString();
};

export class APIError extends Error {
  status: number;
  url: string;
  method: string;
  body: unknown;

  constructor(status: number, url: string, method: string, body: unknown) {
    const data = typeof body === 'string' ? body : JSON.stringify(body);
    const message = `${status} - ${method} ${url} - ${data}`;
    super(message);
    this.status = status;
    this.url = url;
    this.method = method;
    this.body = body;
  }
}

export function assertAPIError(
  error: unknown,
  options: {
    status?: number;
    messageIncludes?: string;
    method?: string;
  } = {}
): APIError {
  expect(error).toBeInstanceOf(APIError);
  const apiError = error as APIError;

  if (options.status !== undefined) {
    expect(apiError.status).toBe(options.status);
  }

  if (options.method !== undefined) {
    expect(apiError.method).toBe(options.method);
  }

  if (options.messageIncludes !== undefined) {
    expect(apiError.message).toContain(options.messageIncludes);
  }

  return apiError;
}

function getHeaders(
  options: {
    headers?: HeadersInit; token?: string
  }
): HeadersInit {
  return Object.assign(
    { ...options.headers },
    { 'content-type': 'application/json' },
    options.token ? { 'Authorization': `Bearer ${options.token}` } : {},
  ) as HeadersInit;
}

async function handlerBody<Result>(res: Response): Promise<Result | string | null> {
  if (res.status === 204) {
    return null;
  }

  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json') === false) {
    return res.text();
  }

  const body = await res.json();
  return body as Result;
}

export async function getJSON<Result>(
  server: Server, path: string,
  options: Omit<RequestInit, 'method' | 'body'> & {
    query?: Record<string, unknown>; token?: string
  } = {}
): Promise<Result> {
  const { query, token, ...rest } = options;
  if (query) {
    const queryString = qs.stringify(query);
    path += (path.includes('?') ? '&' : '?') + queryString;
  }
  const url = resolveUrl(server, path);
  const res = await fetch(url, {
    ...rest,
    method: 'GET',
    headers: getHeaders({ ...rest, token }),
  });

  const body = await handlerBody<Result>(res);

  if (res.ok === false) {
    throw new APIError(res.status, path, 'GET', body);
  }

  return body as Result;
}

export async function postJSON<Result>(
  server: Server, path: string,
  options: Omit<RequestInit, 'method' | 'body'> & { token?: string; body?: unknown } = {}
): Promise<Result> {
  const url = resolveUrl(server, path);
  const { token, body: _body, ...rest } = options;

  const res = await fetch(url, {
    ...rest,
    method: 'POST',
    headers: getHeaders({ ...rest, token }),
    body: _body ? JSON.stringify(_body) : undefined
  });

  const body = await handlerBody<Result>(res);

  if (res.ok === false) {
    throw new APIError(res.status, path, 'POST', body);
  }

  return body as Result;
}

export async function putJSON<Result>(
  server: Server, path: string,
  options: Omit<RequestInit, 'method' | 'body'> & { token?: string; body?: unknown } = {}
): Promise<Result> {
  const url = resolveUrl(server, path);
  const { token, body: _body, ...rest } = options;

  const res = await fetch(url, {
    ...rest,
    method: 'PUT',
    headers: getHeaders({ ...rest, token }),
    body: _body ? JSON.stringify(_body) : undefined
  });

  const body = await handlerBody<Result>(res);
  if (res.ok === false) {
    throw new APIError(res.status, path, 'PUT', body);
  }

  return body as Result;
}

export async function deleteJSON<Result>(
  server: Server, path: string,
  options: Omit<RequestInit, 'method' | 'body'> & { token?: string; } = {}
): Promise<Result> {
  const url = resolveUrl(server, path);
  const { token, ...rest } = options;
  const res = await fetch(url, {
    ...rest,
    method: 'DELETE',
    headers: getHeaders({ ...rest, token }),
  });

  const body = await handlerBody<Result>(res);
  if (res.ok === false) {
    throw new APIError(res.status, path, 'DELETE', body);
  }

  return body as Result;
}

export async function patchJSON<Result>(
  server: Server, path: string,
  options: Omit<RequestInit, 'method' | 'body'> & { token?: string; body?: unknown } = {}
): Promise<Result> {
  const url = resolveUrl(server, path);
  const { token, body: _body, ...rest } = options;

  const res = await fetch(url, {
    ...rest,
    method: 'PATCH',
    headers: getHeaders({ ...rest, token }),
    body: _body ? JSON.stringify(_body) : undefined,
  });

  const body = await handlerBody<Result>(res);
  if (res.ok === false) {
    throw new APIError(res.status, path, 'PATCH', body);
  }

  return body as Result;
}

async function postStream(
  server: Server, path: string,
  options: Omit<RequestInit, 'method' | 'body'> & {
    token?: string;
    body: Stream.Readable;
  }
) {
  const { token, ...rest } = options;
  const header = getHeaders({ ...rest, token });

  const url = resolveUrl(server, path);
  const res = await fetch(url, {
    ...rest,
    method: 'POST',
    headers: header,
    duplex: 'half',
  });

  if (res.ok === false) {
    const body = await handlerBody(res);
    throw new APIError(res.status, path, 'POST', body);
  }

  return res;
}

export async function postStreamJSON(
  server: Server, path: string,
  options: Omit<RequestInit, 'method' | 'body'> & {
    token?: string; body: Stream.Readable
  }
) {
  const res = await postStream(server, path, options);
  const body = await handlerBody(res);

  return body;
}
