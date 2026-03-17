// 认证与登录相关 mock 服务
import { mockUser, mockEmployee } from '@/utils/mockData.js'

const MOCK_DELAY = 800

const delay = (result) =>
  new Promise((resolve) => {
    setTimeout(() => resolve(result), MOCK_DELAY)
  })

/**
 * 模拟微信手机号一键登录 / 注册
 * 真实环境下应调用后端「登录或注册」API
 */
export async function loginWithWechatPhone() {
  // 随机模拟普通用户 / 员工账号
  const isEmployee = Math.random() > 0.8
  const user = isEmployee ? mockEmployee : mockUser

  const token = 'mock_token_' + Date.now()

  return delay({
    user,
    token,
    isEmployee,
    isNewUser: false // 后续接入后端时可由接口返回是否为新注册用户
  })
}

