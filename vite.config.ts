import { defineConfig } from 'vite';
export default defineConfig({base:'./',root:'.',build:{outDir:'dist',emptyOutDir:false,target:'es2022',rollupOptions:{input:{popup:'src/pages/popup/index.html',options:'src/pages/options/index.html',vomnibar:'src/pages/vomnibar/index.html'},output:{entryFileNames:'assets/[name].js',assetFileNames:'assets/[name][extname]'}}}});
