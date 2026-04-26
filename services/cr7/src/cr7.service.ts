import { RC7BaseService } from './libs/cr7.base.js';
import { AssetsService } from './libs/assets.js';
import { ExhibitionService } from './libs/exhibition.js';
import { FapiaoService } from './libs/invoice.js';
import { CdkeyService } from './libs/cdkey.js';
import { OrderService } from './libs/order.js';
import { PaymentService } from './libs/payment.js';
import { RedemptionService } from './libs/redeem.js';
import { TopicService } from './libs/topics.js';
import { ServiceBroker } from 'moleculer';

/**
 * RC7Service
 * RC7 主服务，继承所有子服务功能
 */
export default class RC7Service extends RC7BaseService {
  constructor(broker: ServiceBroker) {
    super(broker);
    const assetsService = new AssetsService(broker);
    const exhibitionService = new ExhibitionService(broker);
    const invoiceService = new FapiaoService(broker);
    const cdkeyService = new CdkeyService(broker);
    const orderService = new OrderService(broker);
    const redemptionService = new RedemptionService(broker);
    const topicService = new TopicService(broker);
    const { actions_payment, methods: payment_methods } = new PaymentService(broker);

    this.parseServiceSchema({
      name: 'cr7',
      settings: {
        rest: '/',
        $noVersionPrefix: true,
      },

      hooks: {
        before: {
          '*': ['checkUserRole'],
        }
      },

      methods: {
        ...payment_methods,
        ...orderService.methods_order,
        ...redemptionService.methods,
        ...cdkeyService.methods,
        ...invoiceService.methods,
      },

      actions: {
        ...assetsService.actions_assets,
        ...exhibitionService.actions_exhibition,
        ...invoiceService.actions_fapiao,
        ...cdkeyService.actions_cdkey,
        ...orderService.actions_order,
        ...redemptionService.actions_redemption,
        ...topicService.actions_topics,
        ...actions_payment,
      },

      async started() {
        await this.initPool();
        await assetsService.ensureAssetsDir();
      },

      async stopped() {
        await this.closePool();
      },
    });
  }
}
