import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteStaticCopy } from 'vite-plugin-static-copy';

export default defineConfig({
  plugins: [react(), viteStaticCopy({
    targets: [
        { src: 'js/api/*.js', dest: '.' },
        { src: 'js/components/*.js', dest: '.' },
        { src: 'js/main/*.js', dest: '.' },
        { src: 'images/*', dest: '.'},
        { src: 'images/icons/Nha_Nghien_Than.png', dest: '.'}
    ],
  }),
  ],
  resolve: {
    dedupe: ['react', 'react-dom', '@pixi/react', 'pixi.js'],
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true
  },
  server: {
    port: 3000,
    open: true,
  },
  preview: {
    port: 4173,
    open: true,
  },
});