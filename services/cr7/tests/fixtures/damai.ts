import { Server } from 'node:http';
import { postJSON } from '../lib/api.js';

export async function syncExhibitionToDamai(
  server: Server,
  token: string,
  eid: string,
) {
  return postJSON<void>(
    server,
    `/exhibition/${eid}/ota/damai/sync`,
    { token },
  );
}

export async function syncSessionsToDamai(
  server: Server,
  token: string,
  eid: string,
  range?: {
    start_session_date: string;
    end_session_date: string;
  },
) {
  const body = range ? { ...range } : undefined;

  return postJSON<void>(
    server,
    `/exhibition/${eid}/ota/damai/sync/sessions`,
    { token, body },
  );
}
