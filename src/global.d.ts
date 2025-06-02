declare const THREE: any;
declare const CCapture: any;
interface Window {
  startCapture360: () => void;
  stopCapture360: () => void;
  startWebMRecording: () => void;
  stopWebMRecording: () => Promise<void>;
  stopWebMRecordingForCli: () => Promise<ArrayBuffer | null>;
  toggleStereo: () => void;
  captureFrameAsync: () => Promise<void>;
  enterVR: () => void;
}

interface Navigator {
  xr?: any;
}

type XRSession = any;
