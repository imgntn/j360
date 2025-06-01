declare const THREE: any;
declare const CCapture: any;
interface Window {
  startCapture360: () => void;
  stopCapture360: () => void;
  startWebMRecording: () => void;
  stopWebMRecording: () => Promise<void>;
  toggleStereo: () => void;
}
