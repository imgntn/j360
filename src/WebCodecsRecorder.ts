export class WebCodecsRecorder {
  private encoder: VideoEncoder | null = null;
  private frames: { data: Uint8Array; timestamp: number }[] = [];
  private audioRec: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private frameCount = 0;
  constructor(
    private canvas: HTMLCanvasElement,
    private fps = 60,
    private includeAudio = true,
    private bitrate = 5_000_000,
    private codec: 'vp9' | 'av1' = 'vp9'
  ) {}

  async init() {
    if (!(window as any).VideoEncoder) {
      throw new Error('WebCodecs not supported');
    }
    const width = this.canvas.width;
    const height = this.canvas.height;
    this.encoder = new VideoEncoder({
      output: (chunk) => {
        const buf = new Uint8Array(chunk.byteLength);
        chunk.copyTo(buf);
        this.frames.push({ data: buf, timestamp: chunk.timestamp });
      },
      error: (e) => console.error(e)
    });
    const codecStr = this.codec === 'av1' ? 'av01.0.08M.08' : 'vp09.00.10.08';
    const support = await (VideoEncoder as any).isConfigSupported({
      codec: codecStr,
      width,
      height,
      bitrate: this.bitrate,
      framerate: this.fps
    });
    this.encoder.configure(support.config);
    if (this.includeAudio && navigator.mediaDevices?.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        this.audioRec = new MediaRecorder(stream, { mimeType: 'audio/webm' });
        this.audioRec.ondataavailable = (e) => {
          if (e.data.size > 0) this.audioChunks.push(e.data);
        };
        this.audioRec.start();
      } catch {
        console.warn('Microphone unavailable');
      }
    }
  }

  start() {
    this.frames = [];
    this.frameCount = 0;
  }

  addFrame() {
    if (!this.encoder) return;
    const bmp = this.canvas.transferToImageBitmap();
    const frame = new VideoFrame(bmp, { timestamp: (1e6 / this.fps) * this.frameCount });
    this.encoder.encode(frame);
    frame.close();
    bmp.close();
    this.frameCount++;
  }

  private buildIvf(): Uint8Array {
    const header = new Uint8Array(32);
    const dv = new DataView(header.buffer);
    header.set([0x44, 0x4b, 0x49, 0x46], 0); // DKIF
    dv.setUint16(4, 0, true);
    dv.setUint16(6, 32, true);
    header.set([0x56, 0x50, 0x39, 0x30], 8); // VP90
    dv.setUint16(12, this.canvas.width, true);
    dv.setUint16(14, this.canvas.height, true);
    dv.setUint32(16, this.fps, true);
    dv.setUint32(20, 1, true);
    dv.setUint32(24, this.frames.length, true);
    dv.setUint32(28, 0, true);
    const bufs: Uint8Array[] = [header];
    for (const f of this.frames) {
      const fh = new Uint8Array(12);
      const dvf = new DataView(fh.buffer);
      dvf.setUint32(0, f.data.length, true);
      dvf.setUint32(4, Math.floor(f.timestamp / 1000), true);
      bufs.push(fh, f.data);
    }
    const total = bufs.reduce((n, b) => n + b.length, 0);
    const out = new Uint8Array(total);
    let off = 0;
    for (const b of bufs) {
      out.set(b, off);
      off += b.length;
    }
    return out;
  }

  async stop(): Promise<Blob> {
    if (!this.encoder) throw new Error('not started');
    await this.encoder.flush();
    this.encoder.close();
    let audio: Blob | null = null;
    if (this.audioRec) {
      audio = await new Promise((resolve) => {
        this.audioRec!.onstop = () => resolve(new Blob(this.audioChunks, { type: 'audio/webm' }));
        this.audioRec!.stop();
      });
    }
    const ivf = this.buildIvf();
    const parts: BlobPart[] = [ivf];
    const type = 'video/webm';
    if (audio) parts.push(audio);
    return new Blob(parts, { type });
  }
}
