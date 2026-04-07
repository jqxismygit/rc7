import { Context, Service, ServiceBroker } from 'moleculer';
import { RC7BaseService } from './libs/cr7.base.js';

class DamaiService extends RC7BaseService {
  constructor(broker: ServiceBroker) {
    super(broker);

    this.parseServiceSchema({
      name: 'damai',
      settings: {},
      actions: {},
      hooks: {},
    });
  }
}

export default DamaiService;
