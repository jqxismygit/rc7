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
import { Exhibition, Invoice, Order, User } from '@cr7/types';
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
import { markOrderAsPaidForTest } from './fixtures/payment.js';
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

type FapiaoScenarioContext = OrderContext & {
  fapiaoEnvelope: FapiaoEnvelope;
  fapiaoRequestData: Record<string, unknown>;
  listResult: Invoice.InvoiceApplicationListResult;
};

interface CreateFapiaoContext {
  fapiaoMockServer: MockServer;
  fapiaoBaseUrlSpy: { mockRestore: () => void };
  fapiaoRequestHandler: ReturnType<typeof vi.fn>;
  fapiaoResponseResolver: (args: unknown) => void;
}

interface FeatureContext extends
  ExhibitionContext,
  OrderContext,
  Partial<CreateFapiaoContext> {
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
          refund_policy: 'NON_REFUNDABLE',
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

    And('用户预订 {number} 张该展会的 {string} 场次的 {string}', async (_ctx, quantity: number, sessionDate: string, ticketName: string) => {
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


    And('用户发起并完成微信支付', async () => {
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

    And('订单状态为已支付', () => {
      expect(featureContext.order!.status).toBe('PAID');
    });

    Given('发票服务已经启动', async () => {
      let resolvePromise!: (args: unknown) => void;
      const promise = new Promise<unknown>((resolve) => {
        resolvePromise = resolve;
      });
      featureContext.fapiaoResponseResolver = resolvePromise;

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

  Scenario('用户成功申请发票', (s: StepTest<
    FapiaoScenarioContext
    & {
      applyInvoicePromise: Promise<Invoice.InvoiceApplication>;
      invoiceApplication: Invoice.InvoiceApplication;
      sequenceSuffix: string;
      fapiaoResponse: {
        CODE: string;
        MESSAGE: string;
        DATA: {
          FPQQLSH: string,
          PDF_URL: string,
          FP_HM: string,
        }
      }
    }
  >) => {
    const { Given, When, Then, And, context } = s;

    When(
      '用户申请订单的发票，发票抬头为 {string}，税号为 {string}, 邮箱为 {string}',
      async (_ctx, invoiceTitle: string, taxNo: string, email: string) => {
      context.applyInvoicePromise = applyOrderInvoice(
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

      const requestArg = featureContext.fapiaoRequestHandler!.mock.calls.at(-1)?.[0] as
        | { body?: unknown }
        | undefined;

      expect(requestArg?.body).toBeTruthy();
      context.fapiaoEnvelope = requestArg!.body as FapiaoEnvelope;

      const decodedContent = decodeFapiaoContent(context.fapiaoEnvelope.interface.data.content);
      const requestContent = JSON.parse(decodedContent) as Record<string, unknown>;
      context.fapiaoRequestData = requestContent.REQUEST_COMMON_FPKJ as Record<string, unknown>;
      expect(context.fapiaoRequestData).toBeTruthy();
    });

    And('请求中 interface code 是 {string}', (_ctx, interfaceCode: string) => {
      expect(context.fapiaoEnvelope.interface.globalInfo.interfaceCode).toBe(interfaceCode);
    });

    And('请求中 interface 是 {string}', (_ctx, interfaceName: string) => {
      const decodedContent = decodeFapiaoContent(context.fapiaoEnvelope.interface.data.content);
      const requestContent = JSON.parse(decodedContent) as Record<string, unknown>;
      expect(requestContent).toHaveProperty(interfaceName);
    });

    And('请求中流水号前缀是 {string}，后缀是发票开具记录的 ID pad 到 14 位', (_ctx, prefix: string) => {
      const sequence_id = context.fapiaoRequestData.FPQQLSH as string;
      expect(sequence_id.startsWith(prefix)).toBe(true);
      const suffix = sequence_id.slice(prefix.length);
      expect(/^\d{14}$/.test(suffix)).toBe(true);
      context.sequenceSuffix = suffix;
    });

    And('请求中设备类型是数电，值为 {string}', (_ctx, value: string) => {
      expect(String(context.fapiaoRequestData.SBLX)).toBe(value);
    });

    And('请求中发票类型代码是数电普票，值为 {string}', (_ctx, value: string) => {
      expect(String(context.fapiaoRequestData.FPLXDM)).toBe(value);
    });

    And('请求中发票类型是蓝字发票，值为 {string}', (_ctx, value: string) => {
      expect(String(context.fapiaoRequestData.KPLX)).toBe(value);
    });

    And('请求中征税方式是普通征税，值为 {string}', (_ctx, value: string) => {
      expect(String(context.fapiaoRequestData.ZSFS)).toBe(value);
    });

    And('请求中销售方纳税人识别号是配置中的 tax_id', () => {
      expect(String(context.fapiaoRequestData.XSF_NSRSBH)).toBe(config.fapiao.tax_id);
    });

    And('请求中销售方名称是配置中的 company_name， 销售方地址是配置中的 company_address，销售方电话是配置中的 company_phone', () => {
      const { fapiaoRequestData } = context;
      expect(String(fapiaoRequestData.XSF_MC)).toBe(config.fapiao.company_name);
      expect(String(fapiaoRequestData.XSF_DZ)).toBe(config.fapiao.company_address);
      expect(String(fapiaoRequestData.XSF_DH)).toBe(config.fapiao.company_phone);
    });

    And('请求中销售方开户行是配置中的 company_bank，银行账号是配置中的 company_bank_account', () => {
      const { fapiaoRequestData } = context;
      expect(String(fapiaoRequestData.XSF_KHH)).toBe(config.fapiao.company_bank);
      expect(String(fapiaoRequestData.XSF_ZH)).toBe(config.fapiao.company_bank_account);
    });

    And('请求中开票人是配置中的 issuer', () => {
      const { fapiaoRequestData } = context;
      expect(String(fapiaoRequestData.KPR)).toBe(config.fapiao.issuer);
    });

    And(
      '请求中购买方名称是 {string}, 购买方纳税人识别号是 {string}，电子邮箱是 {string}',
      (_ctx, invoice_title: string, buyerTaxId: string, email: string) => {
      const { fapiaoRequestData } = context;
      expect(String(fapiaoRequestData.GMF_MC)).toBe(invoice_title);
      expect(String(fapiaoRequestData.GMF_NSRSBH)).toBe(buyerTaxId);
      expect(String(fapiaoRequestData.GMF_DZYX)).toBe(email);
    });

    And(
      '请求中价税合计是 {number} 元，合计金额是 {number} 元，合计税额是 {number} 元',
      (_ctx, totalYuan: number, amountYuan: number, taxYuan: number) => {
      const { fapiaoRequestData } = context;
      expect(Number(fapiaoRequestData.JSHJ)).toBe(totalYuan);
      expect(Number(fapiaoRequestData.HJJE)).toBe(amountYuan);
      expect(Number(fapiaoRequestData.HJSE)).toBe(taxYuan);
    });

    And('请求中有 {number} 个发票行项目', (_ctx, count: number) => {
      const { fapiaoRequestData } = context;
      const rows = fapiaoRequestData.COMMON_FPKJ_XMXX as unknown[];
      expect(Array.isArray(rows)).toBe(true);
      expect(rows.length).toBe(count);
    });

    And('发票行项目的第 {number} 行的发票行性质是正常行，值为 {string}', (_ctx, index: number, value: string) => {
      const { fapiaoRequestData } = context;
      const rows = fapiaoRequestData.COMMON_FPKJ_XMXX as Array<Record<string, unknown>>;
      expect(rows[index - 1].FPHXZ).toBe(value);
    });

    And('发票行项目的第 {number} 行的商品编码是 {string}', (_ctx, index: number, value: string) => {
      const { fapiaoRequestData } = context;
      const rows = fapiaoRequestData.COMMON_FPKJ_XMXX as Array<Record<string, unknown>>;
      expect(String(rows[index - 1].SPBM)).toBe(value);
    });

    And(
      '发票行项目的第 {number} 行的项目名称是 {string}, 数量是 {number}，单价是 {number} 元',
      (_ctx, index: number, name: string, quantity: number, unitPrice: number) => {
      const { fapiaoRequestData } = context;
      const rows = fapiaoRequestData.COMMON_FPKJ_XMXX as Array<Record<string, unknown>>;
      const row = rows[index - 1];
      expect(String(row.XMMC)).toBe(name);
      expect(Number(row.XMSL)).toBe(quantity);
      expect(Number(row.XMDJ)).toBe(unitPrice);
    });

    And('发票行项目的第 {number} 行的税率是 {number}%， 税额是 {number} 元', (_ctx, index: number, taxRate: number, taxAmount: number) => {
      const { fapiaoRequestData } = context;
      const rows = fapiaoRequestData.COMMON_FPKJ_XMXX as Array<Record<string, unknown>>;
      const row = rows[index - 1];
      expect(Number(row.SL) * 100).toBe(taxRate);
      expect(Number(row.SE)).toBe(taxAmount);
    });

    Given('发票平台返回发票开具成功的响应， 值为 {string}', (_ctx, code: string) => {
      context.fapiaoResponse = {
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
      context.fapiaoResponse.DATA.FPQQLSH = context.fapiaoRequestData.FPQQLSH as string;
    });

    And('发票开具结果中的 PDF URL 是 {string}', (_ctx, pdfUrl: string) => {
      context.fapiaoResponse.DATA.PDF_URL = pdfUrl;
    });

    And('发票开具结果中的发票号码是 {string}', (_ctx, invoiceNo: string) => {
      context.fapiaoResponse.DATA.FP_HM = invoiceNo;
    });

    When('发票服务返回开具结果给 cr7', async () => {
      featureContext.fapiaoResponseResolver?.(context.fapiaoResponse);
      context.invoiceApplication = await context.applyInvoicePromise;
      const sequenceId = String(context.invoiceApplication.id).padStart(14, '0');
      expect(context.sequenceSuffix).toBe(sequenceId);
    });

    When('用户查看发票申请列表', async () => {
      context.listResult = await listInvoiceApplications(
        featureContext.apiServer,
        featureContext.userToken,
      );
    });

    Then('发票申请列表有 {number} 条记录', (_ctx, count: number) => {
      expect(context.listResult.items.length).toBe(count);
    });

    And('该记录的订单 ID 是用户预订的订单 ID', () => {
      const [first] = context.listResult.items;
      expect(first.order_id).toBe(featureContext.order.id);
    });

    And('该记录的发票抬头是 {string}', (_ctx, invoiceTitle: string) => {
      const [first] = context.listResult.items;
      expect(first.invoice_title).toBe(invoiceTitle);
    });

    And('该记录的税号是 {string}', (_ctx, taxNo: string) => {
      const [first] = context.listResult.items;
      expect(first.tax_no).toBe(taxNo);
    });

    And('该记录的邮箱是 {string}', (_ctx, email: string) => {
      const [first] = context.listResult.items;
      expect(first.email).toBe(email);
    });

    And('该记录的状态是开具成功', () => {
      const [first] = context.listResult.items;
      expect(first.status).toBe('SUCCESS');
    });

    And('该记录的发票号码是 {string}', (_ctx, invoiceNo: string) => {
      const [first] = context.listResult.items;
      expect(first.invoice_no).toBe(invoiceNo);
    });

    And('该记录的 PDF URL 是 {string}', (_ctx, pdfUrl: string) => {
      const [first] = context.listResult.items;
      expect(first.pdf_url).toBe(pdfUrl);
    });
  });
});
