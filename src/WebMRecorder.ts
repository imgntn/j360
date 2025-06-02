export class WebMRecorder {
  private recorder: MediaRecorder;
  private chunks: Blob[] = [];
  private stream: MediaStream;

  constructor(private canvas: HTMLCanvasElement, fps = 60, includeAudio = true) {
    this.stream = (canvas as any).captureStream(fps);
    if (includeAudio && navigator.mediaDevices?.getUserMedia) {
      navigator.mediaDevices.getUserMedia({ audio: true }).then(mic => {
        mic.getAudioTracks().forEach(t => this.stream.addTrack(t));
      }).catch(() => {
        console.warn('Microphone access denied or unavailable');
      });
    }
    this.recorder = new MediaRecorder(this.stream, {
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
