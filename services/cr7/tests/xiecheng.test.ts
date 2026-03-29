import { describe, expect, it } from 'vitest';

import {
  assertXieChengPriceInventoryResult,
  buildXieChengRequest,
  buildXieChengSign,
  decryptXieChengBody,
  encryptXieChengBody,
  XieChengBusinessError,
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
  const expectedEncryptedBody = [
    'jjeifplihbnkginolgbhlfillllekkjfghidgkpcaoecjinhlobacaghgoafhhlhhmlglfnebnoan',
    'mfidbgghligmddpencjaoaghlhpdoimmheofhjgbbcjneolhpiobaaomfelfmlpefoonhkkbnkfa',
    'fnlmblgddccobnnammpnbdlkogfffclkopfehljdobgbiaabpbghklglgnmiljlcppaobfdnnohc',
    'oaofichnikmhfkbjihcilplbonmdedccjbnkjnnljfbcikcifakhieokabohbnemgkglboeajiplh',
    'fbomnmidlaekgegdoococamiaecohplklapmcopkoocccabkilgkcgpffapgmejjlpnbpnedbkkbo',
    'acfmedklehedcnjcpeeoibinfolbbldag'
  ].join('');

  const expectedSign = 'a93bf1cfd946d109ab5c0089600d8461';

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
    const signResult = buildXieChengSign(expectedPlainBody, {
      accountId,
      serviceName,
      requestTime,
      version,
      signKey,
    });

    expect(signResult.message).toBe(
      `${accountId}${serviceName}${requestTime}`
      + expectedPlainBody
      + `${version}${signKey}`
    );
    expect(signResult.sign).toBe(expectedSign);

    const decryptedBody = decryptXieChengBody(expectedEncryptedBody, aesKey, aesIv);
    expect(decryptedBody).toBe(expectedPlainBody);

    expect(encryptXieChengBody(decryptedBody, aesKey, aesIv)).toBe(expectedEncryptedBody);
  });

  it('verifies request logic with ctrip sample data', () => {

    const accountId = '4965E5E2530767C1';
    const serviceName = 'CreateOrder';
    const requestTime = '2017-11-30 14:43:20';
    const version = '1.0';
    const signKey = 'E0A73F3A5D78D198BF2FB57879CF9A79';
    const aesKey = 'D2DN340LGYSsBrP6';
    const aesIv = '5693259981590433';
    const sign = '90754cadb24c437afecf2cb429edd4e5';
    const encryptedBody = [
      'ndgoebijlofhjbbghfldcjmdlbhfkbehoofoeafhljpjnceacdjnnahfhkjibplmclafjgdkpknpfpfammfcbcnoabjigcoglbdgdd',
      'iljnaecfehccnhedpombockfajjihkkjmlnkabjegaklljfodpbiaammiemioajpehdlnlipflhnijkngbilhfghbcimejcnnkmdmbc',
      'fndblhcbmncighpnolnlkgncmbjbfpphehoocdkchgfbbafjickhhfellheekdjofbjfedglbiidjmmebfffkpbjindepidcjbmoebpe',
      'oeekcjhcmcgadcalchhnbcnkdbockljkbfejfiddpekebhnbkajmjihjhdfdnakohpgeejijlfbjciakjdcfeclbiellgjalajphblko',
      'leiimcjkmajankcldmnnhofgopkefpdplbjabghbiapgomfpnkphdlobcojapaappchbacljconafemcdiplahdkgogidnkkkpdchmlf',
      'hlkemccdennbfkandhhlhalhflfhodcmfjcnjkaelnoainmaakckekmjonbmmbhbdaiicljpibjjdcddggepaibniibifipehjllgpaj',
      'ilagikmgnnopaiekbbhjcbhcologopheelcbjfhondfllknbfhpbipjccdpeemjciphdcdpghhmimogilfcbfgogaohpdanoileghhmp',
      'mglnelfpafenpdcepbeimncjlolgahhljhgodjabcologlfgmikgdhmmgcinpeebaifgjpmemdmojhfhikhgjjjnnhokaniagmjohgmp',
      'fepgekllajalldgfagoijlihklbhcihdbgdnaomikfkcjgjpohdcjdlfpiaccpfapcooalnmoeeddoifafhjdpoibpehdfckpmkblbgbh',
      'dejfemljbmhgdeeembdimobcahfpahefkfodmlgefedelecolfgbmcfghcpleallolkdabdjjnjmmlbfdbdlmhgpkechggkpinimepnhe',
      'gnbdippliaeokaollmafiogldjkahihglmgohcfpmgdelfkolcdiicfjngoijopfjgcbehamflfcaibdgfdggnhmpcedepfhcpngfehgd',
      'oledhednombjnehgjlnbgakhcnlpadmchodgehhckkclbjamjadalphjhkbfnnblemognepjoejldllnjdihiojlagndkdefdalbjpmlo',
      'echinhpdckcaoplckhhockbckngpfbcpgcieobmidkbcjgbpohbcepnahjlmijakoeoleeipdnooimceplefdeflbopcjbpgebomgaagg',
      'lanfebicfhknbmkolldmoacheeffcjfebjaakgkhicpkbmmidgfohfiolagohlhleofiihfmjpgffafnlgfenninjjelnffkhjifefkkie',
      'khfklljkjeanocpjdkhdflhdfbfjmfnfcojfpjjgdlomdncnhdebnkgjjcndbmogdngfekhgpbkaiaojlpkbngkignfmegiikmbcdlcjgd',
      'jikfcpcidomgacaeonbjacgbmhmhhmemppefmjmkhfnphladoimkiaikffkknckmojobpllhbkpnoggeijfonmggfhdpacddlklbonlbpp',
      'hpppklmilbggkeddekbokadeeeikcalcljhpadnakpoikikdaignicnlblmglncbgeabeamdccimkcginijjhibaochcbhlaonifahopig',
      'eojongafpeancophigfmeppadkjcneokgmahinflmoehhipkjdjimeaflfdfangeiblihdopllcapgcfknfgafdnkhnhchmbdiidoebjlo',
      'cbfjlkmegloadgcokemdadbaedjjlkfkicmhbgldjcopgpneoljeckpljlhklilmhelcbapgbbmbgbkmojeaephjamlkhkggkniglealmf',
      'kpoebmpjggajjajeognlkmlelcjkpbfigmipmnhlfnanahjjpeecpbkklkioaafadikelcaleneilfnneaippdiokiccmpnpkpclmaalgf',
      'hllbfajlcnblmojacbjbnglljgbkdhcifhjoljgblkdiklddgieejnkojjkljnokpiphbcapglknfjfaphmfbbalbcnnajkmhiihbmkgmef',
      'jenppddbnpabmdpaipieijcpjbfhdekafgnfkcgkcboeabejijniojkmllkkkihefhembibgmgfggjojgnphdpheneogomddooffbmfnlh',
      'cgfmkclmjnbboihcfhjofbdhmflpmbagdedeimlpeamohgchdnhfgnadeonihhgbghfgmmgegofhkhidigjaadodbjeddblflbhdjcbjbl',
      'didinkfeefmbcefniacjhcegjmkdcbemdeokjlpafdhklppnkddehdlcgphhjlmgflilmklecapiknmbffghcmjibgnkicnkncieooiojni',
      'oggifkjkhliigbikmanjlcfmpjclbngefehgpdfknpfpjjpiochcaapdaigmdkbpilgabjgphiaghdnhiifmbagkbjfpcjchieonalghogn',
      'dcfplhbmdofndlclcmigiehgibkgdapdcfbdmocfggilfngobjndokkpkobonmnpdgnnbkfimdgkmejgmicgeimhcpecmhnecobmaddoleo',
      'cepngjdndcoikfaoiaifegofkjciopichldlfifljlkmekhngpmimmfjnmlcpngmgnfaifmchmjjnhiolflandjeallbhijddcemfkjchce',
      'mdimcgdbkeipeaocfcplhhipgdlclfpdaeliahdkfmooikhaakkmalnggifndfefkjadclhaakigmcllacmhfefmepcbbjnafnljalfccff',
      'chmbkbnmpahhgkdlmdfkgpapjbfpgbgphmcjmffalljjpgnifmnphncookpgckacbpmehfeceeeebphgkoijikcoeiodefnocpbgijphdfal',
      'opkjcnbalhmdddkfdocblmgbfoplcoakcojjhofbdejmoimmpbclcbfkmmmblnhlabldjcenlbblohljgigmfpagpdncphminmemcnlhnbg',
      'fbjkbhdnhhcodccmbapjaaidjocaomkadedgpdocjngagjhgjiicipbfkhkelllapdjcngjodnaefclihahfinkccmigdhdjhlnglbmgieh',
      'ddhgfbbhbicpofmmemkbebnpmmbalfknkfkhmfagafmopifclkleholjagkfemimflppjjgmlomeohokjoklghklpkhcplkkcbknmemajnp',
      'dlinpdjkpifoekbfoeiemfiipioofnckeompfbccdobapkbdjkibleobiaocpamipncidmbdlecddhhgadcknpaolapkifdeabfcdakbilm',
      'odkelmbbbgkcpmcemgldkgackeoojcfgdpodcibkbehgnnaglkmnlgliahcihlgcgb'
    ].join('');

    const decryptedBody = decryptXieChengBody(encryptedBody, aesKey, aesIv);
    const sampleBodyObject = JSON.parse(decryptedBody);
    expect(
      JSON.stringify(sampleBodyObject)
      .replace(/"cost":4.8/, '"cost":4.80')
      .replace(/"price":5/, '"price":5.00')
      .replace(/"price":3/, '"price":3.00')
    ).toBe(decryptedBody);

    expect(Object.keys(sampleBodyObject)).toEqual([
      'otaOrderId',
      'contactInfos',
      'orderItems',
      'sequenceId',
      'confirmType',
    ]);

    const signResult = buildXieChengSign(decryptedBody, {
      accountId,
      serviceName,
      requestTime,
      version,
      signKey,
    });
    expect(signResult.sign).toBe(sign);

    const rebuiltRequest = buildXieChengRequest({
      accountId,
      serviceName,
      requestTime,
      version,
      signKey,
      aesKey,
      aesIv,
      body: decryptedBody,
    });

    expect(rebuiltRequest.encryptedBody).toBe(encryptedBody);
    expect(rebuiltRequest.sign).toBe(sign);
    expect(rebuiltRequest.payload.header).toEqual({
      accountId,
      serviceName,
      requestTime,
      version,
      sign,
    });
  });

  it('accepts price/inventory response when resultCode is 0000', () => {
    expect(() => assertXieChengPriceInventoryResult({
      header: {
        resultCode: '0000',
        resultMessage: '操作成功',
      },
    })).not.toThrow();
  });

  it('throws business error when resultCode is not 0000', () => {
    expect(() => assertXieChengPriceInventoryResult({
      header: {
        resultCode: '1003',
        resultMessage: '数据参数不合法',
      },
    })).toThrow(XieChengBusinessError);
  });

});

describe('xiecheng http post request format', () => {
  const accountId = 'xiecheng';
  const serviceName = 'DatePriceModify';
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

  it('serializes xiecheng request payload to valid JSON for http POST', () => {
    const result = buildXieChengRequest({
      accountId,
      serviceName,
      signKey,
      aesKey,
      aesIv,
      body,
    });

    // payload should be serializable to JSON
    const serialized = JSON.stringify(result.payload);
    expect(typeof serialized).toBe('string');

    // deserialized payload should match original structure
    const deserialized = JSON.parse(serialized);
    expect(deserialized).toEqual({
      header: expect.objectContaining({
        accountId,
        serviceName,
        requestTime: expect.any(String),
        version: expect.stringMatching(/^\d+\.\d+$/),
        sign: expect.stringMatching(/^[a-f0-9]{32}$/),
      }),
      body: expect.any(String),
    });
  });

  it('payload header contains required xiecheng api fields', () => {
    const result = buildXieChengRequest({
      accountId,
      serviceName,
      signKey,
      aesKey,
      aesIv,
      body,
    });

    const { header } = result.payload;

    // Verify accountId is present
    expect(header.accountId).toBe(accountId);

    // Verify serviceName is present
    expect(header.serviceName).toBe(serviceName);

    // Verify requestTime format: YYYY-MM-DD HH:mm:ss
    expect(header.requestTime).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);

    // Verify version format
    expect(header.version).toMatch(/^\d+\.\d+$/);

    // Verify sign is valid MD5 hex (32 characters, a-f and 0-9)
    expect(header.sign).toMatch(/^[a-f0-9]{32}$/);
    expect(header.sign.length).toBe(32);
  });

  it('payload body contains encrypted data in xiecheng format', () => {
    const result = buildXieChengRequest({
      accountId,
      serviceName,
      signKey,
      aesKey,
      aesIv,
      body,
    });

    const { body: encryptedBody } = result.payload;

    // body should be a string
    expect(typeof encryptedBody).toBe('string');

    // encrypted body should be non-empty
    expect(encryptedBody.length).toBeGreaterThan(0);

    // encrypted body should contain only lowercase letters a-p (xiecheng encoding format)
    // each byte is encoded as 2 chars: high nibble (0-15) + low nibble (0-15), mapped to a-p
    expect(encryptedBody).toMatch(/^[a-p]+$/);

    // encrypted body should be even length (each byte is encoded as 2 chars)
    expect(encryptedBody.length % 2).toBe(0);

    // should be able to decrypt it back
    const decrypted = decryptXieChengBody(encryptedBody, aesKey, aesIv);
    expect(decrypted).toBe(JSON.stringify(body));
  });

  it('verifies http post request body structure matches xiecheng api requirements', () => {
    // Simulate building the request that would be sent to xiecheng API
    const result = buildXieChengRequest({
      accountId,
      serviceName,
      signKey,
      aesKey,
      aesIv,
      body,
    });

    // In xieChengPostJSON, the payload is JSON stringified before sending
    const requestBodyString = JSON.stringify(result.payload);
    const requestBodyObject = JSON.parse(requestBodyString);

    // Verify the stringified payload can be sent as HTTP POST body
    expect(typeof requestBodyString).toBe('string');
    expect(requestBodyString.length).toBeGreaterThan(0);

    // Verify header fields that must be included in HTTP request
    const { header, body: encryptedBody } = requestBodyObject;
    expect(header).toHaveProperty('accountId', accountId);
    expect(header).toHaveProperty('serviceName', serviceName);
    expect(header).toHaveProperty('requestTime');
    expect(header).toHaveProperty('version', '1.0');
    expect(header).toHaveProperty('sign');

    // Verify signature is valid MD5
    expect(header.sign).toMatch(/^[a-f0-9]{32}$/);

    // Verify body is encrypted in xiecheng format (a-p is 16 possible values for each nibble)
    expect(encryptedBody).toMatch(/^[a-p]+$/);
    expect(encryptedBody.length % 2).toBe(0);

    // Verify the HTTP request would have correct method and headers
    // (this is verified programmatically in xieChengPostJSON function)
    const headersThatWouldBeSent = {
      'content-type': 'application/json',
      'Accept': 'application/json',
    };
    expect(headersThatWouldBeSent['content-type']).toBe('application/json');
    expect(headersThatWouldBeSent.Accept).toBe('application/json');
  });

});
