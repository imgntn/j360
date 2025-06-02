declare const THREE: any;
declare const CCapture: any;
interface Window {
  startCapture360: () => void;
  stopCapture360: () => void;
  startWebMRecording: () => void;
  stopWebMRecording: () => Promise<void>;
  stopWebMRecordingForCli: () => Promise<ArrayBuffer | null>;
  startWebCodecsRecording: () => void;
  stopWebCodecsRecording: () => Promise<void>;
  stopWebCodecsRecordingForCli: () => Promise<ArrayBuffer | null>;
  toggleStereo: () => void;
  captureFrameAsync: () => Promise<void>;
  enterVR: () => void;
  startWasmRecording: () => void;
  stopWasmRecordingForCli: () => Promise<ArrayBuffer | null>;
  startStreaming: (url: string) => void;
  stopStreaming: () => void;
  startHLS: (url: string) => void;
  stopHLS: () => void;
}

interface Navigator {
  xr?: any;
}

type XRSession = any;
