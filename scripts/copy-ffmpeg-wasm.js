import { mkdirSync, copyFileSync } from 'fs';

const src = 'node_modules/@ffmpeg/core/dist/esm';
const dest = 'public/ffmpeg';
mkdirSync(dest, { recursive: true });
copyFileSync(`${src}/ffmpeg-core.js`, `${dest}/ffmpeg-core.js`);
copyFileSync(`${src}/ffmpeg-core.wasm`, `${dest}/ffmpeg-core.wasm`);
console.log('Copied ffmpeg-core WASM to public/ffmpeg/');
