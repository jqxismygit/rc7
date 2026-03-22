/**
 * 轻量事件总线（Vue3 无 Vue 实例可用作 bus）
 * 跨页：请在 navigateTo 的 success 中 emit，确保目标页 onLoad 已 $once 注册
 */
export function createEventBus() {
  const all = new Map();
  const bus = {
    on(type, handler) {
      const list = all.get(type) || [];
      list.push(handler);
      all.set(type, list);
    },
    off(type, handler) {
      if (!handler) {
        all.delete(type);
        return;
      }
      const list = all.get(type) || [];
      all.set(
        type,
        list.filter((h) => h !== handler),
      );
    },
    once(type, handler) {
      const fn = (payload) => {
        handler(payload);
        bus.off(type, fn);
      };
      bus.on(type, fn);
    },
    emit(type, payload) {
      const list = [...(all.get(type) || [])];
      for (const fn of list) {
        fn(payload);
      }
    },
  };
  return bus;
}

/** 首页 → 购票页传递 ticketSection */
export const HOME_TICKET_SECTION_EVENT = "homeTicketSection";
