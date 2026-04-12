import { Suspense, useMemo } from "react";
import { BrowserRouter, Navigate, useRoutes } from "react-router";
import type { RouteObject } from "react-router";
import { App as AntdApp, ConfigProvider, Spin } from "antd";
import Login from "./pages/login";
import BasicLayout from "./layout";
import { APP_FALLBACK_PATH, routeConfigToRouteObject, routes } from "./routes";
import zhCN from "antd/locale/zh_CN";
import { connect } from "./hooks/use-permissions";
import "./App.less";

function AppRoutes() {
  const appRouteObjects = useMemo((): RouteObject[] => {
    return [
      { path: "/login", element: <Login /> },
      {
        path: "/",
        element: <BasicLayout />,
        children: [
          { index: true, element: <Navigate to={APP_FALLBACK_PATH} replace /> },
          ...routes.map(routeConfigToRouteObject),
        ],
      },
      { path: "*", element: <Navigate to={APP_FALLBACK_PATH} replace /> },
    ];
  }, []);

  return useRoutes(appRouteObjects);
}

function App() {
  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        cssVar: false,
        hashed: false,
      }}
    >
      <AntdApp>
        <BrowserRouter>
          <Suspense
            fallback={
              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  height: "100vh",
                }}
              >
                <Spin size="large" />
              </div>
            }
          >
            <AppRoutes />
          </Suspense>
        </BrowserRouter>
      </AntdApp>
    </ConfigProvider>
  );
}

export default connect(App);
