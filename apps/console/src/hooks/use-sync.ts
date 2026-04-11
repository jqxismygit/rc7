import { App } from "antd";
import { useCallback, useState } from "react";
import dayjs from "dayjs";
import {
  getExhibitionSessionsApi,
  syncDamaiSessionTicketsApi,
  syncDamaiSessionsApi,
  syncExhibitionToDamaiApi,
  syncExhibitionToMopApi,
  syncMopSessionsApi,
  syncMopStocksApi,
  syncMopTicketsApi,
  type DamaiSessionDateRangeBody,
  type MopSessionDateRangeBody,
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
 * 按 MOP 约定顺序批量同步：票种 → 场次 → 库存（同一日期区间）。
 * 票种同步含价格等 SKU 信息；库存同步依赖场次与票种已在猫眼侧就绪。
 */
export function useSyncInfoToMaoyan() {
  const { message } = App.useApp();
  const [syncing, setSyncing] = useState(false);

  const sync = useCallback(
    async (eid: string, range: MopSessionDateRangeBody) => {
      setSyncing(true);
      try {
        await syncMopTicketsApi(eid, range);
        await syncMopSessionsApi(eid, range);
        await syncMopStocksApi(eid, range);
        message.success("猫眼同步已完成（票种 → 场次 → 库存）");
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
