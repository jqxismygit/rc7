import { describe, expect, it } from 'vitest';

import {
  buildXieChengRequest,
  buildXieChengSign,
  decryptXieChengBody,
  encryptXieChengBody,
} from '../src/libs/xiecheng.js';

describe('xiecheng api requests', () => {
  const accountId = 'xiecheng';
  const serviceName = 'DatePriceModify';
  const requestTime = '2017-01-05 10:00:00';
  const version = '1.0';
  const signKey = 'trip-sign-key';
  const aesKey = '1234567890abcdef';
  const aesIv = 'abcdef1234567890';

  const body = {
    sequenceId: '2017-10-10abcd95774f17c3e354e73f7aaf21b5ec',
    otaOptionId: 568898,
    supplierOptionId: '568898',
    dateType: 'DATE_REQUIRED',
    prices: [
      {
        date: '2018-12-12',
        salePrice: 120.0,
        costPrice: 100.0,
      },
    ],
  };

  const expectedPlainBody = JSON.stringify(body);
  const expectedEncryptedBody =
    'jjeifplihbnkginolgbhlfillllekkjfghidgkpcaoecjinhlobacaghgoafhhlhhmlglfnebnoanmfidbgghligmddpencjaoaghlhpdoimmheofhjgbbcjneolhpiobaaomfelfmlpefoonhkkbnkfafnlmblgddccobnnammpnbdlkogfffclkopfehljdobgbiaabpbghklglgnmiljlcppaobfdnnohcoaofichnikmhfkbjihcilplbonmdedccjbnkjnnljfbcikcifakhieokabohbnemgkglboeajiplhfbomnmidlaekgegdoococamiaecohplklapmcopkoocccabkilgkcgpffapgmejjlpnbpnedbkkboacfmedklehedcnjcpeeoibinfolbbldag';
  const expectedSign = '95aa5914312b45e10ee26f63616b0cf8';

  it('build xiecheng request payload with doc sample fields', () => {
    const result = buildXieChengRequest({
      accountId,
      serviceName,
      requestTime,
      version,
      signKey,
      aesKey,
      aesIv,
      body,
    });

    expect(result.plainBody).toBe(expectedPlainBody);
    expect(result.encryptedBody).toBe(expectedEncryptedBody);

    expect(result.sign).toBe(expectedSign);
    expect(result.payload).toEqual({
      header: {
        accountId,
        serviceName,
        requestTime,
        version,
        sign: expectedSign,
      },
      body: result.encryptedBody,
    });
  });

  it('build xiecheng sign and decode body', () => {
    const signResult = buildXieChengSign(expectedEncryptedBody, {
      accountId,
      serviceName,
      requestTime,
      version,
      signKey,
    });

    expect(signResult.message).toBe(
      `${accountId}${serviceName}${requestTime}`
      + expectedEncryptedBody
      + `${version}${signKey}`
    );
    expect(signResult.sign).toBe(expectedSign);

    const decryptedBody = decryptXieChengBody(expectedEncryptedBody, aesKey, aesIv);
    expect(decryptedBody).toBe(expectedPlainBody);

    expect(encryptXieChengBody(decryptedBody, aesKey, aesIv)).toBe(expectedEncryptedBody);
  });

});