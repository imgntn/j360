const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ts = require('typescript');

const src = fs.readFileSync(path.join(__dirname, '../src/FfmpegEncoder.ts'), 'utf8');
const js = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const m = { exports: {} };
const Module = module.constructor;
const mod = new Module();
mod._compile(js, 'FfmpegEncoder.js');
const { FfmpegEncoder } = mod.exports;

const dummyFrame = new Uint8Array([0xff,0xd8,0xff,0xd9]);

const encoder = new FfmpegEncoder(60, 'mp4');
(encoder).ffmpeg = {
  isLoaded: () => true,
  setProgress: () => {},
  FS(cmd, name, data) {
    if (!this.store) this.store = {};
    if (cmd === 'writeFile') this.store[name] = data;
    if (cmd === 'readFile') return Uint8Array.from([0,0,0,0,0x66,0x74,0x79,0x70]);
    if (cmd === 'unlink') delete this.store[name];
  },
  async run() {}
};

encoder.addFrame(dummyFrame);
encoder.addFrame(dummyFrame);
(async () => {
  const data = await encoder.encode();
  assert.ok(data[4] === 0x66 && data[5] === 0x74 && data[6] === 0x79 && data[7] === 0x70);
  console.log('ffmpeg encoder test ok');
})();
