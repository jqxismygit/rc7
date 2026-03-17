// 协议与隐私政策 mock 服务
import { mockLegalContent } from '@/utils/mockData.js'

const MOCK_DELAY = 200

const delay = (result) =>
  new Promise((resolve) => {
    setTimeout(() => resolve(result), MOCK_DELAY)
  })

/**
 * 拉取用户协议 / 隐私政策内容
 * @param {'terms' | 'privacy'} type
 */
export function fetchLegalContent(type) {
  const html = mockLegalContent[type] || ''
  return delay(html)
}

