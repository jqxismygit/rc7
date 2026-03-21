import { Outlet } from "react-router";

/** 展会模块父级：挂载列表（index）与详情（:eid）子路由 */
export default function ExhibitionLayout() {
  return <Outlet />;
}
