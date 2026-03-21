import { describe, expect, it } from 'vitest';

import { buildWechatPayAuthorization } from '../src/libs/wepay.js';

describe('wechat payment', () => {
	it('builds Authorization header with doc sample inputs', () => {
		const privateKey = [
			'-----BEGIN PRIVATE KEY-----',
			'MIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQCm2mb6q8gMKH/3',
			'CNTbpJAIrbqiBiQGEOtjGcBrDYltsGynWgNscqT7WvfzU14FQbYcQUC5T4Wvva7m',
			'i3fIp3OgX8VqMDNA0qebnr38Pe6kqiLyZgFpJPXlSKDyPyqhRbVTbXssvSMQeVKc',
			'dXeVxoNNeoOlNFHgF/P0io6AmAVnz+hN8SiZKuOsth5/zUTLGvtkgxBcQooQrtXh',
			'RcpLT798OyIb9xeJ2HO3xRtMv2+perEzb4gMibI74UBz+2QEbnkubPE+2jU2rRZu',
			'dnNEz/BPOt3Qj/w2V6/G0VumGDh6+UeMU0jv4aupHztWITC4Akn0l7lBCNy3lgl8',
			'VFaJnkIxAgMBAAECggEAYGL8aESB7NwciDWW2UdoWUsa7GxFtSdjAz2mFXGdeTsY',
			'mVh7b9OOkRGM+Qio4LqEHDBp1mMk5E/cUJwy1zw8pGGO5nfvs7u9TT3XnHaefIs4',
			'YvUgTYAneIuLRkXNN5rQU+CD7mVYczTSz0Vgjqo9wa1LjUz7G0xbBmJgTdMEFGJs',
			'eJjy6AbJo0CGIwp6HJbTm4CmOUgXnnDAIbEGTIRImkZFH/rzneIeR7oZ77FVwxr1',
			'CZB2gfRCov/yRPbw8vnryYkmvQ7D/ze3j5097vRg/MoDGBSdoOwcmo75vyofr0AS',
			'zytMjmHYyifqkf5slPropSiJeGf4p/7gtKyF6dE/XQKBgQDVAlJ+4U5ZVGOuDc3+',
			'sAhz8CTzgFNlq9vKuSoFK6hOz2L+cwj+E7NXGkOe2DsHHZNy2Xqxk7caKhPEp1z9',
			'hhpMpyLVMoFt6CKemyoRBWDCQwLLwem9SZF/IAyovBkLiH36P42Jm26gUkNMKC/5',
			'Zhtqxf6RZgRQzbVudJi47vIRCwKBgQDIh0+v27Oo+DM3fhObH4I1NrXpWOEGH7OQ',
			'G1dEsMuFYF4hjGhg0kBEP3w9vVdl2+mRllZKTsx9oqjb8OibPLLIH8xsdbAB0WLf',
			'JvjLu4wl/ILUzN1RI03dWnnv2EnEeQn6c3hizvrJ9wR5U4ue9RPVnQooJ0hZF1PU',
			'uCL5fWK3MwKBgElReU/PAYbh80WP3t3Rfbdaa32dKBeQ5iCLR5lsA4zM+YgX1HqQ',
			'EWTj126vgvHaDkyz6vWAoL/Sx+cirHFfXWIRDX5Q2hgYlQH+6qXdMgbrxeSYpHnQ',
			'/tHBGFpkFELSAnrGsVMyOwvYBO4LzyeLK9i+ufcWJFoj1FVmsMLHDG8tAoGARdbi',
			'iQQCoYG4DMarO2aQ6cmhN6EN1h0qY7EyBqlwaIZ0okiNfdMcMOjPc41DKCWcRmlO',
			'qlihXcxN9TQFPzO3rH1urAOdBjUPs1qWYhZyrDQyuLyVBBJApyxAtajloDjrob+f',
			'mQIvVDHk7ACN6xG+E7K6+9salnTKbJapD618uQMCgYBNy6XUvzLkP/A1U/UZdtcx',
			'l8GwU/dturLxz4CyGbqDw4ubaYY2e13lnqHUqQgPtiSyH51nq3tdo8G0YAJdfkSv',
			'KvnfslW91fyEBUKnkdW1o3/1UFU/wprZ7ixVL/F42A4xDu7OFE8EnweJOZ0jWceE',
			'OdhCkaIGBCfRnlECRK8UyQ==',
			'-----END PRIVATE KEY-----',
		].join('\n');

		const body = '{"appid":"wxd678efh567hg6787","mchid":"1900007291","description":"Image形象店-深圳腾大-QQ公仔","out_trade_no":"1217752501201407033233368018","notify_url":"https://www.weixin.qq.com/wxpay/pay.php","amount":{"total":100,"currency":"CNY"},"payer":{"openid":"oUpF8uMuAJO_M2pxb1Q9zNjWeS6o"}}';

		const { authorization, message, signature } = buildWechatPayAuthorization(
			'POST',
			'https://api.mch.weixin.qq.com/v3/pay/transactions/jsapi',
			body,
			{
				mchid: '1900007291',
				serialNo: '408B07E79B8269FEC3D5D3E6AB8ED163A6A380DB',
				privateKey,
				nonceStr: '593BEC0C930BF1AFEB40B4A08C8FB242',
				timestamp: 1554208460,
			},
		);

		expect(message).toBe(
			'POST\n'
			+ '/v3/pay/transactions/jsapi\n'
			+ '1554208460\n'
			+ '593BEC0C930BF1AFEB40B4A08C8FB242\n'
			+ `${body}\n`
		);

		expect(authorization.startsWith('WECHATPAY2-SHA256-RSA2048 ')).toBe(true);
		expect(authorization).toContain('mchid="1900007291"');
		expect(authorization).toContain('nonce_str="593BEC0C930BF1AFEB40B4A08C8FB242"');
		expect(authorization).toContain('timestamp="1554208460"');
		expect(authorization).toContain('serial_no="408B07E79B8269FEC3D5D3E6AB8ED163A6A380DB"');

		// 文档示例签名较长，此处校验其前后缀，确保与示例数据匹配。
		expect(signature.startsWith('jnks4dlrPw3ZX+ozVvSK39oa0t7OMBsg83BHAwd8BRdU')).toBe(true);
		expect(signature.endsWith('8iqQzbpxOlEVoOe2kalSYM5kApQb3nZcxdUtoE0liJGW3RGUNE0t4v01A==')).toBe(true);
	});

});