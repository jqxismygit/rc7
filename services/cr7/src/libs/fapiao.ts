
import { createCipheriv, createDecipheriv, createHash } from 'node:crypto';
import config from 'config';
import { Errors } from 'moleculer';

const { MoleculerClientError } = Errors;

const DEFAULT_REQUEST_CODE = 'DZFPQZ';
const DEFAULT_RESPONSE_CODE = 'DS';

interface FapiaoGlobalInfo {
	appId: string;
	interfaceId: string;
	interfaceCode: string;
	requestCode: string;
	requestTime: string;
	responseCode: string;
	dataExchangeId: string;
}

interface FapiaoReturnStateInfo {
	returnCode: string;
	returnMessage: string;
}

interface FapiaoDataSection {
	dataDescription: {
		zipCode: string;
	};
	content: string;
	contentKey: string;
}

export interface FapiaoEnvelope {
	interface: {
		globalInfo: FapiaoGlobalInfo;
		returnStateInfo: FapiaoReturnStateInfo;
		data: FapiaoDataSection;
	};
}

interface BuildFapiaoRequestOptions {
	appId: string;
	secret: string;
	interfaceCode: string;
	content: unknown;
	requestTime?: string;
	dataExchangeId?: string;
	requestCode?: string;
	responseCode?: string;
	interfaceId?: string;
	zipCode?: string;
}

interface ParseFapiaoResponseOptions {
	secret?: string;
	verifyContentKey?: boolean;
	parseContentAsJSON?: boolean;
}

export interface ParsedFapiaoResponse<T = unknown> {
	envelope: FapiaoEnvelope;
	decodedContentText: string | null;
	decodedContent: T | string | null;
	returnCode: string;
	returnMessage: string;
}

function assertAESKey(secret: string) {
	const keySize = Buffer.byteLength(secret, 'utf-8');
	if (![16, 24, 32].includes(keySize)) {
		throw new MoleculerClientError('发票平台 AES 密钥长度必须是 16/24/32 字节', 400, 'FAPIAO_AES_INVALID');
	}
}

function getAESAlgorithm(secret: string) {
	const keySize = Buffer.byteLength(secret, 'utf-8');
	if (keySize === 16) {
		return 'aes-128-ecb';
	}
	if (keySize === 24) {
		return 'aes-192-ecb';
	}
	return 'aes-256-ecb';
}

function formatRequestTime(date = new Date()) {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, '0');
	const day = String(date.getDate()).padStart(2, '0');
	const hour = String(date.getHours()).padStart(2, '0');
	const minute = String(date.getMinutes()).padStart(2, '0');
	const second = String(date.getSeconds()).padStart(2, '0');
	return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
}

function formatExchangeDate(date = new Date()) {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, '0');
	const day = String(date.getDate()).padStart(2, '0');
	return `${year}${month}${day}`;
}

function normalizeContent(content: unknown) {
	return typeof content === 'string' ? content : JSON.stringify(content);
}

export function encodeFapiaoContent(content: unknown) {
	return Buffer.from(normalizeContent(content), 'utf-8').toString('base64');
}

export function decodeFapiaoContent(contentBase64: string) {
	return Buffer.from(contentBase64, 'base64').toString('utf-8');
}

export function sha256FapiaoContent(contentBase64: string) {
	return createHash('sha256').update(contentBase64, 'utf-8').digest('hex');
}

export function encryptFapiaoContentKey(contentSha256Hex: string, secret: string) {
	assertAESKey(secret);
	const cipher = createCipheriv(
		getAESAlgorithm(secret),
		Buffer.from(secret, 'utf-8'),
		null,
	);
	const encrypted = Buffer.concat([
		cipher.update(Buffer.from(contentSha256Hex, 'utf-8')),
		cipher.final(),
	]);
	return encrypted.toString('base64');
}

export function decryptFapiaoContentKey(contentKey: string, secret: string) {
	assertAESKey(secret);
	const decipher = createDecipheriv(
		getAESAlgorithm(secret),
		Buffer.from(secret, 'utf-8'),
		null,
	);
	const decrypted = Buffer.concat([
		decipher.update(Buffer.from(contentKey, 'base64')),
		decipher.final(),
	]);
	return decrypted.toString('utf-8');
}

export function buildFapiaoDataExchangeId(interfaceCode: string, sequence: string, date = new Date()) {
	return `${DEFAULT_REQUEST_CODE}${interfaceCode}${formatExchangeDate(date)}${sequence}`;
}

export function buildFapiaoRequest(options: BuildFapiaoRequestOptions) {
	const requestCode = options.requestCode ?? DEFAULT_REQUEST_CODE;
	const responseCode = options.responseCode ?? DEFAULT_RESPONSE_CODE;
	const requestTime = options.requestTime ?? formatRequestTime();
	const encodedContent = encodeFapiaoContent(options.content);
	const contentSha256 = sha256FapiaoContent(encodedContent);
	const contentKey = encryptFapiaoContentKey(contentSha256, options.secret);

	const payload: FapiaoEnvelope = {
		interface: {
			globalInfo: {
				appId: options.appId,
				interfaceId: options.interfaceId ?? '',
				interfaceCode: options.interfaceCode,
				requestCode,
				requestTime,
				responseCode,
				dataExchangeId: options.dataExchangeId ?? buildFapiaoDataExchangeId(options.interfaceCode, '000000001'),
			},
			returnStateInfo: {
				returnCode: '',
				returnMessage: '',
			},
			data: {
				dataDescription: {
					zipCode: options.zipCode ?? '0',
				},
				content: encodedContent,
				contentKey,
			},
		},
	};

	return {
		payload,
		requestBody: JSON.stringify(payload),
		plainContent: normalizeContent(options.content),
		encodedContent,
		contentSha256,
		contentKey,
	};
}

function parseResponseEnvelope(response: unknown): FapiaoEnvelope {
	if (typeof response !== 'object' || response === null) {
		throw new MoleculerClientError('发票平台响应格式错误', 502, 'FAPIAO_RESPONSE_INVALID');
	}

	const candidate = response as FapiaoEnvelope;
	if (
		typeof candidate.interface !== 'object' ||
		candidate.interface === null ||
		typeof candidate.interface.data !== 'object' ||
		candidate.interface.data === null ||
		typeof candidate.interface.returnStateInfo !== 'object' ||
		candidate.interface.returnStateInfo === null
	) {
		throw new MoleculerClientError('发票平台响应格式错误', 502, 'FAPIAO_RESPONSE_INVALID');
	}

	return candidate;
}

export function parseFapiaoResponse<T = unknown>(
	response: unknown,
	options: ParseFapiaoResponseOptions = {},
): ParsedFapiaoResponse<T> {
	const envelope = parseResponseEnvelope(response);
	const encodedContent = envelope.interface.data.content || '';
	const decodedContentText = encodedContent.length === 0
		? null
		: decodeFapiaoContent(encodedContent);

	if (options.verifyContentKey !== false && options.secret && encodedContent.length > 0) {
		const expectedSha = sha256FapiaoContent(encodedContent);
		let decryptedSha = '';
		try {
			decryptedSha = decryptFapiaoContentKey(envelope.interface.data.contentKey, options.secret);
		} catch {
			throw new MoleculerClientError('发票平台响应 contentKey 校验失败', 400, 'FAPIAO_CONTENT_KEY_INVALID');
		}
		if (decryptedSha !== expectedSha) {
			throw new MoleculerClientError('发票平台响应 contentKey 校验失败', 400, 'FAPIAO_CONTENT_KEY_INVALID');
		}
	}

	let decodedContent: T | string | null = decodedContentText;
	if (decodedContentText && options.parseContentAsJSON !== false) {
		decodedContent = JSON.parse(decodedContentText) as T;
	}

	return {
		envelope,
		decodedContentText,
		decodedContent,
		returnCode: envelope.interface.returnStateInfo.returnCode,
		returnMessage: envelope.interface.returnStateInfo.returnMessage,
	};
}

export function createFapiaoRequest(
  options: Omit<BuildFapiaoRequestOptions, 'appId' | 'secret' | 'requestCode'>,
) {
	return buildFapiaoRequest({
		...options,
    requestCode: DEFAULT_REQUEST_CODE,
		appId: config.fapiao.app_id,
		secret: config.fapiao.secret,
	});
}