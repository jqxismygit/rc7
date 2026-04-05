import { readFile } from 'node:fs/promises';
import config from 'config';
import { format } from 'date-fns';
import { Context, Errors, ServiceBroker } from 'moleculer';
import { Exhibition } from '@cr7/types';
import { RC7BaseService } from './libs/cr7.base.js';
import { mopPostJSON } from './libs/mop.js';
import { getExhibitionById } from './data/exhibition.js';

const { MoleculerClientError } = Errors;

interface UserMeta {
  uid: string;
}

type CityMeta = {
  id: string;
  name: string;
};

type MopProjectSyncRequest = {
  cityId: string;
  cityName: string;
  otProjectId: string;
  category: number;
  otVenueId: string;
  otVenueName: string;
  projectStatus: number;
  name: string;
};

const MOP_PROJECT_CATEGORY_LEISURE_EXHIBITION = {
  label: '休闲展览',
  value: 9,
} as const;

const MOP_PROJECT_STATUS_VALID = 1;

const SUPPORTED_CITIES: Record<string, CityMeta> = {
  上海: { id: '310000', name: '上海市' },
};

function getCityMeta(cityName: string): CityMeta {
  const city = SUPPORTED_CITIES[cityName];
  if (!city) {
    throw new MoleculerClientError(`暂不支持同步城市: ${cityName}`, 400, 'MOP_CITY_NOT_SUPPORTED');
  }

  return city;
}

async function readKey(path: string) {
  return readFile(path, 'utf-8').then(content => content.trim());
}

export default class MoeService extends RC7BaseService {
  constructor(broker: ServiceBroker) {
    super(broker);

    this.parseServiceSchema({
      name: 'mop',
      settings: {
        $noVersionPrefix: true,
      },

      hooks: {
        before: {
          '*': ['checkUserRole'],
        },
      },

      actions: {
        syncExhibitionToMop: {
          rest: 'POST /:eid/ota/mop/sync',
          roles: ['admin'],
          params: {
            eid: 'string',
          },
          handler: this.syncExhibitionToMop,
        },
      },

      async started() {
        await this.initPool();
      },

      async stopped() {
        await this.closePool();
      },
    });
  }

  async syncExhibitionToMop(
    ctx: Context<{ eid: string }, UserMeta & { $statusCode?: number }>,
  ): Promise<void> {
    const { eid } = ctx.params;
    const exhibition = await ctx.call<Exhibition.Exhibition, { eid: string }>(
      'cr7.exhibition.get', { eid }
    );

    const cityMeta = getCityMeta(exhibition.city);
    const request: MopProjectSyncRequest = {
      cityId: cityMeta.id,
      cityName: cityMeta.name,
      otProjectId: exhibition.id,
      category: MOP_PROJECT_CATEGORY_LEISURE_EXHIBITION.value,
      otVenueId: exhibition.id,
      otVenueName: exhibition.venue_name,
      projectStatus: MOP_PROJECT_STATUS_VALID,
      name: exhibition.name,
    };

    const privateKey = await readKey(config.mop.private_key_path);
    const publicKey = await readKey(config.mop.public_key_path);

    const syncUrl = new URL('/supply/open/mop/project/push', config.mop.base_url).toString();

    await mopPostJSON(syncUrl, {
      supplier: config.mop.supplier,
      timestamp: format(new Date(), 'yyyy-MM-dd HH:mm:ss'),
      version: '1.0.0',
      aesKey: config.mop.aes_key,
      privateKey,
      responsePublicKey: publicKey,
      body: request,
    });

    ctx.meta.$statusCode = 204;
  }
}
