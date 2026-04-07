import config from 'config';
import { Context, ServiceBroker } from 'moleculer';
import { Exhibition } from '@cr7/types';
import { RC7BaseService } from './libs/cr7.base.js';
import { damaiPostJson } from './libs/damai.js';

interface UserMeta {
  uid: string;
  $statusCode?: number;
}

type DamaiProjectSyncRequest = {
  projectInfo: {
    id: string;
    name: string;
    chooseSeatFlag: boolean;
    posters: string | null;
    introduce: string;
  };
  venueInfo: {
    id: string;
    name: string;
  };
};

class DamaiService extends RC7BaseService {
  constructor(broker: ServiceBroker) {
    super(broker);

    this.parseServiceSchema({
      name: 'damai',
      settings: {},
      hooks: {
        before: {
          '*': ['checkUserRole'],
        },
      },
      actions: {
        syncExhibitionToDamai: {
          rest: 'POST /:eid/ota/damai/sync',
          roles: ['admin'],
          params: {
            eid: 'string',
          },
          handler: this.syncExhibitionToDamai,
        },
      },
    });
  }

  async syncExhibitionToDamai(ctx: Context<{ eid: string }, UserMeta>): Promise<void> {
    const { eid } = ctx.params;
    const exhibition = await ctx.call<Exhibition.Exhibition, { eid: string }>(
      'cr7.exhibition.get',
      { eid },
    );

    const request: DamaiProjectSyncRequest = {
      projectInfo: {
        id: exhibition.id,
        name: exhibition.name,
        chooseSeatFlag: false,
        posters: exhibition.cover_url ?? null,
        introduce: exhibition.description,
      },
      venueInfo: {
        id: exhibition.id,
        name: exhibition.venue_name,
      },
    };

    const syncUrl = new URL('/b2b2c/2.0/sync/project', config.damai.base_url).toString();
    await damaiPostJson(syncUrl, {
      apiKey: config.damai.api_key,
      apiPw: config.damai.api_pwd,
      signTarget: 'both',
      body: request,
    });

    ctx.meta.$statusCode = 204;
  }
}

export default DamaiService;
