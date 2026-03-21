import { createSign, randomBytes } from 'node:crypto';
import { fetch, HeadersInit, RequestInit } from 'undici';

class WePayAPIError extends Error {
	status: number;
	url: string;
	method: string;
	body: unknown;

	constructor(
		status: number,
		url: string,
		method: string,
		body: unknown
	) {
		const data = typeof body === 'string' ? body : JSON.stringify(body);
		const message = `${status} - ${method} ${url} - ${data}`;
		super(message);
		this.status = status;
		this.url = url;
		this.method = method;
		this.body = body;
	}
}

interface WechatPayAuthOptions {
	mchid: string;
	serialNo: string;
	privateKey: string;
	nonceStr?: string;
	timestamp?: number;
}

interface WechatPayPostOptions extends Omit<RequestInit, 'method' | 'body'>, WechatPayAuthOptions {
	body?: unknown;
}

function buildSignMessage(
	method: string,
	url: URL,
	timestamp: number,
	nonceStr: string,
	body: string,
) {
	const canonicalUrl = `${url.pathname}${url.search}`;
	return `${method}\n${canonicalUrl}\n${timestamp}\n${nonceStr}\n${body}\n`;
}

function signMessage(message: string, privateKey: string): string {
	const signer = createSign('RSA-SHA256');
	signer.update(message);
	signer.end();
	return signer.sign(privateKey, 'base64');
}

export function buildWechatPayAuthorization(
	method: string,
	url: string,
	body: string,
	options: WechatPayAuthOptions,
) {
	const { mchid, serialNo, privateKey } = options;
	const timestamp = options.timestamp ?? Math.floor(Date.now() / 1000);
	const nonceStr = options.nonceStr ?? randomBytes(16).toString('hex').toUpperCase();
	const parsedUrl = new URL(url);
	const message = buildSignMessage(method.toUpperCase(), parsedUrl, timestamp, nonceStr, body);
	const signature = signMessage(message, privateKey);

	const authorization = [
		'WECHATPAY2-SHA256-RSA2048',
		[
		`mchid="${mchid}"`,
		`nonce_str="${nonceStr}"`,
		`signature="${signature}"`,
		`timestamp="${timestamp}"`,
		`serial_no="${serialNo}"`,
		].join(','),
	].join(' ');

	return {
		authorization,
		timestamp,
		nonceStr,
		signature,
		message,
	};
}

function getHeaders(
	options: WechatPayPostOptions,
	authorization: string,
): HeadersInit {
	return Object.assign(
		{ ...options.headers },
		{
			'content-type': 'application/json',
			Accept: 'application/json',
			Authorization: authorization,
		},
	) as HeadersInit;
}

export async function wePayPostJSON<Res = unknown>(
	url: string,
	options: WechatPayPostOptions,
) {
	const body = options.body ? JSON.stringify(options.body) : '';
	const auth = buildWechatPayAuthorization('POST', url, body, options);

	const res = await fetch(url, {
		...options,
		method: 'POST',
		headers: getHeaders(options, auth.authorization),
		body,
	});

	const contentType = res.headers.get('content-type') || '';
	const responseBody = contentType.includes('application/json')
		? await res.json()
		: await res.text();

	if (res.ok === false) {
		throw new WePayAPIError(res.status, url, 'POST', responseBody);
	}

	return responseBody as Res;
}