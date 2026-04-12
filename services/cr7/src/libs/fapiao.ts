
import { createCipheriv, createDecipheriv, createHash } from 'node:crypto';
import config from 'config';
import { format } from 'date-fns';
import { Errors } from 'moleculer';
import { postJSON } from './fetch-utils.js';

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
  const exchangeDate = format(date, 'yyyyMMdd');
	return `${DEFAULT_REQUEST_CODE}${interfaceCode}${exchangeDate}${sequence}`;
}

export function buildFapiaoRequest(options: BuildFapiaoRequestOptions) {
	const requestCode = options.requestCode ?? DEFAULT_REQUEST_CODE;
	const responseCode = options.responseCode ?? DEFAULT_RESPONSE_CODE;
	const requestTime = options.requestTime ?? format(new Date(), 'yyyy-MM-dd HH:mm:ss');
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


/**
 * 构建请求、发送 POST、校验响应，返回解密后的业务内容。
 * 若平台返回 returnCode 非 0000，或业务内容中 CODE 非 0000，则抛出错误。
 */
export async function sendFapiaoRequest<T = unknown>(
  interfaceCode: string,
  content: unknown,
): Promise<T> {
	const request = buildFapiaoRequest({
		interfaceCode, content,
    requestCode: DEFAULT_REQUEST_CODE,
		appId: config.fapiao.app_id,
		secret: config.fapiao.secret,
	});

	const rawResponse = await postJSON(config.fapiao.base_url, {
		body: request.payload,
	});

	const parsed = parseFapiaoResponse<T & { CODE?: string; MESSAGE?: string }>(rawResponse, {
		secret: config.fapiao.secret,
	});

	if (parsed.returnCode !== '0000') {
		throw new MoleculerClientError(
			`发票平台错误: ${parsed.returnMessage}`,
			502,
			'FAPIAO_PLATFORM_ERROR',
		);
	}

	const decoded = parsed.decodedContent;
	if (
		typeof decoded === 'object' &&
		decoded !== null &&
		'CODE' in decoded &&
		(decoded as { CODE?: string }).CODE !== '0000'
	) {
		const msg = (decoded as { MESSAGE?: string }).MESSAGE ?? '发票申请失败';
		throw new MoleculerClientError(msg, 502, 'FAPIAO_REQUEST_FAILED');
	}

	return decoded as T;
}

const FAPIAO_INTERFACE_CODE = 'GP_FPKJ';
const FAPIAO_INTERFACE_KEY = 'REQUEST_COMMON_FPKJ';
const FAPIAO_TAX_RATE = 0.03;
const FAPIAO_ITEM_CODE = '3070301000000000000';

function formatYuanFromFen(valueInFen: number) {
	const value = valueInFen / 100;
	if (Number.isInteger(value)) {
		return `${value}`;
	}
	return value.toFixed(2);
}

export interface FapiaoKpjItem {
	ticket_name: string;
	quantity: number;
	unit_price: number;
	subtotal: number;
}

export interface FapiaoKpjParams {
	oid: string;
	invoice_title: string;
	tax_no?: string;
	buyer_name: string;
	total_amount: number;
	items: FapiaoKpjItem[];
}

export async function sendFapiaoKpjRequest(params: FapiaoKpjParams): Promise<void> {
	const { oid, invoice_title, tax_no = '', buyer_name, total_amount, items } = params;

	const hjjeFen = Math.round(total_amount / (1 + FAPIAO_TAX_RATE));
	const hjseFen = total_amount - hjjeFen;

	const itemRows = items.map((item) => {
		const itemHjjeFen = Math.round(item.subtotal / (1 + FAPIAO_TAX_RATE));
		const itemHjseFen = item.subtotal - itemHjjeFen;

		return {
			FPHXZ: '0',
			SPBM: FAPIAO_ITEM_CODE,
			XMMC: item.ticket_name,
			XMSL: `${item.quantity}`,
			XMDJ: formatYuanFromFen(item.unit_price),
			XMJE: formatYuanFromFen(itemHjjeFen),
			SL: `${FAPIAO_TAX_RATE}`,
			SE: formatYuanFromFen(itemHjseFen),
		};
	});

	const content = {
		[FAPIAO_INTERFACE_KEY]: {
			SBLX: '6',
			SBBH: '',
			FPQQLSH: oid.replace(/-/g, ''),
			KPZDDM: '',
			FPLXDM: '030',
			KPLX: '0',
			BMB_BBH: '',
			ZSFS: '0',
			XSF_NSRSBH: config.fapiao.tax_id,
			XSF_MC: config.fapiao.company_name,
			XSF_DZ: config.fapiao.company_address,
			XSF_DH: config.fapiao.company_phone,
			XSF_KHH: config.fapiao.company_bank,
			XSF_ZH: config.fapiao.company_bank_account,
			GMF_NSRSBH: tax_no,
			GMF_MC: buyer_name,
			KPR: config.fapiao.issuer,
			BY1: invoice_title,
			JSHJ: formatYuanFromFen(total_amount),
			HJJE: formatYuanFromFen(hjjeFen),
			HJSE: formatYuanFromFen(hjseFen),
			COMMON_FPKJ_XMXX: itemRows,
			CALLBACK_URL: config.fapiao.callback_base_url,
		},
	};

	await sendFapiaoRequest(FAPIAO_INTERFACE_CODE, content);
}