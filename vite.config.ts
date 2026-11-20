import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Modos:
//  - (default)     build normal del juego en dist/
//  - single        juego en un único index.html autocontenido (dist-single/)
//  - real-single   Tablero Be OnlyOne (tablero.html) en un único archivo (dist-real/)
export default defineConfig(({ mode }) => {
  const single = mode === 'single' || mode === 'real-single';
  const real = mode === 'real-single';
  return {
    base: './',
    plugins: [react(), ...(single ? [viteSingleFile()] : [])],
    build: {
      outDir: real ? 'dist-real' : mode === 'single' ? 'dist-single' : 'dist',
      chunkSizeWarningLimit: 1200,
      rollupOptions: real ? { input: 'tablero.html' } : undefined,
    },
    test: { globals: true, environment: 'node' },
  };
});
