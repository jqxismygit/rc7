import { describe, expect, it, vi } from 'vitest';
import { Response } from 'undici';

const { fetchMock } = vi.hoisted(() => ({
	fetchMock: vi.fn(),
}));

vi.mock('undici', async () => {
	const actual = await vi.importActual<typeof import('undici')>('undici');
	return {
		...actual,
		fetch: fetchMock,
	};
});

import {
	buildDamaiSignature,
	damaiPostJson,
	verifyDamaiSignature,
} from '../src/libs/damai.js';

describe('Damai api signing', () => {
  const version = '1.0.0';
  const apiKey = 'qmyihai60s';
  const apiSecret = '9333C6B484EE98AF23500D9620A9FE1D';
	const outboundSign = 'OUTBOUND_SIGN_FROM_CONFIG';
  const msgId = '1677647220299';
  const timestamp = '1677647220299';
  const expectedSignature = '818515D53D4A8163025156EC8605AB56';

	it('build signature with doc sample fields', () => {
		const result = buildDamaiSignature({
			apiKey, apiSecret,
			msgId, timestamp, version,
		});

    expect(result.apiKey).toBe(apiKey);
		expect(result.apiSecret).toBe(apiSecret);
		expect(result.msgId).toBe(msgId);
		expect(result.timestamp).toBe(timestamp);
		expect(result.version).toBe(version);
		expect(result.signed).toBe(expectedSignature);
	});

	it('verify signature', () => {
		const options = {
			apiKey,
			apiSecret,
			msgId,
			timestamp,
			version,
		};

		expect(verifyDamaiSignature(expectedSignature, options)).toBe(true);
		expect(verifyDamaiSignature('F7F168480C29E0D1C461CFC2F23F2F20', options)).toBe(false);
	});

	it('damaiPostJson injects signed info into request body', async () => {
		fetchMock.mockResolvedValueOnce(
			new Response(
				JSON.stringify({ code: '0' }),
				{
					status: 200,
					headers: {
						'content-type': 'application/json',
					},
				}
			)
	);

		await damaiPostJson('https://example.com/damai', {
			sign: outboundSign,
			body: {
				payload: {
					orderId: '123',
				},
			},
		});

		expect(fetchMock).toHaveBeenCalledTimes(1);
		const [url, request] = fetchMock.mock.calls[0] as [string, RequestInit];
		expect(url).toBe('https://example.com/damai');
		expect(request.method).toBe('POST');

		const requestBody = JSON.parse(request.body as string) as {
			payload: { orderId: string };
			signed: {
				timeStamp: string;
				signInfo: string;
			};
		};

		expect(requestBody.payload.orderId).toBe('123');
		expect(requestBody).not.toHaveProperty('head');

		expect(requestBody.signed).toEqual({
				timeStamp: expect.any(String),
				signInfo: outboundSign,
		});
	});
});