export class WebRTCStreamer {
  private pc: RTCPeerConnection;
  private stream: MediaStream;
  constructor(private canvas: HTMLCanvasElement, private signal: (msg: any) => void) {
    this.stream = (canvas as any).captureStream();
    this.pc = new RTCPeerConnection();
    this.stream.getTracks().forEach(t => this.pc.addTrack(t, this.stream));
    this.pc.onicecandidate = e => {
      if (e.candidate) this.signal({ candidate: e.candidate });
    };
  }

  async start() {
    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);
    this.signal({ offer });
  }

  async stop() {
    this.pc.close();
  }

  async handle(msg: any) {
    if (msg.answer) {
      await this.pc.setRemoteDescription(new RTCSessionDescription(msg.answer));
    } else if (msg.candidate) {
      await this.pc.addIceCandidate(msg.candidate);
    }
  }
}
