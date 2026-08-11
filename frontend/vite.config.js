import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import { visualizer } from 'rollup-plugin-visualizer';
import Inspect from 'vite-plugin-inspect'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'

// https://vite.dev/config/
export default defineConfig({
  // Electron 环境使用相对路径，Web 环境使用根路径
  base: process.env.ELECTRON === 'true' ? './' : '/',
  plugins: [
    vue(),
    tailwindcss(),
    // 调试/分析插件仅在显式开启时加载（生产构建不携带）
    ...(process.env.ANALYZE === 'true' ? [visualizer({
      open: false,           // 构建完成后自动打开报告
      gzipSize: true,       // 显示 gzip 压缩后的大小
      brotliSize: true,     // 显示 Brotli 压缩后的大小
      filename: 'stats.html' // 报告文件名
    })] : []),
    ...(process.env.NODE_ENV !== 'production' ? [Inspect()] : []),  // 查看模块转换过程（仅开发）
    AutoImport({
      resolvers: [ElementPlusResolver()],
    }),
    Components({
      resolvers: [ElementPlusResolver()],
    }),
  ],
  // optimizeDeps: {
  //   force: false, // 不要强制预构建
  //   // 明确需要预构建的包
  //   include: [
  //     'vue',
  //     'vue-router',
  //     'pinia',
  //     'axios',
  //     'dayjs',
  //     'lodash-es',
  //     'naive-ui',
  //   ]
  // },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    proxy: {
      // 代理 API 请求
      '/api/v1': {
        target: 'http://localhost:3000', // 后端地址
        changeOrigin: true,
        // rewrite: (path) => path.replace(/^\/api/, '')
      },
      // 代理静态资源请求
      '/static': {
        target: 'http://localhost:3000',
        changeOrigin: true
      }
    }
  },
  build: {
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        // 三方大依赖独立分包，利于浏览器缓存（element-plus 走按需引入，不整包）
        manualChunks: {
          'three': ['three'],
          'tiptap': ['@tiptap/vue-3', '@tiptap/starter-kit', '@tiptap/extension-placeholder', '@tiptap/suggestion'],
        }
      }
    }
  }
})
