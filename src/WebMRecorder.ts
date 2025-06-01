export class WebMRecorder {
  private recorder: MediaRecorder;
  private chunks: Blob[] = [];

  constructor(private canvas: HTMLCanvasElement, fps = 60) {
    const stream = (canvas as any).captureStream(fps);
    this.recorder = new MediaRecorder(stream, {
      mimeType: 'video/webm;codecs=vp9'
    });
    this.recorder.ondataavailable = (e: BlobEvent) => {
      if (e.data.size > 0) this.chunks.push(e.data);
    };
  }

  start() {
    this.chunks = [];
    this.recorder.start();
  }

  stop(): Promise<Blob> {
    return new Promise((resolve) => {
      this.recorder.onstop = () => {
        resolve(new Blob(this.chunks, { type: 'video/webm' }));
      };
      this.recorder.stop();
    });
  }
}
