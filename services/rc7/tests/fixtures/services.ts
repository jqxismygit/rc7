import path from 'node:path';
import { URL } from 'node:url';
import { Server } from 'node:http';
import { ServiceBroker, ServiceSchema } from 'moleculer';
import config from 'config';

const __dirname = path.dirname(new URL(import.meta.url).pathname);

export const services_fixtures = {
  schema: 'rc7',
  services: ['api'],
  broker: async (
    { services }: { services: (string | ServiceSchema)[] },
    use: (broker: ServiceBroker) => Promise<void>
  ) => {
    const broker = new ServiceBroker(config.broker);

    for (const nameOrSetting of services) {
      if (typeof nameOrSetting === 'string') {
        const servicePath = path.resolve(
          __dirname, '..', '..', 'dist', `${nameOrSetting}.service.js`
        );
        const { default: service } = await import(servicePath);
        broker.createService(service);
        continue;
      }
      broker.createService(nameOrSetting);
    }

    await broker.start();

    await use(broker);

    await broker.stop();
  },
  apiServer: async (
    { broker }: { broker: ServiceBroker },
    use: (server: Server) => Promise<void>
  ) => {
    const service = broker.getLocalService('api');
    service.routes.forEach(
      route => route.opts.autoAliases
        && service.regenerateAutoAliases(route)
    );

    await use(service.server);
  }
};