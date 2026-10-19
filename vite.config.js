import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { allowedHosts: ['.app.github.dev'] },
  preview: { allowedHosts: ['.app.github.dev'] },
});
