import { RC7BaseService } from "./libs/cr7.base.js";
import { ExhibitionService } from "./libs/exhibition.js";
import { OrderService } from "./libs/order.js";

/**
 * RC7Service
 * RC7 主服务，继承所有子服务功能
 */
export default class RC7Service extends RC7BaseService {
  constructor(broker) {
    super(broker);
    const exhibitionService = new ExhibitionService(broker);
    const orderService = new OrderService(broker);

    this.parseServiceSchema({
      name: 'cr7',
      settings: {
        rest: '/',
        $noVersionPrefix: true,
      },

      actions: {
        ...exhibitionService.actions_exhibition,
        ...orderService.actions_order
      },

      async started() {
        await this.initPool();
      },

      async stopped() {
        await this.closePool();
      }
    });
  }
}