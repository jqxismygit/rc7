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

});