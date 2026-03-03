// 消息相关 mock 服务
import { mockMessages } from '@/utils/mockData.js'

// 模拟网络延迟（毫秒）
const MOCK_DELAY = 200

const delay = (result) =>
  new Promise((resolve) => {
    setTimeout(() => resolve(result), MOCK_DELAY)
  })

/**
 * 获取消息列表
 */
export function fetchMessages() {
  // 这里返回深拷贝，避免调用方意外修改原始 mock 数据
  const list = mockMessages.map((item) => ({ ...item }))
  return delay(list)
}

/**
 * 获取未读消息数量
 */
export async function fetchUnreadCount() {
  const list = await fetchMessages()
  return list.filter((item) => !item.isRead).length
}

/**
 * 将全部未读设为已读（mock）
 * 真实环境下这里应调用后端批量已读接口
 */
export async function markAllAsRead() {
  const list = await fetchMessages()
  const updated = list.map((item) => ({ ...item, isRead: true }))
  return delay(updated)
}

/**
 * 删除所有已读消息（mock）
 */
export async function clearReadMessages() {
  const list = await fetchMessages()
  const remaining = list.filter((item) => !item.isRead)
  return delay(remaining)
}

