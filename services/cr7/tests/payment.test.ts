import fs from 'node:fs';
import URL from 'node:url';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { buildWechatPayAuthorization, signPay } from '../src/libs/wechatpay.js';

const __dirname = URL.fileURLToPath(new URL.URL('.', import.meta.url));
const primary_key_fixture = fs.readFileSync(path.join(__dirname, './fixtures/wechatpay/apiclient_key.pem'), 'utf-8');


describe('wechat payment', () => {
	it('builds Authorization header with doc sample inputs', () => {
    const appid = 'wxd678efh567hg6787';
    const mchid = '1900007291';
    const openid = 'oUpF8uMuAJO_M2pxb1Q9zNjWeS6o';
    const nonceStr = '593BEC0C930BF1AFEB40B4A08C8FB242';
    const timestamp = 1554208460;
    const serialNo = '408B07E79B8269FEC3D5D3E6AB8ED163A6A380DB';
    const out_trade_no = '1217752501201407033233368018';
    const notify_url = 'https://www.weixin.qq.com/wxpay/pay.php';

		const body = `{"appid":"${appid}","mchid":"${mchid}","description":"Image形象店-深圳腾大-QQ公仔","out_trade_no":"${out_trade_no}","notify_url":"${notify_url}","amount":{"total":100,"currency":"CNY"},"payer":{"openid":"${openid}"}}`;

		const { authorization, message, signature } = buildWechatPayAuthorization(
			'POST',
			'https://api.mch.weixin.qq.com/v3/pay/transactions/jsapi',
			body,
			{
				mchid: mchid,
				serialNo: serialNo,
				privateKey: primary_key_fixture,
				nonceStr: nonceStr,
				timestamp: timestamp,
			},
		);

		expect(message).toBe(
			'POST\n'
			+ '/v3/pay/transactions/jsapi\n'
			+ `${timestamp}\n`
			+ `${nonceStr}\n`
			+ `${body}\n`
		);

		expect(authorization.startsWith('WECHATPAY2-SHA256-RSA2048 ')).toBe(true);
		expect(authorization).toContain(`mchid="${mchid}"`);
		expect(authorization).toContain(`nonce_str="${nonceStr}"`);
		expect(authorization).toContain(`timestamp="${timestamp}"`);
		expect(authorization).toContain(`serial_no="${serialNo}"`);

		// 文档示例签名较长，此处校验其前后缀，确保与示例数据匹配。
		expect(signature.startsWith('jnks4dlrPw3ZX+ozVvSK39oa0t7OMBsg83BHAwd8BRdU')).toBe(true);
		expect(signature.endsWith('8iqQzbpxOlEVoOe2kalSYM5kApQb3nZcxdUtoE0liJGW3RGUNE0t4v01A==')).toBe(true);
	});

	it('build paySign with doc sample inputs', () => {
		const appid = 'wx2421b1c4370ec43b';
		const prepay_id = 'wx201410272009395522657a690389285100';
		const timestamp = 1554208460;
		const nonceStr = '593BEC0C930BF1AFEB40B4A08C8FB242';

		const result = signPay(prepay_id, {
			appid,
			privateKey: primary_key_fixture,
			timestamp,
			nonceStr,
		});

		expect(result.timeStamp).toBe(String(timestamp));
		expect(result.nonceStr).toBe(nonceStr);
		expect(result.package).toBe(`prepay_id=${prepay_id}`);
		expect(result.signType).toBe('RSA');
		expect(result.message).toBe(
			`${appid}\n`
			+ `${timestamp}\n`
			+ `${nonceStr}\n`
			+ `prepay_id=${prepay_id}\n`
		);

		// 使用文档中的同一组 mock 数据验证签名结果。
		expect(result.paySign.startsWith('mI35pfNEQV6777ke/1T+LJLQDNTm7yeoUJH+j/adPGhmCCi0PbgkvYQTRcXH0uib')).toBe(true);
		expect(result.paySign.endsWith('KJ+qk5N61J7caYoepHFaxw==')).toBe(true);
	});
});