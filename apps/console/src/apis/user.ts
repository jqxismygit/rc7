import { request } from "@/utils/request";

export const getProfile = async () => {
  // const res = await request.get("/api/user/info");
  return {
    id: 1,
    name: "admin",
    email: "admin@example.com",
    avatar:
      "https://gw.alipayobjects.com/zos/antfincdn/XAosXuNZyF/BiazfanxmamNRoxxVxka.png",
  };
};
