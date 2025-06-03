const assert = require('assert');
const { FfmpegEncoder } = require('./stubs/FfmpegEncoder');

const dummyFrame = new Uint8Array([0xff,0xd8,0xff,0xd9]);

const encoder = new FfmpegEncoder(60, 'mp4', false, false, null, true, 'h264', []);
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

(async () => {
  await encoder.addFrame(dummyFrame);
  await encoder.addFrame(dummyFrame);
  const data = await encoder.encode();
  assert.ok(data[4] === 0x66 && data[5] === 0x74 && data[6] === 0x79 && data[7] === 0x70);
  console.log('ffmpeg encoder test ok');
})();
