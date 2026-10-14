import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages serve o site em /RJP-Navigator/.
// Um build local pode ser servido sob qualquer subpasta.
const isPages = process.env.RJP_GITHUB_PAGES === '1';
export default defineConfig({
  base: isPages ? '/RJP-Navigator/' : './',
  plugins: [react()],
  build: { outDir: 'dist' }
});
