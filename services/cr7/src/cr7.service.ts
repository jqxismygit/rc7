import { ExhibitionService } from "./libs/exhibition.js";

/**
 * RC7Service
 * RC7 主服务，继承所有子服务功能
 */
export default class RC7Service extends ExhibitionService {
  constructor(broker) {
    super(broker);

    this.parseServiceSchema({
      name: 'cr7',
      settings: {
        rest: '/',
        $noVersionPrefix: true,
      },

      actions: {
        ...this.actions_exhibition
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