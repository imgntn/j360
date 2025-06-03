class FfmpegEncoder {
  constructor() { this.frames = []; this.ffmpeg = null; }
  async init() {}
  addProcessor() {}
  async addFrame(data) { this.frames.push(data); }
  async encode() { return Uint8Array.from([0,0,0,0,0x66,0x74,0x79,0x70]); }
}
module.exports = { FfmpegEncoder };
