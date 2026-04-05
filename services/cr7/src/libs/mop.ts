import {
  createCipheriv, createDecipheriv, createPrivateKey,
  createPublicKey, createSign, createVerify, KeyObject
} from 'node:crypto';
import { Errors } from 'moleculer';
import { fetch, HeadersInit, RequestInit } from 'undici';
import { format } from 'date-fns';

const { MoleculerClientError, MoleculerServerError } = Errors;

type PrivateKeyInput = string | Buffer | KeyObject;
type PublicKeyInput = string | Buffer | KeyObject;

interface BuildMopSignOptions {
	supplier: string;
	timestamp: string;
	version: string;
	privateKey: PrivateKeyInput;
}

interface BuildMopResponseSignOptions {
	code: number;
	timestamp: string;
	privateKey: PrivateKeyInput;
}

interface BuildMopRequestOptions extends BuildMopSignOptions {
	aesKey: string;
	body: unknown;
}

interface MopPostJSONOptions extends
Omit<RequestInit, 'method' | 'body'>, BuildMopRequestOptions {
	responsePublicKey: PublicKeyInput;
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
	code: number;
	timestamp: string;
	msg: string;
	sign: string;
	encryptData: string;
}

interface ParseMopResponseOptions {
	aesKey: string;
	publicKey: PublicKeyInput;
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

function buildMopResponseSignMessage(code: number, timestamp: string) {
	return `${code}${timestamp}`;
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

export function buildMopSign(signUri: string, options: BuildMopSignOptions) {
	const {
    supplier,
    privateKey,
    timestamp = format(new Date(), 'yyyy-MM-dd HH:mm:ss'),
    version = '1.0.0',
  } = options;
	const message = `${supplier}${timestamp}${version}${signUri}`;

	const signer = createSign('RSA-SHA256');
	signer.update(message, 'utf-8');
	signer.end();

	const sign = signer.sign(parsePrivateKey(privateKey), 'base64');

	return { sign, message, signUri, timestamp, version };
}

export function verifyMopSign(
	sign: string,
	signUri: string,
	options: Omit<BuildMopSignOptions, 'privateKey'> & { publicKey: PublicKeyInput },
) {
	const timestamp = options.timestamp;
	const version = options.version;
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
		throw new MoleculerClientError('猫眼响应缺少签名字段', 400, 'MOP_RESPONSE_SIGN_MISSING');
	}

	const { code, timestamp, sign } = envelope;
	const verifier = createVerify('RSA-SHA256');
	verifier.update(buildMopResponseSignMessage(code, timestamp), 'utf-8');
	verifier.end();

	return verifier.verify(parsePublicKey(publicKey), sign, 'base64');
}

export function buildMopResponseSign(options: BuildMopResponseSignOptions) {
	const { code, timestamp, privateKey } = options;
	const message = buildMopResponseSignMessage(code, timestamp);
	const signer = createSign('RSA-SHA256');
	signer.update(message, 'utf-8');
	signer.end();

	return {
		sign: signer.sign(parsePrivateKey(privateKey), 'base64'),
		message,
	};
}

export function parseMopResponseData<T = unknown>(
	response: MopResponseEnvelope,
	options: ParseMopResponseOptions,
) {

	if (!options.publicKey) {
		throw new MoleculerClientError('猫眼响应验签缺少公钥', 502, 'MOP_RESPONSE_SIGN_KEY_MISSING');
	}

  const verified = verifyMopResponseSign(response, options.publicKey);
  if (!verified) {
    throw new MoleculerClientError('猫眼响应验签失败', 400, 'MOP_RESPONSE_SIGN_INVALID');
  }

	if (!options.aesKey) {
		throw new MoleculerClientError('猫眼响应解密缺少 AES key', 502, 'MOP_RESPONSE_AES_KEY_MISSING');
	}

	const { encryptData = null } = response;
	if (encryptData === null) {
		return null;
	}

	const rawData = decryptMopData(encryptData, options.aesKey);
  const result = JSON.parse(rawData) as T;
  return result;
}

export function buildMopRequest(signUri:string, options: BuildMopRequestOptions) {
	const plainData = typeof options.body === 'string'
		? options.body
		: JSON.stringify(options.body);

	const encryptData = encryptMopData(plainData, options.aesKey);
	const signResult = buildMopSign(signUri, options);

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

function resolveMopSignUri(url: string) {
	if (url.startsWith('http://') || url.startsWith('https://')) {
		const parsedUrl = new URL(url);
		return parsedUrl.pathname;
	}

	return url;
}

function getMopHeaders(
  options: MopPostJSONOptions,
  requestHeaders: MopRequestHeaders
): HeadersInit {
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
	const signUri = resolveMopSignUri(url);
	const request = buildMopRequest(signUri, options);
	const requestBody = JSON.stringify(request.payload);

	const res = await fetch(url, {
		...options,
		method: 'POST',
		headers: getMopHeaders(options, request.headers),
		body: requestBody,
	});

	const responseBody = await res.json() as MopResponseEnvelope;

	if (!res.ok) {
		throw new MopAPIError(res.status, url, 'POST', responseBody);
	}

	const parsed = parseMopResponseData<Res>(responseBody, {
		aesKey: options.aesKey,
		publicKey: options.responsePublicKey,
	});

	const { code, msg } = responseBody;
	if (code !== 10000) {
		throw new MoleculerServerError(
			`猫眼接口返回错误: ${msg}`, 500,
			'MOP_API_ERROR',
			{ code, msg, response: parsed }
		);
	}

	return parsed;
}