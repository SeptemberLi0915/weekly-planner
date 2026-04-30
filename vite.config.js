import { defineConfig } from 'vite';

export default defineConfig({
  base: '/weekly-planner/',
  build: {
    rollupOptions: {
      output: {
        entryFileNames: 'assets/app.js',
        chunkFileNames: 'assets/chunk-[name].js',
        assetFileNames: assetInfo => {
          if (assetInfo.name && assetInfo.name.endsWith('.css')) {
            return 'assets/app.css';
          }
          return 'assets/[name][extname]';
        }
      }
    }
  },
  server: {
    allowedHosts: true
  }
});
