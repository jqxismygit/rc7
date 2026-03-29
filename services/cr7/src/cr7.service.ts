import { RC7BaseService } from "./libs/cr7.base.js";
import { ExhibitionService } from "./libs/exhibition.js";
import { OrderService } from "./libs/order.js";
import { PaymentService } from "./libs/payment.js";
import { RedemptionService } from './libs/redeem.js';
import { TopicService } from './libs/topics.js';

/**
 * RC7Service
 * RC7 主服务，继承所有子服务功能
 */
export default class RC7Service extends RC7BaseService {
  constructor(broker) {
    super(broker);
    const exhibitionService = new ExhibitionService(broker);
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
          "*": ['checkUserRole'],
        }
      },

      methods: {
        ...payment_methods,
      },

      actions: {
        ...exhibitionService.actions_exhibition,
        ...orderService.actions_order,
        ...redemptionService.actions_redemption,
        ...topicService.actions_topics,
        ...actions_payment,
      },

      async started() {
        await this.initPool();
      },

      async stopped() {
        await this.closePool();
      },
    });
  }

}