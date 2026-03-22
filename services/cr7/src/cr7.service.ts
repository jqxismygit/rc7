import { Errors } from 'moleculer';
import { RC7BaseService } from "./libs/cr7.base.js";
import { ExhibitionService } from "./libs/exhibition.js";
import { OrderService } from "./libs/order.js";
import { PaymentService } from "./libs/payment.js";

const { MoleculerClientError } = Errors;

/**
 * RC7Service
 * RC7 主服务，继承所有子服务功能
 */
export default class RC7Service extends RC7BaseService {
  constructor(broker) {
    super(broker);
    const exhibitionService = new ExhibitionService(broker);
    const orderService = new OrderService(broker);
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

  async checkUserRole(ctx) {
    const requiredRoles: string[] = ctx.action.roles || [];
    if (requiredRoles.length === 0) {
      return;
    }

    const roles = await ctx.call('user.roles');
    const roleSet = new Set(roles.map(role => role.toLowerCase()));
    const satisfy = requiredRoles.some(role => roleSet.has(role));
    if (satisfy === false) {
      throw new MoleculerClientError('Insufficient permissions', 403, 'FORBIDDEN_ACCESS');
    }
  }

}