import { Server } from 'node:http';
import { getJSON, postJSON, putJSON } from '../lib/api.js';
import type { Exhibition, Xiecheng } from '@cr7/types';

export async function bindTicketXiechengOptionId(
  server: Server,
  token: string,
  eid: string,
  tid: string,
  otaOptionId: string,
) {
  return putJSON<Exhibition.TicketCategory>(
    server,
    `/exhibition/${eid}/tickets/${tid}/ota/xc`,
    {
      token,
      body: {
        ota_option_id: otaOptionId,
      },
    },
  );
}

export async function syncTicketPriceToXiecheng(
  server: Server,
  token: string,
  eid: string,
  tid: string,
  payload: {
    start_session_date: string;
    end_session_date: string;
  },
) {
  return postJSON<Xiecheng.XcSyncLog>(
    server,
    `/exhibition/${eid}/tickets/${tid}/ota/xc/sync`,
    {
      token,
      body: payload,
    },
  );
}

export async function syncTicketInventoryToXiecheng(
  server: Server,
  token: string,
  eid: string,
  tid: string,
  payload: {
    start_session_date: string;
    end_session_date: string;
    quantity?: number;
  },
) {
  return postJSON<Xiecheng.XcSyncLog>(
    server,
    `/exhibition/${eid}/tickets/${tid}/ota/xc/sync/inventory`,
    {
      token,
      body: payload,
    },
  );
}

export async function listTicketXiechengSyncLogs(
  server: Server,
  token: string,
  eid: string,
  tid: string,
  serviceName?: Xiecheng.XcServiceName,
) {
  return getJSON<Xiecheng.XcSyncLog[]>(
    server,
    `/exhibition/${eid}/tickets/${tid}/ota/xc/sync/logs`,
    {
      token,
      query: serviceName ? { service_name: serviceName } : undefined,
    },
  );
}
