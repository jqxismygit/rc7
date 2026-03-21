import { Suspense, useMemo } from "react";
import { BrowserRouter, Navigate, useRoutes } from "react-router";
import type { RouteObject } from "react-router";
import { Spin, ConfigProvider } from "antd";
import Login from "./pages/login";
import BasicLayout from "./layout";
import { routeConfigToRouteObject, routes } from "./routes";
import zhCN from "antd/locale/zh_CN";
import "./App.less";

function AppRoutes() {
  const appRouteObjects = useMemo((): RouteObject[] => {
    return [
      { path: "/login", element: <Login /> },
      {
        path: "/",
        element: <BasicLayout />,
        children: routes.map(routeConfigToRouteObject),
      },
      { path: "*", element: <Navigate to="/" replace /> },
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
    </ConfigProvider>
  );
}

export default App;
