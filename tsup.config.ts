import { defineConfig } from 'tsup'

export default defineConfig({
  entryPoints: ['src/index.ts'],
  outDir: 'dist',
  minify: true,
  dts: true,
  sourcemap: true,
  format: 'esm',
});
