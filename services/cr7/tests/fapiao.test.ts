import { describe, expect, it } from 'vitest';

import {
  buildFapiaoRequest,
  encodeFapiaoContent,
  encryptFapiaoContentKey,
  parseFapiaoResponse,
  sha256FapiaoContent,
} from '../src/libs/fapiao.js';

describe('fapiao api request/response codec', () => {
  const appId = 'c288b35967a9a36fc897e89b01805451110d88507ce1aa1ab31756d872504767';
  const secret = '80AB94991453FA0D';
  const interfaceCode = 'GP_FPKJ';
  const requestTime = '2024-01-02 11:22:33';
  const dataExchangeId = 'DZFPQZGP_FPKJ20240102123456789';

  const requestContent = {
    REQUEST_COMMON_FPKJ: {
      NSRSBH: '110109500321668',
      SBLX: '5',
      SBBH: '214324531769',
      FPQQLSH: 'TEST2024010211223301',
      ZSFS: '0',
      KPLX: '0',
      BMB_BBH: '32.0',
      FPLXDM: '026',
      XSF_NSRSBH: '110109500321668',
      XSF_MC: '新税控测试1668',
      XSF_DZDH: '南山区蛇口、83484949',
      XSF_YHZH: 'xx银行、88888888888',
      GMF_NSRSBH: '',
      GMF_MC: '张三',
      GMF_DZDH: '购买方地址、电话',
      GMF_YHZH: '购买方银行账号',
      GMF_SJH: '',
      GMF_DZYX: '',
      FPT_ZH: '',
      WX_OPENID: '',
      KPR: '开票人',
      SKR: '收款人',
      FHR: '复核人',
      YFP_DM: '',
      YFP_HM: '',
      JSHJ: '113',
      HJJE: '100',
      HJSE: '13',
      KCE: '',
      BZ: 'json测试开票备注',
      HYLX: '',
      BY1: '',
      BY2: '',
      BY3: '',
      BY4: '',
      BY5: '',
      BY6: '',
      BY7: '',
      BY8: '',
      BY9: '',
      BY10: '',
      WX_ORDER_ID: '',
      WX_APP_ID: '',
      ZFB_UID: '',
      COMMON_FPKJ_XMXX: [
        {
          FPHXZ: '0',
          SPBM: '1010101050000000000',
          ZXBM: '',
          YHZCBS: '',
          LSLBS: '',
          ZZSTSGL: '',
          XMMC: '红高粱',
          GGXH: '500克',
          DW: '袋',
          XMSL: '1',
          XMDJ: '50',
          XMJE: '50',
          SL: '0.13',
          SE: '6.5',
          BY1: '',
          BY2: '',
          BY3: '',
          BY4: '',
          BY5: '',
        },
        {
          FPHXZ: '0',
          SPBM: '1010101010000000000',
          ZXBM: '',
          YHZCBS: '',
          LSLBS: '',
          ZZSTSGL: '',
          XMMC: '东北大米',
          GGXH: '500克',
          DW: '袋',
          XMSL: '1',
          XMDJ: '50',
          XMJE: '50',
          SL: '0.13',
          SE: '6.5',
          BY1: '',
          BY2: '',
          BY3: '',
          BY4: '',
          BY5: '',
        },
      ],
      CALLBACK_URL: '',
      LSH: '',
    },
  };

  const expectedContent = 'eyJSRVFVRVNUX0NPTU1PTl9GUEtKIjp7Ik5TUlNCSCI6IjExMDEwOTUwMDMyMTY2OCIsIlNCTFgiOiI1IiwiU0JCSCI6IjIxNDMyNDUzMTc2OSIsIkZQUVFMU0giOiJURVNUMjAyNDAxMDIxMTIyMzMwMSIsIlpTRlMiOiIwIiwiS1BMWCI6IjAiLCJCTUJfQkJIIjoiMzIuMCIsIkZQTFhETSI6IjAyNiIsIlhTRl9OU1JTQkgiOiIxMTAxMDk1MDAzMjE2NjgiLCJYU0ZfTUMiOiLmlrDnqI7mjqfmtYvor5UxNjY4IiwiWFNGX0RaREgiOiLljZflsbHljLrom4flj6PjgIE4MzQ4NDk0OSIsIlhTRl9ZSFpIIjoieHjpk7booYzjgIE4ODg4ODg4ODg4OCIsIkdNRl9OU1JTQkgiOiIiLCJHTUZfTUMiOiLlvKDkuIkiLCJHTUZfRFpESCI6Iui0reS5sOaWueWcsOWdgOOAgeeUteivnSIsIkdNRl9ZSFpIIjoi6LSt5Lmw5pa56ZO26KGM6LSm5Y+3IiwiR01GX1NKSCI6IiIsIkdNRl9EWllYIjoiIiwiRlBUX1pIIjoiIiwiV1hfT1BFTklEIjoiIiwiS1BSIjoi5byA56Wo5Lq6IiwiU0tSIjoi5pS25qy+5Lq6IiwiRkhSIjoi5aSN5qC45Lq6IiwiWUZQX0RNIjoiIiwiWUZQX0hNIjoiIiwiSlNISiI6IjExMyIsIkhKSkUiOiIxMDAiLCJISlNFIjoiMTMiLCJLQ0UiOiIiLCJCWiI6Impzb27mtYvor5XlvIDnpajlpIfms6giLCJIWUxYIjoiIiwiQlkxIjoiIiwiQlkyIjoiIiwiQlkzIjoiIiwiQlk0IjoiIiwiQlk1IjoiIiwiQlk2IjoiIiwiQlk3IjoiIiwiQlk4IjoiIiwiQlk5IjoiIiwiQlkxMCI6IiIsIldYX09SREVSX0lEIjoiIiwiV1hfQVBQX0lEIjoiIiwiWkZCX1VJRCI6IiIsIkNPTU1PTl9GUEtKX1hNWFgiOlt7IkZQSFhaIjoiMCIsIlNQQk0iOiIxMDEwMTAxMDUwMDAwMDAwMDAwIiwiWlhCTSI6IiIsIllIWkNCUyI6IiIsIkxTTEJTIjoiIiwiWlpTVFNHTCI6IiIsIlhNTUMiOiLnuqLpq5jnsrEiLCJHR1hIIjoiNTAw5YWLIiwiRFciOiLooosiLCJYTVNMIjoiMSIsIlhNREoiOiI1MCIsIlhNSkUiOiI1MCIsIlNMIjoiMC4xMyIsIlNFIjoiNi41IiwiQlkxIjoiIiwiQlkyIjoiIiwiQlkzIjoiIiwiQlk0IjoiIiwiQlk1IjoiIn0seyJGUEhYWiI6IjAiLCJTUEJNIjoiMTAxMDEwMTAxMDAwMDAwMDAwMCIsIlpYQk0iOiIiLCJZSFpDQlMiOiIiLCJMU0xCUyI6IiIsIlpaU1RTR0wiOiIiLCJYTU1DIjoi5Lic5YyX5aSn57GzIiwiR0dYSCI6IjUwMOWFiyIsIkRXIjoi6KKLIiwiWE1TTCI6IjEiLCJYTURKIjoiNTAiLCJYTUpFIjoiNTAiLCJTTCI6IjAuMTMiLCJTRSI6IjYuNSIsIkJZMSI6IiIsIkJZMiI6IiIsIkJZMyI6IiIsIkJZNCI6IiIsIkJZNSI6IiJ9XSwiQ0FMTEJBQ0tfVVJMIjoiIiwiTFNIIjoiIn19';
  const expectedContentKey = 'BaA4ZFCAveNNaSG3uNxy0EVgJM0bjUbTahffbgK27gR5zyxG/uiFRGPrcBsCY29FJE+ako6gpTptEqjutTb8K2sVbx18OYy0+Y8Hazv6dKA=';

  it('builds request payload consistent with python sample fields', () => {
    const result = buildFapiaoRequest({
      appId,
      secret,
      interfaceCode,
      requestTime,
      requestCode: 'DZFPQZ',
      dataExchangeId,
      content: requestContent,
    });

    expect(result.encodedContent).toBe(expectedContent);
    expect(result.contentKey).toBe(expectedContentKey);
    expect(result.contentSha256).toBe(sha256FapiaoContent(expectedContent));

    expect(result.payload.interface.globalInfo).toEqual({
      appId,
      interfaceId: '',
      interfaceCode,
      requestCode: 'DZFPQZ',
      requestTime,
      responseCode: 'DS',
      dataExchangeId,
    });
    expect(result.payload.interface.data).toEqual({
      dataDescription: { zipCode: '0' },
      content: expectedContent,
      contentKey: expectedContentKey,
    });
  });

  it('decodes response content and validates contentKey', () => {
    const responseBusiness = {
      CODE: '0000',
      MESSAGE: '成功',
      FPQQLSH: 'TEST2024010211223301',
      FPLXDM: '026',
      FP_HM: '17083768',
    };

    const responseContent = encodeFapiaoContent(responseBusiness);
    const responseContentKey = encryptFapiaoContentKey(sha256FapiaoContent(responseContent), secret);

    const parsed = parseFapiaoResponse<typeof responseBusiness>({
      interface: {
        globalInfo: {
          appId,
          interfaceId: '',
          interfaceCode,
          requestCode: 'DZFPQZ',
          requestTime,
          responseCode: 'DS',
          dataExchangeId,
        },
        returnStateInfo: {
          returnCode: '0000',
          returnMessage: '处理成功',
        },
        data: {
          dataDescription: { zipCode: '0' },
          content: responseContent,
          contentKey: responseContentKey,
        },
      },
    }, {
      secret,
    });

    expect(parsed.returnCode).toBe('0000');
    expect(parsed.returnMessage).toBe('处理成功');
    expect(parsed.decodedContent).toEqual(responseBusiness);
  });

  it('throws when response contentKey check fails', () => {
    const responseContent = encodeFapiaoContent({ CODE: '0000' });

    expect(() => parseFapiaoResponse({
      interface: {
        globalInfo: {
          appId,
          interfaceId: '',
          interfaceCode,
          requestCode: 'DZFPQZ',
          requestTime,
          responseCode: 'DS',
          dataExchangeId,
        },
        returnStateInfo: {
          returnCode: '0000',
          returnMessage: '处理成功',
        },
        data: {
          dataDescription: { zipCode: '0' },
          content: responseContent,
          contentKey: 'broken-content-key',
        },
      },
    }, { secret })).toThrow(/contentKey/);
  });
});
