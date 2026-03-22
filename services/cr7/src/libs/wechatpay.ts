import { createDecipheriv, createSign, randomBytes } from 'node:crypto';
import { Errors } from 'moleculer';
import { fetch, HeadersInit, RequestInit } from 'undici';

const { MoleculerClientError } = Errors;

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

interface SignPayOptions {
	appid: string;
	privateKey: string;
	nonceStr?: string;
	timestamp?: number;
}

interface SignPayResult {
	timeStamp: string;
	nonceStr: string;
	package: string;
	signType: 'RSA';
	paySign: string;
	message: string;
}

export interface WechatCallbackResource {
	ciphertext: string;
	nonce: string;
	associated_data: string;
}

export interface WechatCallbackTransactionResult {
	out_trade_no: string;
	transaction_id: string;
	trade_state: string;
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

function buildPaySignMessage(
	appid: string,
	timestamp: string,
	nonceStr: string,
	pkg: string,
) {
	return `${appid}\n${timestamp}\n${nonceStr}\n${pkg}\n`;
}

export function signPay(prepay_id: string, options: SignPayOptions): SignPayResult {
	const timestamp = String(options.timestamp ?? Math.floor(Date.now() / 1000));
	const nonceStr = options.nonceStr ?? randomBytes(16).toString('hex').toUpperCase();
	const pkg = `prepay_id=${prepay_id}`;
	const message = buildPaySignMessage(options.appid, timestamp, nonceStr, pkg);
	const paySign = signMessage(message, options.privateKey);

	return {
		timeStamp: timestamp,
		nonceStr,
		package: pkg,
		signType: 'RSA',
		paySign,
		message,
	};
}

export function decryptWechatCallbackResource(
	resource: WechatCallbackResource,
	apiV3Secret: string,
): WechatCallbackTransactionResult {
	const key = Buffer.from(apiV3Secret.padEnd(32, '0').slice(0, 32), 'utf-8');
	const ciphertext = Buffer.from(resource.ciphertext, 'base64');

	if (ciphertext.length <= 16) {
		throw new MoleculerClientError('微信回调密文格式错误', 400, 'WECHATPAY_CALLBACK_INVALID');
	}

	const encrypted = ciphertext.subarray(0, ciphertext.length - 16);
	const authTag = ciphertext.subarray(ciphertext.length - 16);
	const decipher = createDecipheriv('aes-256-gcm', key, resource.nonce);
	decipher.setAAD(Buffer.from(resource.associated_data));
	decipher.setAuthTag(authTag);

	let decrypted = '';
	try {
		decrypted = Buffer.concat([
			decipher.update(encrypted),
			decipher.final(),
		]).toString('utf-8');
	} catch {
		throw new MoleculerClientError('微信回调解密失败', 400, 'WECHATPAY_CALLBACK_DECRYPT_FAILED');
	}

	const payload = JSON.parse(decrypted) as Partial<WechatCallbackTransactionResult>;
	const outTradeNo = payload.out_trade_no ?? null;
	const transactionId = payload.transaction_id ?? null;
	const tradeState = payload.trade_state ?? null;

	if (outTradeNo === null || transactionId === null || tradeState === null) {
		throw new MoleculerClientError('微信回调业务字段缺失', 400, 'WECHATPAY_CALLBACK_INVALID');
	}

	return {
		out_trade_no: outTradeNo,
		transaction_id: transactionId,
		trade_state: tradeState,
	};
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