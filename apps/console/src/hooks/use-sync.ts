import { App } from "antd";
import { useCallback, useState } from "react";
import {
  syncExhibitionToDamaiApi,
  syncExhibitionToMopApi,
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
