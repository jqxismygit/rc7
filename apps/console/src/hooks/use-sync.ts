import { App } from "antd";
import { useCallback, useState } from "react";
import dayjs from "dayjs";
import {
  getExhibitionSessionsApi,
  listExhibitionTicketsApi,
  syncDamaiSessionTicketsApi,
  syncDamaiSessionsApi,
  syncExhibitionToDamaiApi,
  syncExhibitionToMopApi,
  syncMopTicketCalendarApi,
  syncXiechengTicketInventoryApi,
  syncXiechengTicketPricesApi,
  type DamaiSessionDateRangeBody,
  type MopSessionDateRangeBody,
  type XiechengSessionDateRangeBody,
} from "@/apis/exhibition";
import { pickApiErrorMessage } from "@/utils/pick-api-error";

/** 同步展会基本信息到猫眼（MOP） */
export function useSyncExhibitionToMaoyan() {
  const { message } = App.useApp();
  const [syncing, setSyncing] = useState(false);

  const sync = useCallback(
    async (eid: string) => {
      setSyncing(true);
      try {
        await syncExhibitionToMopApi(eid);
        message.success("猫眼同步请求已发送");
      } catch (err) {
        message.error(pickApiErrorMessage(err));
      } finally {
        setSyncing(false);
      }
    },
    [message],
  );

  return { sync, syncing };
}

/** 同步展会基本信息到大麦 */
export function useSyncExhibitionToDamai() {
  const { message } = App.useApp();
  const [syncing, setSyncing] = useState(false);

  const sync = useCallback(
    async (eid: string) => {
      setSyncing(true);
      try {
        await syncExhibitionToDamaiApi(eid);
        message.success("大麦同步请求已发送");
      } catch (err) {
        message.error(pickApiErrorMessage(err));
      } finally {
        setSyncing(false);
      }
    },
    [message],
  );

  return { sync, syncing };
}

/**
 * 猫眼：先拉取展会票种列表，再对每个票种并行调用日历同步接口（单次含场次→票种→库存）。
 * @see docs/api/mop.md `/exhibition/:eid/tickets/:tid/ota/mop/sync/calendar`
 */
export function useSyncInfoToMaoyan() {
  const { message } = App.useApp();
  const [syncing, setSyncing] = useState(false);

  const sync = useCallback(
    async (eid: string, range: MopSessionDateRangeBody) => {
      const { start_session_date, end_session_date, session_mode } = range;
      if (!start_session_date?.trim() || !end_session_date?.trim()) {
        message.warning("请选择同步日期范围");
        return;
      }
      setSyncing(true);
      try {
        const tickets = await listExhibitionTicketsApi(eid);
        if (tickets.length === 0) {
          message.warning("暂无票种，无法同步猫眼");
          return;
        }
        const body: MopSessionDateRangeBody = {
          start_session_date,
          end_session_date,
          ...(session_mode != null ? { session_mode } : {}),
        };
        await Promise.all(
          tickets.map((t) => syncMopTicketCalendarApi(eid, t.id, body)),
        );
        message.success(
          `猫眼同步请求已发送（${tickets.length} 个票种，场次→票种→库存）`,
        );
      } catch (err) {
        message.error(pickApiErrorMessage(err));
        throw err;
      } finally {
        setSyncing(false);
      }
    },
    [message],
  );

  return { sync, syncing };
}

/**
 * 大麦：仅同步场次与各场次票种（含价格）。顺序：场次（日期区间）→ 按场次依次票种。
 */
export function useSyncInfoToDamai() {
  const { message } = App.useApp();
  const [syncing, setSyncing] = useState(false);

  const sync = useCallback(
    async (eid: string, range: DamaiSessionDateRangeBody) => {
      const { start_session_date, end_session_date } = range;
      if (!start_session_date?.trim() || !end_session_date?.trim()) {
        message.warning("请选择同步日期范围");
        return;
      }
      setSyncing(true);
      try {
        await syncDamaiSessionsApi(eid, {
          start_session_date,
          end_session_date,
        });
        const sessions = await getExhibitionSessionsApi(eid);
        const start = dayjs(start_session_date).startOf("day");
        const end = dayjs(end_session_date).startOf("day");
        const inRange = sessions
          .filter((s) => {
            const d = dayjs(s.session_date).startOf("day");
            return !d.isBefore(start, "day") && !d.isAfter(end, "day");
          })
          .sort(
            (a, b) =>
              dayjs(a.session_date).valueOf() - dayjs(b.session_date).valueOf(),
          );
        for (const s of inRange) {
          await syncDamaiSessionTicketsApi(eid, s.id);
        }
        message.success("大麦同步已完成（场次 → 票种）");
      } catch (err) {
        message.error(pickApiErrorMessage(err));
        throw err;
      } finally {
        setSyncing(false);
      }
    },
    [message],
  );

  return { sync, syncing };
}

/**
 * 携程：按票种依次同步（同一日期区间）。顺序：库存（不传 quantity，按剩余库存）→ 价格。
 */
export function useSyncInfoToCtrip() {
  const { message } = App.useApp();
  const [syncing, setSyncing] = useState(false);

  const sync = useCallback(
    async (eid: string, range: XiechengSessionDateRangeBody) => {
      const { start_session_date, end_session_date } = range;
      if (!start_session_date?.trim() || !end_session_date?.trim()) {
        message.warning("请选择同步日期范围");
        return;
      }
      setSyncing(true);
      try {
        const tickets = await listExhibitionTicketsApi(eid);
        if (tickets.length === 0) {
          message.warning("暂无票种，无法同步携程");
          return;
        }
        const body: XiechengSessionDateRangeBody = {
          start_session_date,
          end_session_date,
        };
        for (const t of tickets) {
          await syncXiechengTicketInventoryApi(eid, t.id, body);
          await syncXiechengTicketPricesApi(eid, t.id, body);
        }
        message.success("携程同步已完成（各票种：库存 → 价格）");
      } catch (err) {
        message.error(pickApiErrorMessage(err));
        throw err;
      } finally {
        setSyncing(false);
      }
    },
    [message],
  );

  return { sync, syncing };
}
