import path from 'node:path';
import { URL } from 'node:url';
import { Server } from 'node:http';
import { Service, ServiceBroker, ServiceSchema } from 'moleculer';
import { bootstrap, migrate, dropSchema } from '@/scripts/index.js';
import { FixturesResult } from '../lib/fixtures.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);

type FIXTURE_SERVICES = string | ServiceSchema;

export async function prepareServices(
  services: FIXTURE_SERVICES[]
): Promise<ServiceBroker> {
  const { default: config } = await import('config');
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

  return broker;
}

export async function prepareAPIServer(broker: ServiceBroker): Promise<Server> {
  const service = broker.getLocalService(
    'api'
  ) as Service & { routes: { opts: { autoAliases: boolean } }[] };

  if (!service) {
    throw new Error('API service not found in broker');
  }
  service.routes.forEach(
    route => route.opts.autoAliases
      && service.regenerateAutoAliases(route)
  );
  return service.server;
}

/**
 * @deprecated 在测试中使用 `prepareServices` 和 `prepareAPIServer` 来设置测试环境
 */
export const services_fixtures = {
  schema: '__test__',
  services: ['api'],
  broker: async (
    { schema, services }: {
      schema: string; services: FIXTURE_SERVICES[];
    },
    use: (broker: ServiceBroker) => Promise<void>
  ) => {
    if (schema === '__test__') {
      throw new Error('请为测试指定一个数据库 schema');
    }

    const broker = await prepareServices(services);
    await bootstrap();
    await migrate({ schema });
    await broker.start();

    await use(broker);

    await broker.stop();
    await dropSchema({ schema });
  },
  apiServer: async (
    { broker }: { broker: ServiceBroker },
    use: (server: Server) => Promise<void>
  ) => {
    const server = await prepareAPIServer(broker);
    await use(server);
  }
};

export type APIServerFixture = FixturesResult<typeof services_fixtures, 'apiServer'>;
