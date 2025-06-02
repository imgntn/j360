import { createFFmpeg, fetchFile } from '@ffmpeg/ffmpeg';

export class FfmpegEncoder {
  private ffmpeg = createFFmpeg({ log: true });
  private frames: Uint8Array[] = [];
  private chunks: Uint8Array[] = [];
  private chunkSize = 60;
  private audioRec: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private audioData: Uint8Array | null = null;
  constructor(
    private fps = 60,
    private format: 'mp4' | 'webm' = 'mp4',
    private incremental = false,
    private includeAudio = false,
    private extAudioData: Uint8Array | null = null
  ) {}

  async init() {
    if (!this.ffmpeg.isLoaded()) {
      await this.ffmpeg.load();
    }
    if (this.includeAudio && !this.extAudioData && navigator.mediaDevices?.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        this.audioRec = new MediaRecorder(stream, { mimeType: 'audio/webm' });
        this.audioRec.ondataavailable = e => { if (e.data.size > 0) this.audioChunks.push(e.data); };
        this.audioRec.start();
      } catch {
        console.warn('Microphone unavailable');
      }
    }
  }

  addFrame(data: Uint8Array) {
    this.frames.push(data);
    if (this.incremental && this.frames.length >= this.chunkSize) {
      return this.encodeChunk();
    }
  }

  private async encodeChunk() {
    const { ffmpeg, fps, format } = this;
    for (let i = 0; i < this.frames.length; i++) {
      ffmpeg.FS('writeFile', `${i}.jpg`, this.frames[i]);
    }
    const out = `chunk${this.chunks.length}.${format}`;
    await ffmpeg.run('-framerate', String(fps), '-i', '%d.jpg', '-pix_fmt', 'yuv420p', out);
    const data = ffmpeg.FS('readFile', out);
    ffmpeg.FS('unlink', out);
    for (let i = 0; i < this.frames.length; i++) {
      ffmpeg.FS('unlink', `${i}.jpg`);
    }
    this.frames = [];
    this.chunks.push(data);
  }

  async encode(onProgress?: (percent: number) => void): Promise<Uint8Array> {
    const { ffmpeg, fps, format } = this;
    if (onProgress) {
      ffmpeg.setProgress(({ ratio }) => {
        const pct = Math.min(100, Math.round(ratio * 100));
        onProgress(pct);
      });
    }
    if (this.audioRec) {
      this.audioData = await new Promise(resolve => {
        this.audioRec!.onstop = () => {
          const blob = new Blob(this.audioChunks, { type: 'audio/webm' });
          blob.arrayBuffer().then(buf => resolve(new Uint8Array(buf)));
        };
        this.audioRec!.stop();
      });
    }
    if (this.extAudioData) {
      this.audioData = this.extAudioData;
    }
    if (this.incremental) {
      if (this.frames.length) {
        await this.encodeChunk();
      }
      if (this.chunks.length === 1) {
        const data = this.chunks[0];
        this.chunks = [];
        return data;
      }
      for (let i = 0; i < this.chunks.length; i++) {
        ffmpeg.FS('writeFile', `chunk${i}.${format}`, this.chunks[i]);
      }
      let list = '';
      for (let i = 0; i < this.chunks.length; i++) {
        list += `file chunk${i}.${format}\n`;
      }
      ffmpeg.FS('writeFile', 'concat.txt', list);
      const out = `out.${format}`;
      await ffmpeg.run('-f', 'concat', '-safe', '0', '-i', 'concat.txt', '-c', 'copy', out);
      const data = ffmpeg.FS('readFile', out);
      ffmpeg.FS('unlink', out);
      ffmpeg.FS('unlink', 'concat.txt');
      for (let i = 0; i < this.chunks.length; i++) {
        ffmpeg.FS('unlink', `chunk${i}.${format}`);
      }
      this.chunks = [];
      return data;
    } else {
      for (let i = 0; i < this.frames.length; i++) {
        ffmpeg.FS('writeFile', `${i}.jpg`, this.frames[i]);
      }
      const out = `out.${format}`;
      const args = ['-framerate', String(fps), '-i', '%d.jpg'];
      if (this.audioData) {
        ffmpeg.FS('writeFile', 'audio.webm', this.audioData);
        args.push('-i', 'audio.webm', '-shortest');
      }
      args.push('-pix_fmt', 'yuv420p', out);
      await ffmpeg.run(...args);
      const data = ffmpeg.FS('readFile', out);
      ffmpeg.FS('unlink', out);
      if (this.audioData) ffmpeg.FS('unlink', 'audio.webm');
      for (let i = 0; i < this.frames.length; i++) {
        ffmpeg.FS('unlink', `${i}.jpg`);
      }
      this.frames = [];
      return data;
    }
  }
}
