// 认证与登录相关服务（接入真实后端 API）
import request from "@/utils/request.js";

/**
 * 微信小程序登录 / 注册（真实接口）
 *
 * 文档：docs/api/user.md
 * 1）POST /api/user/login/wechat/mini  { code }
 *    -> 返回 { token }
 * 2）GET  /api/user/profile  携带 Authorization: Bearer ${token}
 *    -> 返回用户信息
 */
export async function loginWithWechatPhone() {
  // 1. 通过 uni.login 获取微信临时登录凭证 code
  const code = await new Promise((resolve, reject) => {
    uni.login({
      provider: "weixin",
      success(res) {
        if (res.code) {
          resolve(res.code);
        } else {
          reject(new Error("微信登录失败：未获取到 code"));
        }
      },
      fail(err) {
        reject(err);
      },
    });
  });

  // 2. 把 code 发给后端换取业务 token
  const loginRes = await request.post("/user/login/wechat/mini", { code });
  const token = loginRes?.token;

  if (!token) {
    throw new Error("登录接口未返回 token");
  }

  // 3. 使用 token 获取当前用户信息
  const profileRes = await request.get("/user/profile", {
    header: {
      Authorization: `Bearer ${token}`,
    },
  });

  const user = profileRes;

  // 目前后端暂未提供员工标识，这里默认 false，后续有字段再从 user 中取
  const isEmployee = false;

  return {
    user,
    token,
    isEmployee,
    isNewUser: false,
  };
}

/**
 * 使用当前 token 刷新用户信息（应用启动、前台唤醒等场景）
 * token 通过 request 拦截器自动注入
 */
export async function fetchProfile() {
  const profileRes = await request.get("/user/profile");
  return profileRes;
}

// // // 认证与登录相关 mock 服务
// import { mockUser, mockEmployee } from "@/utils/mockData.js";

// const MOCK_DELAY = 800;

// const delay = (result) =>
//   new Promise((resolve) => {
//     setTimeout(() => resolve(result), MOCK_DELAY);
//   });

// /**
//  * 模拟微信手机号一键登录 / 注册
//  * 真实环境下应调用后端「登录或注册」API
//  */
// export async function loginWithWechatPhone() {
//   // 随机模拟普通用户 / 员工账号
//   const isEmployee = Math.random() > 0.8;
//   const user = isEmployee ? mockEmployee : mockUser;

//   const token = "mock_token_" + Date.now();

//   return delay({
//     user,
//     token,
//     isEmployee,
//     isNewUser: false, // 后续接入后端时可由接口返回是否为新注册用户
//   });
// }

// export async function fetchProfile() {
//   const profileRes = {
//     id: "10001",
//     openId: "mock_openid_12345",
//     phone: "138****8888",
//     nickname: "CR7粉丝",
//     avatar: "/static/images/avatar-default.png",
//     email: "user@example.com",
//     isEmployee: false, // 是否为员工
//   };
//   return delay(profileRes);
// }
