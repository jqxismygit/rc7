import { createCipheriv, createDecipheriv, createPrivateKey, createPublicKey, createSign, createVerify, KeyObject } from 'node:crypto';
import { Errors } from 'moleculer';
import { fetch, HeadersInit, RequestInit } from 'undici';

const { MoleculerClientError } = Errors;

type PrivateKeyInput = string | Buffer | KeyObject;
type PublicKeyInput = string | Buffer | KeyObject;

interface BuildMopSignOptions {
	supplier: string;
	timestamp?: string;
	version?: string;
	privateKey: PrivateKeyInput;
	signUri?: string;
}

interface BuildMopResponseSignOptions {
	code: string | number;
	timestamp: string;
	privateKey: PrivateKeyInput;
}

interface BuildMopRequestOptions extends BuildMopSignOptions {
	uri: string;
	aesKey: string;
	body: unknown;
}

interface MopPostJSONOptions extends Omit<RequestInit, 'method' | 'body'>, BuildMopRequestOptions {
	responsePublicKey?: PublicKeyInput;
	verifyResponseSign?: boolean;
}

interface MopRequestHeaders {
	supplier: string;
	timestamp: string;
	version: string;
	sign: string;
}

interface MopRequestPayload {
	encryptData: string;
}

interface MopResponseEnvelope {
	code: string | number;
	timestamp: string;
	msg?: string;
	sign?: string;
	encryptData?: string;
}

interface ParseMopResponseOptions {
	aesKey?: string;
	publicKey?: PublicKeyInput;
	verifySign?: boolean;
}

class MopAPIError extends Error {
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

function formatMopTimestamp(date = new Date()) {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, '0');
	const day = String(date.getDate()).padStart(2, '0');
	const hour = String(date.getHours()).padStart(2, '0');
	const minute = String(date.getMinutes()).padStart(2, '0');
	const second = String(date.getSeconds()).padStart(2, '0');
	return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
}

function getMopAESAlgorithm(key: Buffer) {
	if (key.length === 16) {
		return 'aes-128-ecb';
	}
	if (key.length === 24) {
		return 'aes-192-ecb';
	}
	if (key.length === 32) {
		return 'aes-256-ecb';
	}

	throw new MoleculerClientError('猫眼 AES key 长度必须是 16/24/32 字节', 400, 'MOP_AES_INVALID');
}

function parsePrivateKey(privateKey: PrivateKeyInput): KeyObject | PrivateKeyInput {
	if (typeof privateKey !== 'string') {
		return privateKey;
	}

	if (privateKey.includes('BEGIN')) {
		return privateKey;
	}

	return createPrivateKey({
		key: Buffer.from(privateKey, 'base64'),
		format: 'der',
		type: 'pkcs8',
	});
}

function parsePublicKey(publicKey: PublicKeyInput): KeyObject | PublicKeyInput {
	if (typeof publicKey !== 'string') {
		return publicKey;
	}

	if (publicKey.includes('BEGIN')) {
		return publicKey;
	}

	return createPublicKey({
		key: Buffer.from(publicKey, 'base64'),
		format: 'der',
		type: 'spki',
	});
}

function normalizeMopSignUri(uri: string) {
	if (uri.startsWith('/supply/open/')) {
		return `/${uri.slice('/supply/open/'.length)}`;
	}
	return uri;
}

function parseMopResponseEnvelope(response: unknown): MopResponseEnvelope {
	if (typeof response !== 'object' || response === null) {
		throw new MoleculerClientError('猫眼响应格式错误', 502, 'MOP_RESPONSE_INVALID');
	}

	const envelope = response as Partial<MopResponseEnvelope>;
	if (typeof envelope.timestamp !== 'string' || envelope.timestamp.length === 0) {
		throw new MoleculerClientError('猫眼响应格式错误', 502, 'MOP_RESPONSE_INVALID');
	}

	if (typeof envelope.code !== 'string' && typeof envelope.code !== 'number') {
		throw new MoleculerClientError('猫眼响应格式错误', 502, 'MOP_RESPONSE_INVALID');
	}

	return {
		code: envelope.code,
		timestamp: envelope.timestamp,
		msg: typeof envelope.msg === 'string' ? envelope.msg : undefined,
		sign: typeof envelope.sign === 'string' ? envelope.sign : undefined,
		encryptData: typeof envelope.encryptData === 'string' ? envelope.encryptData : undefined,
	};
}

function buildMopResponseSignMessage(code: string | number, timestamp: string) {
	return `${String(code)}${timestamp}`;
}

export function encryptMopData(plainData: string, aesKey: string): string {
	const keyBuffer = Buffer.from(aesKey, 'utf-8');
	const algorithm = getMopAESAlgorithm(keyBuffer);
	const cipher = createCipheriv(algorithm, keyBuffer, null);
	const encrypted = Buffer.concat([
		cipher.update(Buffer.from(plainData, 'utf-8')),
		cipher.final(),
	]);
	return encrypted.toString('base64');
}

export function decryptMopData(encryptData: string, aesKey: string): string {
	const keyBuffer = Buffer.from(aesKey, 'utf-8');
	const algorithm = getMopAESAlgorithm(keyBuffer);
	const decipher = createDecipheriv(algorithm, keyBuffer, null);
	const decrypted = Buffer.concat([
		decipher.update(Buffer.from(encryptData, 'base64')),
		decipher.final(),
	]);
	return decrypted.toString('utf-8');
}

export function buildMopSign(uri: string, options: BuildMopSignOptions) {
	const timestamp = options.timestamp ?? formatMopTimestamp();
	const version = options.version ?? '1.0.0';
	const signUri = options.signUri ?? normalizeMopSignUri(uri);
	const message = `${options.supplier}${timestamp}${version}${signUri}`;

	const signer = createSign('RSA-SHA256');
	signer.update(message, 'utf-8');
	signer.end();

	const sign = signer.sign(parsePrivateKey(options.privateKey), 'base64');

	return {
		sign,
		message,
		signUri,
		timestamp,
		version,
	};
}

export function verifyMopSign(
	sign: string,
	uri: string,
	options: Omit<BuildMopSignOptions, 'privateKey'> & { publicKey: PublicKeyInput },
) {
	const timestamp = options.timestamp ?? formatMopTimestamp();
	const version = options.version ?? '1.0.0';
	const signUri = options.signUri ?? normalizeMopSignUri(uri);
	const message = `${options.supplier}${timestamp}${version}${signUri}`;

	const verifier = createVerify('RSA-SHA256');
	verifier.update(message, 'utf-8');
	verifier.end();

	return verifier.verify(parsePublicKey(options.publicKey), sign, 'base64');
}

export function verifyMopResponseSign(
	envelope: Pick<MopResponseEnvelope, 'code' | 'timestamp' | 'sign'>,
	publicKey: PublicKeyInput,
) {
	if (typeof envelope.sign !== 'string' || envelope.sign.length === 0) {
		throw new MoleculerClientError('猫眼响应缺少签名字段', 502, 'MOP_RESPONSE_SIGN_MISSING');
	}

	const verifier = createVerify('RSA-SHA256');
	verifier.update(buildMopResponseSignMessage(envelope.code, envelope.timestamp), 'utf-8');
	verifier.end();

	return verifier.verify(parsePublicKey(publicKey), envelope.sign, 'base64');
}

export function buildMopResponseSign(options: BuildMopResponseSignOptions) {
	const message = buildMopResponseSignMessage(options.code, options.timestamp);
	const signer = createSign('RSA-SHA256');
	signer.update(message, 'utf-8');
	signer.end();

	return {
		sign: signer.sign(parsePrivateKey(options.privateKey), 'base64'),
		message,
	};
}

export function parseMopResponseData<T = unknown>(
	response: unknown,
	options: ParseMopResponseOptions = {},
) {
	const envelope = parseMopResponseEnvelope(response);
	const verifySign = options.verifySign ?? true;

	if (verifySign) {
		if (!options.publicKey) {
			throw new MoleculerClientError('猫眼响应验签缺少公钥', 502, 'MOP_RESPONSE_SIGN_KEY_MISSING');
		}

		const verified = verifyMopResponseSign(envelope, options.publicKey);
		if (!verified) {
			throw new MoleculerClientError('猫眼响应验签失败', 400, 'MOP_RESPONSE_SIGN_INVALID');
		}
	}

	if (typeof envelope.encryptData !== 'string') {
		return {
			envelope,
			data: null,
			rawData: null,
		};
	}

	if (!options.aesKey) {
		throw new MoleculerClientError('猫眼响应解密缺少 AES key', 502, 'MOP_RESPONSE_AES_KEY_MISSING');
	}

	const rawData = decryptMopData(envelope.encryptData, options.aesKey);
	try {
		return {
			envelope,
			data: JSON.parse(rawData) as T,
			rawData,
		};
	} catch {
		return {
			envelope,
			data: rawData as T,
			rawData,
		};
	}
}

export function buildMopRequest(options: BuildMopRequestOptions) {
	const plainData = typeof options.body === 'string'
		? options.body
		: JSON.stringify(options.body);

	const encryptData = encryptMopData(plainData, options.aesKey);
	const signResult = buildMopSign(options.uri, options);

	const headers: MopRequestHeaders = {
		supplier: options.supplier,
		timestamp: signResult.timestamp,
		version: signResult.version,
		sign: signResult.sign,
	};

	const payload: MopRequestPayload = {
		encryptData,
	};

	return {
		headers,
		payload,
		plainData,
		encryptData,
		sign: signResult.sign,
		signMessage: signResult.message,
		signUri: signResult.signUri,
	};
}

function getMopHeaders(options: MopPostJSONOptions, requestHeaders: MopRequestHeaders): HeadersInit {
	return Object.assign(
		{ ...options.headers },
		{
			'content-type': 'application/json',
			Accept: 'application/json',
			supplier: requestHeaders.supplier,
			timestamp: requestHeaders.timestamp,
			version: requestHeaders.version,
			sign: requestHeaders.sign,
		},
	) as HeadersInit;
}

export async function mopPostJSON<Res = unknown>(
	url: string,
	options: MopPostJSONOptions,
) {
	const request = buildMopRequest(options);
	const requestBody = JSON.stringify(request.payload);

	const res = await fetch(url, {
		...options,
		method: 'POST',
		headers: getMopHeaders(options, request.headers),
		body: requestBody,
	});

	const contentType = res.headers.get('content-type') || '';
	const responseBody = contentType.includes('application/json')
		? await res.json()
		: await res.text();

	if (!res.ok) {
		throw new MopAPIError(res.status, url, 'POST', responseBody);
	}

	const parsed = parseMopResponseData<Res>(responseBody, {
		aesKey: options.aesKey,
		publicKey: options.responsePublicKey,
		verifySign: options.verifyResponseSign ?? Boolean(options.responsePublicKey),
	});

	return {
		request,
		response: parsed.envelope,
		data: parsed.data,
		rawData: parsed.rawData,
	};
}