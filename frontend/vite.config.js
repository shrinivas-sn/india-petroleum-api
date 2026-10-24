import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Local API for `npm run dev` / `npm run preview`; override when port 3000 is taken.
const API_TARGET = process.env.API_PROXY_TARGET || 'http://localhost:3000';
const API_PROXY = {
  '/v1': API_TARGET,
  '/health': API_TARGET,
};

export default defineConfig({
  plugins: [react()],
  server: { port: 5173, proxy: API_PROXY },
  // Lets `npm run preview` serve the built output against a local API.
  preview: { port: 4173, proxy: API_PROXY },
  build: { outDir: 'dist', emptyOutDir: true },
});
