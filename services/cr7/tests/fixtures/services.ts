import path from 'node:path';
import { URL } from 'node:url';
import { Server } from 'node:http';
import { ServiceBroker, ServiceSchema } from 'moleculer';
import { bootstrap, migrate, drop } from '@scripts/index.js';
import { FixturesResult } from '../lib/fixtures.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);

type FIXTURE_SERVICES = 'string' | ServiceSchema;

export const services_fixtures = {
  schema: '__test__',
  services: ['api'],
  broker: async (
    { schema, services }: {
      schema: string; services: FIXTURE_SERVICES[]
    },
    use: (broker: ServiceBroker) => Promise<void>
  ) => {
    if (schema === '__test__') {
      throw new Error('请为测试指定一个数据库 schema');
    }

    const { default: config } = await import('config');
    const broker = new ServiceBroker(config.broker);

    for (const nameOrSetting of services) {
      if (typeof nameOrSetting === 'string') {
        const servicePath = path.resolve(
          __dirname, '..', '..', 'dist/src', `${nameOrSetting}.service.js`
        );
        const { default: service } = await import(servicePath);
        broker.createService(service);
        continue;
      }
      broker.createService(nameOrSetting);
    }

    await bootstrap();
    await migrate({ schema });
    await broker.start();

    await use(broker);

    await broker.stop();
    await drop({ schema });
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

export type APIServerFixture = FixturesResult<typeof services_fixtures, 'apiServer'>;
