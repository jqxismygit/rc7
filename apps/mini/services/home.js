// 首页相关 mock 服务
import {
  mockHomeCards,
  mockBrands,
  mockMessages,
  mockHeroBanners,
  mockHotTickets,
  mockHotEvents,
  mockHotWorldcup,
  mockCr7ZoneEntries
} from '@/utils/mockData.js'

const MOCK_DELAY = 200

const delay = (result) =>
  new Promise((resolve) => {
    setTimeout(() => resolve(result), MOCK_DELAY)
  })

/**
 * 获取首页 Banner / 信息流卡片
 * 后续接真接口时，可直接改为 request.get('/cms/home/banners')
 */
export function fetchHomeCards() {
  const list = mockHomeCards.map((item) => ({ ...item }))
  return delay(list)
}

/**
 * 获取联名品牌列表
 * 对齐 PRD「联名品牌墙」
 */
export function fetchBrands() {
  const list = mockBrands.map((item) => ({ ...item }))
  return delay(list)
}

/**
 * 获取首页 Hero Banners
 */
export function fetchHeroBanners() {
  const list = mockHeroBanners.map((item) => ({ ...item }))
  return delay(list)
}

/**
 * 获取首页热门活动数据
 */
export function fetchHotTickets() {
  return delay(mockHotTickets.map((item) => ({ ...item })))
}

export function fetchHotEvents() {
  return delay(mockHotEvents.map((item) => ({ ...item })))
}

export function fetchHotWorldcup() {
  return delay(mockHotWorldcup.map((item) => ({ ...item })))
}

export function fetchCr7Zone() {
  return delay(mockCr7ZoneEntries.map((item) => ({ ...item })))
}

/**
 * 获取首页消息红点数量
 * 这里复用消息 mock，方便 index 与 messages 逻辑统一
 */
export async function fetchHomeUnreadCount() {
  const unread = mockMessages.filter((item) => !item.isRead).length
  return delay(unread)
}

