import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    lib: {
      entry: 'src/j360.ts',
      name: 'j360',
      fileName: () => 'j360.js',
      formats: ['es']
    },
    rollupOptions: {
      input: {
        index: 'index.html',
        demo: 'demo.html'
      }
    }
  }
});
