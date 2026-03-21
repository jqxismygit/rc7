import React from "react";
import { LoginFormPage, ProFormText } from "@ant-design/pro-components";
import { MobileOutlined, LockOutlined } from "@ant-design/icons";
import { message } from "antd";
import { TOKEN_KEY } from "@/constants/index";
import type { AxiosError } from "axios";

import { loginApi } from "@/apis/index";

export default function Login() {
  const [loading, setLoading] = React.useState(false);

  async function handleFinish(values: {
    phone: string;
    password: string;
    remember?: boolean;
  }) {
    try {
      setLoading(true);
      const res = await loginApi(values);
      localStorage.setItem(TOKEN_KEY, res.token);
      message.success("登录成功");
      setTimeout(() => {
        window.location.href = "/exhibition";
      }, 200);
    } catch (error: unknown) {
      const status = (error as AxiosError)?.response?.status;
      if (status === 401 || status === 400) {
        message.error("手机号或密码错误");
      } else {
        message.error("登录失败");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <LoginFormPage
      logo="/vite.png"
      style={{ height: "100vh", width: "100%" }}
      title="CR7® LIFE Console"
      subTitle="CR7® LIFE 管理平台"
      onFinish={handleFinish}
      submitter={{
        searchConfig: { submitText: loading ? "登录中..." : "登录" },
      }}
      loading={loading}
      backgroundVideoUrl="https://gw.alipayobjects.com/v/huamei_gcee1x/afts/video/jXRBRK_VAwoAAAAAAAAAAAAAK4eUAQBr"
    >
      <ProFormText
        name="phone"
        fieldProps={{ size: "large", prefix: <MobileOutlined /> }}
        placeholder="请输入手机号"
        rules={[
          { required: true, message: "请输入手机号" },
          { pattern: /^1[3-9]\d{9}$/, message: "请输入正确的手机号" },
        ]}
      />
      <ProFormText.Password
        name="password"
        fieldProps={{ size: "large", prefix: <LockOutlined /> }}
        placeholder="请输入密码"
        rules={[
          { required: true, message: "请输入密码" },
          { min: 6, message: "密码至少6位" },
        ]}
      />
    </LoginFormPage>
  );
}
