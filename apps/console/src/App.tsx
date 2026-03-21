import { Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router";
import { Spin, ConfigProvider } from "antd";
import Login from "./pages/login";
import BasicLayout from "./layout";
import { flattenRoutes, routes } from "./routes";

const flatRoutes = flattenRoutes(routes);
import zhCN from "antd/locale/zh_CN";
import "./App.less";

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
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<BasicLayout />}>
              {flatRoutes.map((route) => (
                <Route
                  key={route.path}
                  path={route.path}
                  element={route.element}
                />
              ))}
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </ConfigProvider>
  );
}

export default App;
