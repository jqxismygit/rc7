import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import svgr from "vite-plugin-svgr";
import { resolve } from "path";

const envPrefix = ["VITE_"];

// https://vite.dev/config/

export default defineConfig(({ mode }) => {
  const { VITE_API_HOST, VITE_PORT } = loadEnv(mode, __dirname, envPrefix);
  console.log("VITE_API_HOST ========", VITE_API_HOST);
  return {
    plugins: [
      react(),
      tsconfigPaths(),
      svgr({
        // 启用 SVG 作为 React 组件
        svgrOptions: {
          exportType: "default",
          runtimeConfig: false,
          // 保留 SVG 的 viewBox 属性
          svgoConfig: {
            plugins: [
              {
                name: "preset-default",
                params: {
                  overrides: {
                    removeViewBox: false,
                  },
                },
              },
            ],
          },
        },
        include: "**/*.svg",
      }),
    ],
    server: {
      port: VITE_PORT ? parseInt(VITE_PORT) : 9527,
      host: true,
      proxy: {
        "/api": {
          target: `${VITE_API_HOST}`,
          changeOrigin: true,
        },
      },
    },
    resolve: {
      alias: {
        "@/*": resolve(__dirname, "src/*"),
      },
    },
  };
});
