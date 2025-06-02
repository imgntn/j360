import { createFFmpeg, fetchFile } from '@ffmpeg/ffmpeg';

export class FfmpegEncoder {
  private ffmpeg = createFFmpeg({ log: true });
  private frames: Uint8Array[] = [];
  constructor(private fps = 60, private format: 'mp4' | 'webm' = 'mp4') {}

  async init() {
    if (!this.ffmpeg.isLoaded()) {
      await this.ffmpeg.load();
    }
  }

  addFrame(data: Uint8Array) {
    this.frames.push(data);
  }

  async encode(onProgress?: (percent: number) => void): Promise<Uint8Array> {
    const { ffmpeg, fps, format } = this;
    if (onProgress) {
      ffmpeg.setProgress(({ ratio }) => {
        const pct = Math.min(100, Math.round(ratio * 100));
        onProgress(pct);
      });
    }
    for (let i = 0; i < this.frames.length; i++) {
      ffmpeg.FS('writeFile', `${i}.jpg`, this.frames[i]);
    }
    const out = `out.${format}`;
    await ffmpeg.run('-framerate', String(fps), '-i', '%d.jpg', '-pix_fmt', 'yuv420p', out);
    const data = ffmpeg.FS('readFile', out);
    ffmpeg.FS('unlink', out);
    for (let i = 0; i < this.frames.length; i++) {
      ffmpeg.FS('unlink', `${i}.jpg`);
    }
    this.frames = [];
    return data;
  }
}
