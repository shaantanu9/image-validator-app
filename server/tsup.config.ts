import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/server.ts'],
  outDir: 'dist',
  target: 'node20',
  platform: 'node',
  format: ['cjs'],
  splitting: false,
  sourcemap: true,
  clean: true,
  bundle: true,
  shims: false,
  dts: false,
  env: {
    NODE_ENV: 'production',
  },
});
