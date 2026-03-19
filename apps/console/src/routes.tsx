import React from "react";
import { Navigate } from "react-router";
import {
  DashboardOutlined,
  UserOutlined,
  SettingOutlined,
  TeamOutlined,
  FileTextOutlined,
  PictureOutlined,
  VideoCameraOutlined,
  AppstoreOutlined,
  GlobalOutlined,
  DollarOutlined,
  CrownOutlined,
  SwapOutlined,
  GiftOutlined,
  ThunderboltOutlined,
  HeartOutlined,
  SmileOutlined,
  CalendarOutlined,
  SafetyOutlined,
  QuestionCircleOutlined,
  CustomerServiceOutlined,
  KeyOutlined,
  SignatureOutlined,
  IdcardOutlined,
  FundOutlined,
  LineChartOutlined,
  StockOutlined,
  TableOutlined,
} from "@ant-design/icons";

const GRAFANA_PREFIX_URL = window.location.origin.includes("localhost")
  ? "https://errows.ghostiee.cc"
  : window.location.origin;

// 页面组件懒加载
const Banners = React.lazy(() => import("./pages/banners"));
const News = React.lazy(() => import("./pages/news"));
const Exhibition = React.lazy(() => import("./pages/exhibition"));

// 路由配置类型
export interface RouteConfig {
  path: string;
  name: string;
  icon?: React.ReactNode;
  element?: React.ReactNode;
  children?: RouteConfig[];
  hideInMenu?: boolean;
  permission?: string;
  linkUrl?: string;
}

// 统一的路由和菜单配置
export const routes: RouteConfig[] = [
  {
    path: "/banners",
    name: "轮播图",
    icon: <PictureOutlined />,
    element: <Banners />,
  },
  {
    path: "/news",
    name: "新闻",
    icon: <DashboardOutlined />,
    element: <News />,
  },
  {
    path: "/exhibition",
    name: "展会",
    icon: <DashboardOutlined />,
    element: <Exhibition />,
  },
];

// 菜单数据类型
export interface MenuData {
  path: string;
  name: string;
  linkUrl?: string;
  icon?: React.ReactNode;
  children?: MenuData[];
}

// 根据权限过滤路由配置（保持树状结构）
export function filterRoutesByPermission(
  routeList: RouteConfig[],
  userPermissions: string[],
): RouteConfig[] {
  return routeList
    .filter((route) => {
      // 如果路由没有配置权限，保留
      if (!route.permission) {
        return true;
      }
      // 如果配置了权限，检查用户是否拥有该权限
      return userPermissions.includes(route.permission);
    })
    .map((route) => {
      // 如果有子路由，递归过滤
      if (route.children && route.children.length > 0) {
        const filteredChildren = filterRoutesByPermission(
          route.children,
          userPermissions,
        );
        // 返回包含过滤后子路由的路由
        return {
          ...route,
          children: filteredChildren.length > 0 ? filteredChildren : undefined,
        };
      }
      return route;
    })
    .filter((route) => {
      // 如果父路由有子路由但子路由全部被过滤掉，且父路由本身没有 element，则移除父路由
      if (route.children === undefined && !route.element) {
        return false;
      }
      return true;
    });
}

// 将路由配置转换为菜单数据（供 ProLayout 使用）
export function getMenuData(routeList: RouteConfig[] = routes): MenuData[] {
  return routeList.map(
    ({ path, name, icon, children, linkUrl }): MenuData => ({
      path,
      name,
      icon,
      linkUrl,
      children: children ? getMenuData(children) : undefined,
    }),
  );
}

// 扁平化路由配置（供 react-router 使用）
export function flattenRoutes(
  routeList: RouteConfig[] = routes,
): RouteConfig[] {
  return routeList.reduce<RouteConfig[]>((acc, route) => {
    // 如果有 element，直接添加
    if (route.element) {
      acc.push(route);
    }
    // 如果没有 element 但有 children，添加一个重定向到第一个子路由的路由
    else if (route.children && route.children.length > 0) {
      // 找到第一个有 element 的子路由
      const firstChildWithElement = route.children.find(
        (child) => child.element,
      );
      if (firstChildWithElement) {
        acc.push({
          path: route.path,
          name: route.name,
          icon: route.icon,
          element: <Navigate to={firstChildWithElement.path} replace />,
        });
      }
    }
    // 递归处理子路由
    if (route.children) {
      acc.push(...flattenRoutes(route.children));
    }
    return acc;
  }, []);
}
