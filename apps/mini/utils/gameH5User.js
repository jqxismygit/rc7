import { useUserStore } from "@/stores/user.js";

/**
 * 从当前登录用户 profile 取 H5 透传字段
 * @returns {{ id: string; avatar: string; nickname: string }}
 */
export function pickUserFromStore() {
  const p = useUserStore().profile || {};
  const extra = p.profile && typeof p.profile === "object" ? p.profile : {};
  return {
    id: p.id != null ? String(p.id) : "",
    avatar: p.avatar || extra.avatar || "",
    nickname: p.nickname || p.name || extra.nickname || extra.name || "",
  };
}

/**
 * 页面 onLoad 入参优先，空则回退到 store
 * @param {Record<string, string | undefined>} options
 * @param {{ id: string; avatar: string; nickname: string }} fromStore
 */
export function mergeUserForH5(options, fromStore) {
  const o = options || {};
  const pick = (key) => {
    const v = o[key];
    if (v != null && String(v).trim() !== "") return String(v);
    return fromStore[key] || "";
  };
  return {
    id: pick("id"),
    avatar: pick("avatar"),
    nickname: pick("nickname"),
  };
}

/**
 * 将用户字段拼到 H5 地址 query（H5 已含 ? 则用 &）
 * @param {string} href
 * @param {{ id: string; avatar: string; nickname: string }} user
 * @returns {string}
 */
/**
 * 小程序运行环境无 URLSearchParams，需手写 query
 * @param {string} key
 * @param {string} value
 * @returns {string}
 */
function enc(key, value) {
  return `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`;
}

export function appendUserQueryToH5Url(href, user) {
  if (!href) return "";
  const parts = [];
  if (user.id) parts.push(enc("id", user.id));
  if (user.avatar) parts.push(enc("avatar", user.avatar));
  if (user.nickname) parts.push(enc("nickname", user.nickname));
  if (!parts.length) return href;
  const qs = parts.join("&");
  return href + (href.includes("?") ? "&" : "?") + qs;
}
