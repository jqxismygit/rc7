import {
  describeFeature,
  FeatureDescriibeCallbackParams,
  loadFeature,
  StepTest,
} from '@amiceli/vitest-cucumber';
import { Server } from 'node:http';
import config from 'config';
import { isSameDay } from 'date-fns';
import { ServiceBroker } from 'moleculer';
import { expect, vi } from 'vitest';
import { Exhibition, Invoice, Order, Payment, Redeem, User } from '@cr7/types';
import { Text2Date, toDateLabel } from './lib/relative-date.js';
import { prepareAPIServer, prepareServices } from './fixtures/services.js';
import { prepareAdminToken } from './fixtures/user.js';
import { setupWechatFixture, WechatFixture } from './fixtures/wechat.js';
import { getSessions, prepareExhibition, prepareTicketCategory } from './fixtures/exhibition.js';
import { updateTicketCategoryMaxInventory } from './fixtures/inventory.js';
import { createOrder, getOrder } from './fixtures/order.js';
import {
  applyOrderInvoice,
  listInvoiceApplications,
} from './fixtures/invoice.js';
import { getOrderRedemption, redeemCode } from './fixtures/redeem.js';
import {
  markOrderAsPaidForTest, requestRefundWithMock, sendMockRefundCallback
} from './fixtures/payment.js';
import { bootstrap, dropSchema, migrate } from '@/scripts/index.js';
import {
  decodeFapiaoContent,
  encodeFapiaoContent,
  encryptFapiaoContentKey,
  FapiaoEnvelope,
  sha256FapiaoContent,
} from '@/libs/fapiao.js';
import { MockServer, mockJSONServer } from './lib/server.js';

const schema = 'test_fapiao';
const services = ['api', 'user', 'cr7'];

const feature = await loadFeature('tests/features/fapiao.feature');

type ExhibitionContext = {
  exhibition: Exhibition.Exhibition;
  sessions: Exhibition.Session[];
  ticketByName: Record<string, Exhibition.TicketCategory>;
};

type OrderContext = {
  order: Order.OrderWithItems;
};

type FapiaoScenarioContext = {
  fapiaoEnvelope: FapiaoEnvelope;
  fapiaoRequestData: Record<string, unknown>;
  listResult: Invoice.InvoiceListResult;
};

interface FapiaoResponse {
  CODE: string;
  MESSAGE: string;
  DATA: {
    FPQQLSH: string;
    PDF_URL: string;
    FP_HM: string;
  };
};

interface CreateFapiaoContext {
  fapiaoMockServer: MockServer;
  fapiaoBaseUrlSpy: { mockRestore: () => void };
  fapiaoRequestHandler: ReturnType<typeof vi.fn>;
  fapiaoResponse: FapiaoResponse;
  fapiaoResponseResolver: (args: unknown) => void;
  applyInvoicePromise?: Promise<Invoice.InvoiceRecord>;
  invoiceRes: Invoice.InvoiceRecord;
}

interface ListFapiaoContext {
  fapiaoList: Invoice.InvoiceListResult;
}

interface FeatureContext extends
  ExhibitionContext,
  OrderContext,
  Partial<CreateFapiaoContext>,
  Partial<ListFapiaoContext>,
  Partial<FapiaoScenarioContext> {
  broker: ServiceBroker;
  apiServer: Server;
  wechatFixture: WechatFixture;
  adminToken: string;
  userToken: string;
  userProfile: User.Profile;
}

describeFeature(feature, ({
  BeforeAllScenarios,
  AfterAllScenarios,
  AfterEachScenario,
  Background,
  defineSteps,
  Scenario,
  context: featureContext,
}: FeatureDescriibeCallbackParams<FeatureContext>) => {
  BeforeAllScenarios(async () => {
    vi.spyOn(config.pg, 'schema', 'get').mockReturnValue(schema);
    await bootstrap();
    const broker = await prepareServices(services);
    await broker.start();
    featureContext.broker = broker;
    featureContext.apiServer = await prepareAPIServer(broker);
    featureContext.wechatFixture = await setupWechatFixture();
    featureContext.ticketByName = {};
  });

  AfterAllScenarios(async () => {
    if (featureContext.broker) {
      await featureContext.broker.stop();
    }
    await featureContext.wechatFixture.close();
    vi.restoreAllMocks();
  });

  AfterEachScenario(async () => {
    await featureContext.fapiaoMockServer?.close();
    featureContext.fapiaoBaseUrlSpy?.mockRestore();
    await dropSchema({ schema });
  });

  defineSteps(({ Given, When, Then, And }) => {
    Given('用户预订 {number} 张该展会的 {string} 场次的 {string}', async (_ctx, quantity: number, sessionDate: string, ticketName: string) => {
      const ticket = featureContext.ticketByName[ticketName];
      const session = featureContext.sessions.find(item => isSameDay(item.session_date, Text2Date(sessionDate)))!;

      featureContext.order = await createOrder(
        featureContext.apiServer,
        featureContext.exhibition.id,
        session.id,
        [{ ticket_category_id: ticket.id, quantity }],
        featureContext.userToken,
      );
    });

    Given('订单状态为待支付', () => {
      expect(featureContext.order!.status).toBe('PENDING_PAYMENT');
    });

    When('用户发起并完成微信支付', async () => {
      await markOrderAsPaidForTest(
        featureContext.apiServer,
        featureContext.userToken,
        featureContext.order!,
        featureContext.userProfile.openid!,
      );
      featureContext.order = await getOrder(
        featureContext.apiServer,
        featureContext.order!.id,
        featureContext.userToken,
      );
    });

    Then('订单状态为已支付', async () => {
      const { apiServer, userToken } = featureContext;
      const orderId = featureContext.order!.id;
      const order = await getOrder(apiServer, orderId, userToken);
      expect(order.status).toBe('PAID');
      featureContext.order = order;
    });

    When(
      '用户申请该订单的发票，发票抬头为 {string}，税号为 {string}, 邮箱为 {string}',
      (_ctx, invoiceTitle: string, taxNo: string, email: string) => {
        featureContext.applyInvoicePromise = applyOrderInvoice(
          featureContext.apiServer,
          featureContext.order.id,
          {
            invoice_title: invoiceTitle,
            tax_no: taxNo,
            email,
          },
          featureContext.userToken,
        );
      });

    Then('发票服务接收到发票开具请求, 可以正常解密出发票申请信息', async () => {
      await vi.waitFor(() => {
        expect(featureContext.fapiaoRequestHandler).toHaveBeenCalled();
      });

      const requestArg = featureContext.fapiaoRequestHandler!.mock.calls.at(-1)?.[0];
      const fapiaoEnvelope = requestArg!.body as FapiaoEnvelope;
      featureContext.fapiaoEnvelope = fapiaoEnvelope;

      const decodedContent = decodeFapiaoContent(fapiaoEnvelope.interface.data.content);
      const requestContent = JSON.parse(decodedContent) as Record<string, unknown>;
      featureContext.fapiaoRequestData = requestContent.REQUEST_COMMON_FPKJ as Record<string, unknown>;
      expect(featureContext.fapiaoRequestData).toBeTruthy();
    });

    Given('发票平台返回发票开具成功的响应， 值为 {string}', (_ctx, code: string) => {
      featureContext.fapiaoResponse = {
        CODE: code,
        MESSAGE: '成功',
        DATA: {
          FPQQLSH: 'TEST_SEQUENCE_ID',
          PDF_URL: 'https://example.com/invoice.pdf',
          FP_HM: 'fapiao1234567890',
        },
      };
    });

    And('发票开具结果中流水号是 cr7 生成的流水号', () => {
      const { fapiaoRequestData, fapiaoResponse } = featureContext;
      fapiaoResponse!.DATA.FPQQLSH = fapiaoRequestData!.FPQQLSH as string;
    });

    When('发票服务返回开具结果给 cr7', async () => {
      const { fapiaoResponseResolver, fapiaoResponse, applyInvoicePromise } = featureContext;
      fapiaoResponseResolver?.(fapiaoResponse);
      featureContext.invoiceRes = await applyInvoicePromise!;
    });

    When('用户查看发票申请列表', async () => {
      featureContext.fapiaoList = await listInvoiceApplications(
        featureContext.apiServer,
        featureContext.userToken,
      );
    });

    Then('发票申请列表有 {number} 条记录', (_ctx, count: number) => {
      expect(featureContext.fapiaoList!.items.length).toBe(count);
    });

    And('该记录的订单 ID 是用户预订的订单 ID', () => {
      const [first] = featureContext.fapiaoList!.items;
      expect(first.order_id).toBe(featureContext.order.id);
    });
  });

  Background(({ Given, And }) => {
    Given('cr7 服务已启动', async () => {
      await migrate({ schema });
    });

    Given('系统管理员已经创建并登录', async () => {
      featureContext.adminToken = await prepareAdminToken(
        featureContext.apiServer,
        schema,
      );
    });

    Given('默认核销展览活动已创建，开始时间为 {string}，结束时间为 {string}', async (_ctx, startDate: string, endDate: string) => {
      featureContext.exhibition = await prepareExhibition(
        featureContext.apiServer,
        featureContext.adminToken,
        {
          name: `fapiao_${Date.now()}`,
          description: 'fapiao test exhibition',
          start_date: toDateLabel(startDate),
          end_date: toDateLabel(endDate),
        },
      );
      featureContext.sessions = await getSessions(
        featureContext.apiServer,
        featureContext.exhibition.id,
        featureContext.adminToken,
      );
      featureContext.ticketByName = {};
    });

    Given(
      '展会添加票种 {string}, 准入人数为 {number}, 有效期为场次当天, 价格是 {number} 元',
      async (_ctx, ticketName: string, admittance: number, priceYuan: number) => {
        const ticket = await prepareTicketCategory(
          featureContext.apiServer,
          featureContext.adminToken,
          featureContext.exhibition.id,
          {
            name: ticketName,
            admittance,
            valid_duration_days: 1,
            price: priceYuan * 100,
            refund_policy: 'REFUNDABLE_48H_BEFORE',
          },
        );
        featureContext.ticketByName[ticketName] = ticket;
      });

    And('票种 {string} 库存为 {number}', async (_ctx, ticketName: string, inventory: number) => {
      const ticket = featureContext.ticketByName[ticketName];
      await updateTicketCategoryMaxInventory(
        featureContext.apiServer,
        featureContext.adminToken,
        featureContext.exhibition.id,
        ticket.id,
        inventory,
      );
    });

    Given('用户已经通过微信绑定手机号，手机号为 {string}，国别码为 {string}', async (_ctx, phone: string, countryCode: string) => {
      const { token, profile } = await featureContext.wechatFixture.registerAndBindPhone(
        featureContext.apiServer,
        `fapiao_user_${Date.now()}`,
        {
          phone,
          countryCode,
        },
      );

      featureContext.userToken = token;
      featureContext.userProfile = profile;
    });

    Given('发票服务已经启动', async () => {
      const promise = new Promise<unknown>((resolve, reject) => {
        featureContext.fapiaoResponseResolver = resolve;
        setTimeout(() => {
          reject(new Error('Fapiao response timeout'));
        }, 2000);
      });

      const requestHandler = vi.fn(async () => {
        const response = await promise;
        const content = encodeFapiaoContent(response);

        const contentKey = encryptFapiaoContentKey(
          sha256FapiaoContent(content),
          config.fapiao.secret,
        );

        return {
          interface: {
            globalInfo: {
              appId: config.fapiao.app_id,
              interfaceId: '',
              interfaceCode: 'GP_FPKJ',
              requestCode: 'DZFPQZ',
              requestTime: '2024-01-01 00:00:00',
              responseCode: 'DS',
              dataExchangeId: 'TEST',
            },
            returnStateInfo: {
              returnCode: '0000',
              returnMessage: '成功',
            },
            data: {
              dataDescription: { zipCode: '0' },
              content,
              contentKey,
            },
          },
        };
      });

      const mockServer = await mockJSONServer(requestHandler);
      featureContext.fapiaoBaseUrlSpy = vi
        .spyOn(config.fapiao, 'base_url', 'get')
        .mockReturnValue(mockServer.address);
      featureContext.fapiaoMockServer = mockServer;
      featureContext.fapiaoRequestHandler = requestHandler;
    });
  });

  Scenario('用户成功申请发票', (s: StepTest<{
    applyInvoicePromise: Promise<Invoice.InvoiceRecord>;
  }>) => {
    const { When, Then, And, context } = s;
    And('请求中 interface code 是 {string}', (_ctx, interfaceCode: string) => {
      const { fapiaoEnvelope } = featureContext;
      expect(fapiaoEnvelope!.interface.globalInfo.interfaceCode).toBe(interfaceCode);
    });

    And('请求中 interface 是 {string}', (_ctx, interfaceName: string) => {
      const { fapiaoEnvelope } = featureContext;
      const decodedContent = decodeFapiaoContent(fapiaoEnvelope!.interface.data.content);
      const requestContent = JSON.parse(decodedContent);
      expect(requestContent).toHaveProperty(interfaceName);
    });

    And('请求中流水号前缀是 {string}，后缀是发票开具记录的 ID pad 到 14 位', (_ctx, prefix: string) => {
      const { fapiaoRequestData } = featureContext;
      const sequence_id = fapiaoRequestData!.FPQQLSH as string;
      expect(sequence_id.startsWith(prefix)).toBe(true);
      const suffix = sequence_id.slice(prefix.length);
      expect(/^\d{14}$/.test(suffix)).toBe(true);
    });

    And('请求中设备类型是数电，值为 {string}', (_ctx, value: string) => {
      const { fapiaoRequestData } = featureContext;
      expect(String(fapiaoRequestData!.SBLX)).toBe(value);
    });

    And('请求中发票类型代码是数电普票，值为 {string}', (_ctx, value: string) => {
      const { fapiaoRequestData } = featureContext;
      expect(String(fapiaoRequestData!.FPLXDM)).toBe(value);
    });

    And('请求中发票类型是蓝字发票，值为 {string}', (_ctx, value: string) => {
      const { fapiaoRequestData } = featureContext;
      expect(String(fapiaoRequestData!.KPLX)).toBe(value);
    });

    And('请求中征税方式是普通征税，值为 {string}', (_ctx, value: string) => {
      const { fapiaoRequestData } = featureContext;
      expect(String(fapiaoRequestData!.ZSFS)).toBe(value);
    });

    And('请求中销售方纳税人识别号是配置中的 tax_id', () => {
      const { fapiaoRequestData } = featureContext;
      expect(String(fapiaoRequestData!.XSF_NSRSBH)).toBe(config.fapiao.tax_id);
    });

    And('请求中销售方名称是配置中的 company_name， 销售方地址是配置中的 company_address，销售方电话是配置中的 company_phone', () => {
      const { fapiaoRequestData } = featureContext;
      expect(String(fapiaoRequestData!.XSF_MC)).toBe(config.fapiao.company_name);
      expect(String(fapiaoRequestData!.XSF_DZ)).toBe(config.fapiao.company_address);
      expect(String(fapiaoRequestData!.XSF_DH)).toBe(config.fapiao.company_phone);
    });

    And('请求中销售方开户行是配置中的 company_bank，银行账号是配置中的 company_bank_account', () => {
      const { fapiaoRequestData } = featureContext;
      expect(String(fapiaoRequestData!.XSF_KHH)).toBe(config.fapiao.company_bank);
      expect(String(fapiaoRequestData!.XSF_ZH)).toBe(config.fapiao.company_bank_account);
    });

    And('请求中开票人是配置中的 issuer', () => {
      const { fapiaoRequestData } = featureContext;
      expect(String(fapiaoRequestData!.KPR)).toBe(config.fapiao.issuer);
    });

    And(
      '请求中购买方名称是 {string}, 购买方纳税人识别号是 {string}，电子邮箱是 {string}',
      (_ctx, invoice_title: string, buyerTaxId: string, email: string) => {
        const { fapiaoRequestData } = featureContext;
        expect(String(fapiaoRequestData!.GMF_MC)).toBe(invoice_title);
        expect(String(fapiaoRequestData!.GMF_NSRSBH)).toBe(buyerTaxId);
        expect(String(fapiaoRequestData!.GMF_DZYX)).toBe(email);
      });

    And(
      '请求中价税合计是 {number} 元，合计金额是 {number} 元，合计税额是 {number} 元',
      (_ctx, totalYuan: number, amountYuan: number, taxYuan: number) => {
        const { fapiaoRequestData } = featureContext;
        expect(Number(fapiaoRequestData!.JSHJ)).toBe(totalYuan);
        expect(Number(fapiaoRequestData!.HJJE)).toBe(amountYuan);
        expect(Number(fapiaoRequestData!.HJSE)).toBe(taxYuan);
      });

    And('请求中有 {number} 个发票行项目', (_ctx, count: number) => {
      const { fapiaoRequestData } = featureContext;
      const rows = fapiaoRequestData!.COMMON_FPKJ_XMXX as unknown[];
      expect(Array.isArray(rows)).toBe(true);
      expect(rows.length).toBe(count);
    });

    And('发票行项目的第 {number} 行的发票行性质是正常行，值为 {string}', (_ctx, index: number, value: string) => {
      const { fapiaoRequestData } = featureContext;
      const rows = fapiaoRequestData!.COMMON_FPKJ_XMXX as Array<Record<string, unknown>>;
      expect(rows[index - 1].FPHXZ).toBe(value);
    });

    And('发票行项目的第 {number} 行的商品编码是 {string}', (_ctx, index: number, value: string) => {
      const { fapiaoRequestData } = featureContext;
      const rows = fapiaoRequestData!.COMMON_FPKJ_XMXX as Array<Record<string, unknown>>;
      expect(String(rows[index - 1].SPBM)).toBe(value);
    });

    And(
      '发票行项目的第 {number} 行的项目名称是 {string}, 数量是 {number}，单价是 {number} 元',
      (_ctx, index: number, name: string, quantity: number, unitPrice: number) => {
        const { fapiaoRequestData } = featureContext;
        const rows = fapiaoRequestData!.COMMON_FPKJ_XMXX as Array<Record<string, unknown>>;
        const row = rows[index - 1];
        expect(String(row.XMMC)).toBe(name);
        expect(Number(row.XMSL)).toBe(quantity);
        expect(Number(row.XMDJ)).toBe(unitPrice);
      });

    And('发票行项目的第 {number} 行的税率是 {number}%， 税额是 {number} 元', (_ctx, index: number, taxRate: number, taxAmount: number) => {
      const { fapiaoRequestData } = featureContext;
      const rows = fapiaoRequestData!.COMMON_FPKJ_XMXX as Array<Record<string, unknown>>;
      const row = rows[index - 1];
      expect(Number(row.SL) * 100).toBe(taxRate);
      expect(Number(row.SE)).toBe(taxAmount);
    });

    And('发票开具结果中的 PDF URL 是 {string}', (_ctx, pdfUrl: string) => {
      const { fapiaoResponse } = featureContext;
      fapiaoResponse!.DATA.PDF_URL = pdfUrl;
    });

    And('发票开具结果中的发票号码是 {string}', (_ctx, invoiceNo: string) => {
      const { fapiaoResponse } = featureContext;
      fapiaoResponse!.DATA.FP_HM = invoiceNo;
    });

    And('该记录的发票抬头是 {string}', (_ctx, invoiceTitle: string) => {
      const [first] = featureContext.fapiaoList!.items;
      expect(first.invoice_title).toBe(invoiceTitle);
    });

    And('该记录的税号是 {string}', (_ctx, taxNo: string) => {
      const [first] = featureContext.fapiaoList!.items;
      expect(first.tax_no).toBe(taxNo);
    });

    And('该记录的邮箱是 {string}', (_ctx, email: string) => {
      const [first] = featureContext.fapiaoList!.items;
      expect(first.email).toBe(email);
    });

    And('该记录的状态是开具成功', () => {
      const [first] = featureContext.fapiaoList!.items;
      expect(first.status).toBe('SUCCESS');
    });

    And('该记录的发票号码是 {string}', (_ctx, invoiceNo: string) => {
      const [first] = featureContext.fapiaoList!.items;
      expect(first.invoice_no).toBe(invoiceNo);
    });

    And('该记录的 PDF URL 是 {string}', (_ctx, pdfUrl: string) => {
      const [first] = featureContext.fapiaoList!.items;
      expect(first.pdf_url).toBe(pdfUrl);
    });

    When('用户再次申请同一订单的发票', async () => {
      context.applyInvoicePromise = applyOrderInvoice(
        featureContext.apiServer,
        featureContext.order.id,
        {
          invoice_title: '测试公司',
          tax_no: '123456789',
          email: 'send_me_invoice@example.com',
        },
        featureContext.userToken,
      );
    });

    Then('cr7 返回错误，提示该订单的发票已经开具成功', async () => {
      await expect(context.applyInvoicePromise).rejects.toMatchObject({
        status: 409,
        body: {
          message: '该订单的发票已经开具成功',
        },
      });
    });
  });

  Scenario('用户订单未支付申请发票失败', (s: StepTest<void>) => {
    const { Then } = s;

    Then('cr7 返回错误，提示订单未支付，无法申请发票', async () => {
      const { applyInvoicePromise } = featureContext;
      await expect(applyInvoicePromise).rejects.toMatchObject({
        status: 409,
        body: {
          message: '订单未支付，无法申请发票',
        },
      });
    });
  });

  Scenario('用户订单核销后申请发票', (s: StepTest<{ redemption: Redeem.RedemptionCodeWithOrder }>) => {
    const { When, Then, context } = s;

    When('管理员核销了用户的订单', async () => {
      const { apiServer, order, userToken, exhibition, adminToken } = featureContext;
      const redemption = await getOrderRedemption(apiServer, order.id, userToken);
      context.redemption = await redeemCode(apiServer, exhibition.id, redemption.code, adminToken);
    });

    Then('订单状态为已核销', () => {
      expect(context.redemption.status).toBe('REDEEMED');
    });
  });

  Scenario('用户订单退款后申请发票', (s: StepTest<void>) => {
    const { When, Then } = s;

    When('用户申请订单退款', async () => {
      const { order, apiServer, userToken } = featureContext;
      const { refundRecord } = await requestRefundWithMock(
        apiServer,
        order,
        userToken,
      );
      await sendMockRefundCallback(
        apiServer,
        refundRecord as Payment.RefundRecord,
        'SUCCESS',
        { successTime: new Date().toISOString() },
      );
      featureContext.order = await getOrder(
        apiServer,
        order.id,
        userToken,
      );
    });

    Then('订单状态为已退款', () => {
      expect(featureContext.order.status).toBe('REFUNDED');
    });

    Then('cr7 返回错误，提示订单已退款，无法申请发票', async () => {
      await expect(featureContext.applyInvoicePromise).rejects.toMatchObject({
        status: 409,
        body: {
          message: '订单已退款，无法申请发票',
        },
      });
    });
  });

  // Scenario('用户申请发票后发票平台开具失败', async ({ Given }) => {
  //  Given('发票平台返回发票开具失败的响应， 值为 "2000"', () => {});
  // });
});
