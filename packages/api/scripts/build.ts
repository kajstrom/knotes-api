import * as esbuild from 'esbuild';
import * as fs from 'fs';
import * as path from 'path';

const outDir = path.resolve(__dirname, '../dist');

// Ensure dist directory exists
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

esbuild
  .build({
    entryPoints: [path.resolve(__dirname, '../src/handler.ts')],
    outfile: path.resolve(outDir, 'index.js'),
    bundle: true,
    platform: 'node',
    target: 'node22',
    external: [],
    format: 'cjs',
    sourcemap: false,
  })
  .then(() => {
    console.log('Build completed successfully');
  })
  .catch((err) => {
    console.error('Build failed:', err);
    process.exit(1);
  });
