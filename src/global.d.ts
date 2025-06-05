interface Window {
  startCapture360: () => void;
  stopCapture360: () => void;
  startWebMRecording: () => void;
  stopWebMRecording: () => Promise<void>;
  stopWebMRecordingForCli: () => Promise<ArrayBuffer | null>;
  startWebCodecsRecording: (fps?: number, includeAudio?: boolean, codec?: 'vp9' | 'av1') => void;
  stopWebCodecsRecording: () => Promise<void>;
  stopWebCodecsRecordingForCli: () => Promise<ArrayBuffer | null>;
  startRecording: () => void;
  stopRecording: () => Promise<void>;
  stopWasmRecording: () => Promise<void>;
  toggleStereo: () => void;
  captureFrameAsync: () => Promise<void>;
  enterVR: () => void;
  startWasmRecording: (fps?: number, incremental?: boolean, includeAudio?: boolean, audioData?: Uint8Array, streamEncode?: boolean, codec?: 'h264' | 'vp9' | 'av1') => void;
  stopWasmRecordingForCli: () => Promise<ArrayBuffer | null>;
  startStreaming: (url: string) => void;
  stopStreaming: () => void;
  startHLS: (url: string) => void;
  stopHLS: () => void;
  startRTMP: (url: string) => void;
  stopRTMP: () => void;
}

interface Navigator {
  xr?: any;
}

type XRSession = any;
