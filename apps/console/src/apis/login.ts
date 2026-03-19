import { request } from "@/utils/request";

export const loginApi = async (data: { email: string; password: string }) => {
  // const res = await request.post("/api/login", data);
  // return res.data;
  return {
    token: "1234567890",
    user: {
      id: 1,
      name: "admin",
      email: "admin@example.com",
      avatar:
        "https://gw.alipayobjects.com/zos/antfincdn/XAosXuNZyF/BiazfanxmamNRoxxVxka.png",
    },
  };
};
