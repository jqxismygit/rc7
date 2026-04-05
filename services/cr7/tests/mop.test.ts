import { describe, expect, it } from 'vitest';

import {
	buildMopResponseSign,
	buildMopRequest,
	buildMopSign,
	decryptMopData,
	encryptMopData,
	parseMopResponseData,
	verifyMopSign,
} from '../src/libs/mop.js';

describe('mop api requests', () => {
	const supplier = 'S_001';
	const timestamp = '2024-09-03 11:45:01';
	const version = '1.0.1';
	const uri = '/supply/open/mop/test/project';
	const aesKey = 'PCOnnpSKl3op+ROVAltmwHuyYBcQEhy0';

	const privateKey = [
		'MIICdwIBADANBgkqhkiG9w0BAQEFAASCAmEwggJdAgEAAoGBALj9k0FopE4wNDsD',
		'0GJeJHAG9VqoxjLB0zsU2jSdgQsTekyx1KBHRl8Q1pffBwhy5QLGQM+y2kUy1TZ+',
		'IF/scgQstL3yrDL4CTU7JGhB+7qw+JJ3oqvPfh7Qf2bQa+qRwQynddRx52MKdUUr',
		'wAIuE4pPAbnTQbmKg7O6Yn9EeHFDAgMBAAECgYAIrgUxxXooHQTmW/h0FRy6kOkE',
		'NvUNvqBtnj3ayCUc4u4TGSjz2ERKA50+BP3sfI+YQLsbw7WQF6F/bA2S0qJK0TTH',
		'kwap4OeWA1fUhlB+9KkjMji7JY7YWZegBs3ecsULm6sMYnN6BbyEjki8TCrdHgul',
		'J09TR5E0TiG+B7Pk2QJBAPxdmNm7JrKUvYxgdqutLUO60xozZptRHhK/1JpxdRvC',
		'a33VHy1ZIDWLBebajOgEvFY/LoJhTqntmvVedseuMt8CQQC7p5WrnKNo4bN2qqVm',
		'RMoauw3CLPiWf0N5EUXqj4rNs4E3udiGa2wbYnBSMUCVTOMKwxxC7wVRmi/Na5XP',
		'9xIdAkEAiZ0cUXZtZqoXJmofrAP2D93baYkn5X/5Ty4N594Ahw+gf/BsXNUh7DCQ',
		'Gk+I0KhsbvdrDCu1spHfkvdc/AvwrwJAESj1BdlwFAI3sA1QzLZTqPgb/PqxzMlc',
		'eTC8LQPtVHwqv9bN1xTxsNtinBGG72A1juFirzg+S0UHRAinjXnxfQJBAMqkjgWg',
		'iisGqJBa4FJKaCiQcd6mkwcEcsnHyZQwwThDnKO7B1bidrR/vTNbXtOqaIp8xSD1',
		'+Lr8g7aemcG2Mzw=',
	].join('');

	const publicKey = [
		'MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC4/ZNBaKROMDQ7A9BiXiRwBvVa',
		'qMYywdM7FNo0nYELE3pMsdSgR0ZfENaX3wcIcuUCxkDPstpFMtU2fiBf7HIELLS9',
		'8qwy+Ak1OyRoQfu6sPiSd6Krz34e0H9m0GvqkcEMp3XUcedjCnVFK8ACLhOKTwG5',
		'00G5ioOzumJ/RHhxQwIDAQAB',
	].join('');

	const body = {
		projectName: '笑傲江湖',
		cityName: '上海',
	};

	const expectedPlainData = JSON.stringify(body);
	const expectedEncryptData = 'g9rSiAwzoz88L5CdaUmcri/uNMTWLho1ulhUyiwfBNy2Lo+hkKPC8XvjJFQKR/9tg0TDD38C7R6s0+tpgxzVUw==';
	const expectedSign = 'NEbQhpw2D0z3KLrw7pbrbDiF+Mm8OqjCFpkeqxOW+3TpBPxYJ18intY6rpoSG6ALYMkPFmYn9IwG6tDlfm1LJk3JJQK3e8kSNTmY5TndP6cIO/nb7jdhXDkSy1s5/8PCh5YNa4h281rZGyQttundWgJU/Wpnn75aX/5y64T1NQA=';
	const responseTimestamp = '2024-09-03 11:45:02';
	const responseEncryptData = 'g9rSiAwzoz88L5CdaUmcrsveiazar3icCx1/1MiJkNdbjQpFtMMQAELqs/Mm98C3g0TDD38C7R6s0+tpgxzVUw==';

	it('build mop request payload with doc sample fields', () => {
		const result = buildMopRequest({
			supplier,
			timestamp,
			version,
			uri,
			aesKey,
			privateKey,
			body,
		});

		expect(result.plainData).toBe(expectedPlainData);
		expect(result.encryptData).toBe(expectedEncryptData);
		expect(result.sign).toBe(expectedSign);
		expect(result.signUri).toBe('/mop/test/project');

		expect(result.headers).toEqual({
			supplier,
			timestamp,
			version,
			sign: expectedSign,
		});

		expect(result.payload).toEqual({
			encryptData: expectedEncryptData,
		});
	});

	it('encrypt/decrypt business data with doc sample key', () => {
		expect(encryptMopData(expectedPlainData, aesKey)).toBe(expectedEncryptData);
		expect(decryptMopData(expectedEncryptData, aesKey)).toBe(expectedPlainData);
	});

	it('build and verify rsa sign with doc sample keys', () => {
		const signResult = buildMopSign(uri, {
			supplier,
			timestamp,
			version,
			privateKey,
		});

		expect(signResult.signUri).toBe('/mop/test/project');
		expect(signResult.message).toBe(`${supplier}${timestamp}${version}/mop/test/project`);
		expect(signResult.sign).toBe(expectedSign);

		const verified = verifyMopSign(expectedSign, uri, {
			supplier,
			timestamp,
			version,
			publicKey,
		});
		expect(verified).toBe(true);
	});

	it('verifies and decrypts doc response sample in section 1.6.4', () => {
		const responseSign = buildMopResponseSign({
			code: 1000,
			timestamp: responseTimestamp,
			privateKey,
		}).sign;

		const result = parseMopResponseData<{ projectName: string; cityName: string }>({
			code: 1000,
			timestamp: responseTimestamp,
			msg: '成功',
			sign: responseSign,
			encryptData: responseEncryptData,
		}, {
			aesKey,
			publicKey,
			verifySign: true,
		});

		expect(result.envelope.code).toBe(1000);
		expect(result.envelope.timestamp).toBe(responseTimestamp);
		expect(result.envelope.sign).toBe(responseSign);
		expect(result.rawData).toBe('{"projectName":"天龙八部","cityName":"北京"}');
		expect(result.data).toEqual({
			projectName: '天龙八部',
			cityName: '北京',
		});
	});
});