import { createHash, timingSafeEqual } from 'node:crypto';
import { fetch, HeadersInit, RequestInit, Response } from 'undici';

interface DamaiSignatureOptions {
	apiKey: string;
	sign?: string;
	apiPw?: string;
	apiSecret?: string;
	msgId?: string;
	timestamp?: string;
	version?: string;
}

interface DamaiPostJSONOptions extends Omit<RequestInit, 'method' | 'body'> {
	body?: Record<string, unknown>;
	sign: string;
	timestamp?: string;
}

interface ResponseHead {
	code: string;
	desc: string;
}


class DamaiAPIError extends Error {
	status: number;
	url: string;
	method: string;
	body: unknown;

	constructor(status: number, url: string, method: string, body: unknown) {
		const data = typeof body === 'string' ? body : JSON.stringify(body);
		super(`${status} - ${method} ${url} - ${data}`);
		this.status = status;
		this.url = url;
		this.method = method;
		this.body = body;
	}
}

function md5UpperCase(value: string): string {
	return createHash('md5').update(value, 'utf-8').digest('hex').toUpperCase();
}

function resolveApiSecret(options: DamaiSignatureOptions): string {
	if (typeof options.apiSecret === 'string' && options.apiSecret.length > 0) {
		return options.apiSecret.toUpperCase();
	}

	if (typeof options.apiPw === 'string' && options.apiPw.length > 0) {
		return md5UpperCase(`${options.apiKey}${options.apiPw}`);
	}

	throw new TypeError('Damai signature requires apiPw or apiSecret');
}

function getHeaders(options: DamaiPostJSONOptions): HeadersInit {
	return Object.assign(
		{ ...options.headers },
		{
			'content-type': 'application/json',
			Accept: 'application/json',
		},
	) as HeadersInit;
}

async function parseResponseBody(res: Response): Promise<unknown> {
	const contentType = res.headers.get('content-type') ?? '';
	if (contentType.includes('application/json')) {
		return res.json();
	}

	return res.text();
}

export function buildDamaiSignature(options: DamaiSignatureOptions) {
	const version = options.version ?? '1.0.0';
	const timestamp = options.timestamp ?? Date.now().toString();
	const msgId = options.msgId ?? timestamp;
	const apiSecret = resolveApiSecret(options);
  const apiKey = options.apiKey;

	const message = [
    `version=${version}`,
    `msgID=${msgId}`,
    `apiKey=${apiKey}`,
    `apiSecret=${apiSecret}`,
    `timeStamp=${timestamp}`,
  ].join('&');
	const signed = md5UpperCase(message);

	return {
		signed,
    apiKey,
		apiSecret,
		msgId,
		timestamp,
		version,
	};
}

export function verifyDamaiSignature(signed: string, options: DamaiSignatureOptions): boolean {
	if (typeof signed !== 'string' || signed.length === 0) {
		return false;
	}

	const expected = buildDamaiSignature(options).signed;
	const input = Buffer.from(signed.toUpperCase(), 'utf-8');
	const target = Buffer.from(expected, 'utf-8');

	if (input.length !== target.length) {
		return false;
	}

	return timingSafeEqual(input, target);
}

export async function damaiPostJson<Res = unknown>(
	url: string,
	options: DamaiPostJSONOptions,
) {
	const body = options.body ?? {};
	const timeStamp = options.timestamp ?? Date.now().toString();
	const signed = options.sign;

	if (typeof signed !== 'string' || signed.length === 0) {
		throw new TypeError('Damai outbound request requires sign');
	}

	const payload = {
		...body,
		signed: {
			timeStamp,
			signInfo: signed,
		}
	} as Record<string, unknown>;

	const res = await fetch(url, {
		...options,
		method: 'POST',
		headers: getHeaders(options),
		body: JSON.stringify(payload),
	});

	const responseBody = await parseResponseBody(res);
	if (res.ok === false) {
		throw new DamaiAPIError(res.status, url, 'POST', responseBody);
	}

	if ((responseBody as ResponseHead)?.code !== "0") {
		throw new DamaiAPIError(res.status, url, 'POST', responseBody);
	}

	return responseBody as Res;
}