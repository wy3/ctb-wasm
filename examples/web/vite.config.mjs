import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

const webRoot = path.dirname(fileURLToPath(import.meta.url))

/**
 * 配置浏览器示例的站点根目录、WASM 静态资源和构建输出目录。
 */
export default defineConfig({
  root: webRoot,
  publicDir: false,
  server: {
    host: '127.0.0.1',
  },
  build: {
    outDir: path.resolve(webRoot, '../web-dist'),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: path.resolve(webRoot, 'index.html'),
        en: path.resolve(webRoot, 'en.html'),
      },
    },
  },
})
