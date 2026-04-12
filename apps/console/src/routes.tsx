import React from "react";
import type { RouteObject } from "react-router";
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
  SecurityScanOutlined,
} from "@ant-design/icons";
import Order from "./pages/order";

const GRAFANA_PREFIX_URL = window.location.origin.includes("localhost")
  ? "https://errows.ghostiee.cc"
  : window.location.origin;

/** 未匹配任何路由时的跳转目标；与 App.tsx 中 `path: "*"` 兜底保持一致 */
export const APP_FALLBACK_PATH = "/exhibition" as const;

// 页面组件懒加载
const Banners = React.lazy(() => import("./pages/banners"));
const News = React.lazy(() => import("./pages/news"));
const Exhibition = React.lazy(() => import("./pages/exhibition"));
const CommonLayout = React.lazy(() => import("./layout/common"));
const ExhibitionDetail = React.lazy(() => import("./pages/exhibition/detail"));
const Category = React.lazy(() => import("./pages/category"));
const CategoryDetail = React.lazy(() => import("./pages/category/detail"));

const Role = React.lazy(() => import("./pages/user/role"));
const User = React.lazy(() => import("./pages/user"));
// 路由配置类型
export interface RouteConfig {
  /** 路由路径；`index: true` 的叶子可省略 */
  path?: string;
  /** 是否为父路由下的 index（对应 `/exhibition` 本页） */
  index?: boolean;
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
  // {
  //   path: "/banners",
  //   name: "轮播图",
  //   icon: <PictureOutlined />,
  //   element: <Banners />,
  // },
  // {
  //   path: "/news",
  //   name: "新闻",
  //   icon: <DashboardOutlined />,
  //   element: <News />,
  // },
  {
    path: "/exhibition",
    name: "展会",
    icon: <CalendarOutlined />,
    element: <CommonLayout />,
    // permission: "permission_exhibition_manage",
    children: [
      {
        index: true,
        name: "展览列表",
        hideInMenu: true,
        element: <Exhibition />,
      },
      {
        path: ":eid",
        name: "展会详情",
        hideInMenu: true,
        element: <ExhibitionDetail />,
      },
    ],
  },
  {
    path: "/category",
    name: "分类",
    icon: <AppstoreOutlined />,
    element: <CommonLayout />,
    permission: "permission_article_manage",
    children: [
      {
        index: true,
        name: "分类列表",
        hideInMenu: true,
        element: <Category />,
      },
      {
        path: ":tid",
        name: "话题详情",
        hideInMenu: true,
        element: <CategoryDetail />,
      },
    ],
  },
  //这里到时候要区分测试环境和生产环境
  {
    path: "/content",
    name: "内容管理",
    icon: <FileTextOutlined />,
    element: <CommonLayout />,
    children: [
      {
        path: "aa88d1ad-7faa-4243-98f0-7a73d524cd4b",
        name: "轮播图",
        icon: <PictureOutlined />,
        element: <CategoryDetail />,
        permission: "banner_manage",
      },
      {
        path: "c59d1736-35b3-46cc-9893-97677d576f55",
        name: "新闻",
        icon: <DashboardOutlined />,
        element: <CategoryDetail />,
        permission: "news_manage",
      },
      {
        path: "de47573b-d515-4000-abc4-c0174885bdb0",
        name: "品牌合作",
        icon: <TeamOutlined />,
        element: <CategoryDetail />,
        permission: "brand_cooperation_manage",
      },
      {
        path: "55a8ecee-9f48-431c-9e28-008e4f5cbb6f",
        name: "隐私政策",
        icon: <QuestionCircleOutlined />,
        element: <CategoryDetail />,
        permission: "privacy_policy_manage",
      },
    ],
  },
  {
    path: "/order",
    name: "订单",
    icon: <DollarOutlined />,
    element: <Order />,
    permission: "permission_order_manage",
  },
  {
    path: "/permission",
    name: "权限",
    icon: <SecurityScanOutlined />,
    element: <CommonLayout />,
    permission: "permission_user_manage",
    children: [
      {
        path: "user",
        name: "用户",
        icon: <UserOutlined />,
        element: <User />,
      },
      {
        path: "role",
        name: "角色",
        icon: <TeamOutlined />,
        element: <Role />,
      },
    ],
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

/** 侧栏菜单中展示的路由（排除 hideInMenu） */
export function routesForMenu(
  routeList: RouteConfig[] = routes,
): RouteConfig[] {
  return routeList
    .filter((r) => !r.hideInMenu)
    .map((r) => ({
      ...r,
      children: r.children?.length ? routesForMenu(r.children) : undefined,
    }));
}

// 将路由配置转换为菜单数据（供 ProLayout 使用）
export function getMenuData(routeList: RouteConfig[] = routes): MenuData[] {
  return routeList.map(
    (route): MenuData => ({
      path: route.path ?? "",
      name: route.name,
      icon: route.icon,
      linkUrl: route.linkUrl,
      children: route.children ? getMenuData(route.children) : undefined,
    }),
  );
}

/** 去掉前导 /，供作为父级 `/` 下的子 path 使用 */
function stripLeadingSlash(p: string): string {
  return p.replace(/^\/+/, "");
}

/**
 * 将菜单用 RouteConfig 转为 react-router 的 RouteObject（用于 useRoutes，避免 JSX 子节点只能是 Route 的限制）
 */
export function routeConfigToRouteObject(config: RouteConfig): RouteObject {
  if (config.children?.length) {
    const parentPath = config.path;
    if (!parentPath || !config.element) {
      throw new Error("带 children 的路由必须提供 path 与 element（布局）");
    }
    return {
      path: stripLeadingSlash(parentPath),
      element: config.element,
      children: config.children.map((child): RouteObject => {
        if (child.index) {
          return { index: true, element: child.element };
        }
        if (!child.path || !child.element) {
          throw new Error("子路由须为 index 或提供 path + element");
        }
        return { path: child.path, element: child.element };
      }),
    };
  }
  if (!config.path || !config.element) {
    throw new Error("叶子路由必须提供 path 与 element");
  }
  return {
    path: stripLeadingSlash(config.path),
    element: config.element,
  };
}
