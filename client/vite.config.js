import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  publicDir: '../public',
  server: {
    port: 5173,
    proxy: {
      '/game': { target: 'http://localhost:4000', changeOrigin: false },
      '/games': { target: 'http://localhost:4000', changeOrigin: false }
    }
  },
  preview: {port: 4173}
});
