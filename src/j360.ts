'use strict';
import { WebMRecorder } from './WebMRecorder';
import { WebCodecsRecorder } from './WebCodecsRecorder';
import { CubemapToEquirectangular } from './CubemapToEquirectangular';
import { FfmpegEncoder } from './FfmpegEncoder';
import { WebRTCStreamer } from './WebRTCStreamer';
import { createWebGLProcessor } from './gpu-processors';
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import CCapture from "ccapture.js";

export class J360App {
  private jpegWorker = new Worker(new URL('./convertWorker.ts', import.meta.url), { type: 'module' });
  private capturer360 = new CCapture({ format: 'threesixty', display: true, autoSaveTime: 3 });
  private webmRecorder: WebMRecorder | null = null;
  private webCodecsRecorder: WebCodecsRecorder | null = null;
  private ffmpegEncoder: FfmpegEncoder | null = null;
  private scene: any;
  private camera: any;
  private renderer: any;
  private canvas: HTMLCanvasElement | null = null;
  private controls: any;
  private equiManaged: any;
  private meshes: any[] = [];
  private stereo = false;
  private recording = false;
  private vrSession: XRSession | null = null;
  private vrHud: HTMLElement | null = null;
  private streamer: WebRTCStreamer | null = null;
  private hlsUrl: string | null = null;
  private rtmpUrl: string | null = null;
  private remoteSocket: WebSocket | null = null;
  private intervalId: number | null = null;
  private frameCount = 0;
  private captureMode = '';
  private frameProcessors: ((frame: Uint8Array) => Uint8Array | Promise<Uint8Array>)[] = [];
  private adaptive = false;
  private lastTime = performance.now();
  private targetFps = 60;
  private avgDt = 16;
  private adaptiveMin = '1K';
  private adaptiveMax = '16K';
  private currentResolution = '4K';
  private startTime = 0;

  constructor() {
    this.init();
    this.animate();
    this.connectRemote(`ws://${location.hostname}:4000`);
  }

  private startCapture360 = () => {
    const resSel = document.getElementById('resolution') as HTMLSelectElement | null;
    if (resSel && this.equiManaged) {
      this.currentResolution = resSel.value;
      this.equiManaged.setResolution(resSel.value, true);
    }
    this.capturer360.start();
    this.frameCount = 0;
    this.captureMode = 'ccapture';
    this.recording = true;
    this.targetFps = 60;
    this.startTime = performance.now();
    this.updateVrHud();
  };

  private stopCapture360 = () => {
    this.capturer360.stop();
    this.recording = false;
    this.updateVrHud();
    this.sendRemoteStatus('stopped');
  };

  private startWebMRecording = (fps = 60, includeAudio = true) => {
    if (!this.webmRecorder) {
      const src = this.stereo ? this.equiManaged.getStereoCanvas() : (this.canvas as HTMLCanvasElement);
      this.webmRecorder = new WebMRecorder(src as HTMLCanvasElement, fps, includeAudio);
    }
    this.webmRecorder.start();
    this.frameCount = 0;
    this.captureMode = 'webm';
    this.recording = true;
    this.targetFps = fps;
    this.startTime = performance.now();
    this.updateVrHud();
    this.sendRemoteStatus('recording');
  };

  private startWebCodecsRecording = async (fps = 60, includeAudio = true, codec: 'vp9' | 'av1' = 'vp9') => {
    if (!this.webCodecsRecorder) {
      const src = this.stereo ? this.equiManaged.getStereoCanvas() : (this.canvas as HTMLCanvasElement);
      this.webCodecsRecorder = new WebCodecsRecorder(src as HTMLCanvasElement, fps, includeAudio, 5_000_000, codec);
      await this.webCodecsRecorder.init();
      this.webCodecsRecorder.start();
    }
    this.frameCount = 0;
    this.captureMode = 'webcodecs';
    this.recording = true;
    this.targetFps = fps;
    this.startTime = performance.now();
    this.updateVrHud();
  };

  private startHLS = (url: string) => {
    this.hlsUrl = url;
  };

  private stopHLS = () => {
    this.hlsUrl = null;
  };

  private startRTMP = (url: string) => {
    this.rtmpUrl = url;
  };

  private stopRTMP = () => {
    this.rtmpUrl = null;
  };

  private startRecording = () => {
    const sel = document.getElementById('capture-mode') as HTMLSelectElement | null;
    const mode = sel?.value || 'ccapture';
    if (mode === 'webm') this.startWebMRecording();
    else if (mode === 'webcodecs') this.startWebCodecsRecording();
    else if (mode === 'wasm') this.startWasmRecording();
    else this.startCapture360();
  };

  private stopRecording = async () => {
    if (this.captureMode === 'webm') await this.stopWebMRecording();
    else if (this.captureMode === 'webcodecs') await this.stopWebCodecsRecording();
    else if (this.captureMode === 'wasm') await this.stopWasmRecording();
    else this.stopCapture360();
    this.captureMode = '';
  };

  private stopWebMRecording = async () => {
    if (!this.webmRecorder) return;
    const blob = await this.webmRecorder.stop();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'capture.webm';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    this.webmRecorder = null;
    this.recording = false;
    this.updateVrHud();
    this.sendRemoteStatus('stopped');
  };

  private stopWebMRecordingForCli = async () => {
    if (!this.webmRecorder) return null;
    const blob = await this.webmRecorder.stop();
    const buffer = await blob.arrayBuffer();
    this.webmRecorder = null;
    this.recording = false;
    this.updateVrHud();
    return buffer;
  };

  private stopWebCodecsRecordingForCli = async () => {
    if (!this.webCodecsRecorder) return null;
    const blob = await this.webCodecsRecorder.stop();
    const buffer = await blob.arrayBuffer();
    this.webCodecsRecorder = null;
    this.recording = false;
    this.updateVrHud();
    this.sendRemoteStatus('stopped');
    return buffer;
  };

  private stopWebCodecsRecording = async () => {
    if (!this.webCodecsRecorder) return;
    const blob = await this.webCodecsRecorder.stop();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'capture.webm';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    this.webCodecsRecorder = null;
    this.recording = false;
    this.updateVrHud();
    this.sendRemoteStatus('stopped');
  };

  private startWasmRecording = async (
    fps = 60,
    incremental = false,
    includeAudio = false,
    audioData?: Uint8Array,
    streamEncode = false,
    codec: 'h264' | 'vp9' | 'av1' = 'h264'
  ) => {
    if (!this.ffmpegEncoder) {
      this.ffmpegEncoder = new FfmpegEncoder(
        fps,
        'mp4',
        incremental,
        includeAudio,
        audioData || null,
        streamEncode,
        codec,
        this.frameProcessors
      );
      await this.ffmpegEncoder.init();
      this.frameCount = 0;
      this.captureMode = 'wasm';
      this.recording = true;
      this.targetFps = fps;
      this.startTime = performance.now();
    }
  };

  private stopWasmRecordingForCli = async (onProgress?: (p: number) => void) => {
    if (!this.ffmpegEncoder) return null;
    const data = await this.ffmpegEncoder.encode(p => {
      const elapsed = Math.floor((performance.now() - this.startTime) / 1000);
      this.sendRemoteStatus({ progress: p, mode: 'encoding', frame: this.frameCount, elapsed });
      if (onProgress) onProgress(p);
    });
    this.ffmpegEncoder = null;
    this.recording = false;
    this.sendRemoteStatus('stopped');
    return data.buffer;
  };

  private stopWasmRecording = async () => {
    const buf = await this.stopWasmRecordingForCli();
    if (!buf) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([buf], { type: 'video/mp4' }));
    a.download = 'capture.mp4';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  private startStreaming = (signalUrl: string) => {
    if (!this.canvas) return;
    this.streamer = new WebRTCStreamer(this.canvas, msg => {
      fetch(signalUrl, { method: 'POST', body: JSON.stringify(msg) }).catch(() => {});
    });
    this.streamer.start();
  };

  private stopStreaming = () => {
    this.streamer?.stop();
    this.streamer = null;
  };

  private connectRemote = (url: string) => {
    try {
      this.remoteSocket?.close();
      this.remoteSocket = new WebSocket(url);
      this.remoteSocket.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          if (msg.command === 'start') this.startWebMRecording();
          else if (msg.command === 'stop') this.stopWebMRecording();
          else if (msg.command === 'stereo') this.toggleStereo();
        } catch {}
      };
    } catch (e) {
      console.error(e);
    }
  };

  private sendRemoteStatus = (msg: string | { status?: string; progress?: number; mode?: string }) => {
    try {
      if (typeof msg === 'string') {
        this.remoteSocket?.send(JSON.stringify({ status: msg }));
      } else {
        this.remoteSocket?.send(JSON.stringify(msg));
      }
    } catch {}
  };

  private toggleStereo = () => {
    this.stereo = !this.stereo;
    this.sendRemoteStatus(this.stereo ? 'stereo-on' : 'stereo-off');
  };

  private toggleAdaptive = () => {
    this.adaptive = !this.adaptive;
  };

  public addFrameProcessor(p: (frame: Uint8Array) => Uint8Array | Promise<Uint8Array>) {
    this.frameProcessors.push(p);
  }

  public setAdaptiveRange(min: string, max: string) {
    this.adaptiveMin = min;
    this.adaptiveMax = max;
  }

  private updateVrHud = () => {
    if (this.vrHud) {
      if (this.recording) {
        const elapsed = Math.floor((performance.now() - this.startTime) / 1000);
        this.vrHud.textContent = `REC ${this.frameCount}f ${elapsed}s`;
      } else {
        this.vrHud.textContent = '';
      }
    }
  };

  private onVrSelect = () => {
    if (this.recording) {
      this.stopRecording();
    } else {
      this.startRecording();
    }
    this.updateVrHud();
  };

  private onVrSqueeze = () => {
    this.toggleStereo();
    this.updateVrHud();
  };

  private enterVR = async () => {
    if (!navigator.xr) return;
    if (this.vrSession) {
      this.vrSession.end();
      this.vrSession = null;
      return;
    }
    try {
      const overlay = document.getElementById('vr-overlay');
      this.vrHud = document.getElementById('vr-hud');
      this.vrSession = await navigator.xr.requestSession('immersive-vr', { optionalFeatures: ['local-floor', 'dom-overlay'], domOverlay: { root: overlay } });
      if (overlay) overlay.style.display = 'block';
      this.renderer.xr.enabled = true;
      this.renderer.xr.setSession(this.vrSession);
      this.vrSession.addEventListener('end', () => {
        if (overlay) overlay.style.display = 'none';
        this.vrSession?.removeEventListener('select', this.onVrSelect);
        this.vrSession?.removeEventListener('squeeze', this.onVrSqueeze);
        this.vrSession = null;
      });
      this.vrSession.addEventListener('select', this.onVrSelect);
      this.vrSession.addEventListener('squeeze', this.onVrSqueeze);
    } catch (e) {
      console.error(e);
    }
  };

  private captureFrameAsync = () => {
    return new Promise<void>(async (resolve, reject) => {
      if (!this.equiManaged) return resolve();
      await this.equiManaged.preBlobAsync(this.equiManaged.cubeCamera, this.camera, this.scene);
      const { width, height, ctx } = this.equiManaged;
      const data = ctx.getImageData(0, 0, width, height).data;
      this.jpegWorker.onmessage = (e: MessageEvent) => {
        if (e.data.error) {
          reject(e.data.error);
          return;
        }
        const a = document.createElement('a');
        a.href = e.data.url;
        a.download = 'frame-' + Date.now() + '.jpg';
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        resolve();
      };
      this.jpegWorker.postMessage({
        width,
        height,
        pixels: data.buffer
      }, [data.buffer]);
    });
  };

  private captureFrameAsyncForCli = () => {
    return new Promise<ArrayBuffer | null>(async (resolve, reject) => {
      if (!this.equiManaged) return resolve(null);
      await this.equiManaged.preBlobAsync(this.equiManaged.cubeCamera, this.camera, this.scene);
      const { width, height, ctx } = this.equiManaged;
      const data = ctx.getImageData(0, 0, width, height).data;
      this.jpegWorker.onmessage = (e: MessageEvent) => {
        if (e.data.error) {
          reject(e.data.error);
          return;
        }
        if (e.data.buffer) {
          resolve(e.data.buffer);
        } else {
          resolve(null);
        }
      };
      this.jpegWorker.postMessage(
        {
          width,
          height,
          pixels: data.buffer,
          returnBuffer: true
        },
        [data.buffer]
      );
    });
  };

  private downloadLittlePlanet = async () => {
    if (!this.equiManaged) return;
    await this.equiManaged.preBlobAsync(this.equiManaged.cubeCamera, this.camera, this.scene);
    let planet: HTMLCanvasElement;
    if (this.equiManaged.toLittlePlanetGpu && this.equiManaged.renderer?.getContext?.()) {
      planet = this.equiManaged.toLittlePlanetGpu();
    } else {
      planet = this.equiManaged.toLittlePlanet();
    }
    planet.toBlob(b => {
      if (!b) return;
      const url = URL.createObjectURL(b);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'little-planet-' + Date.now() + '.jpg';
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }, 'image/jpeg');
  };

  private startTimedCapture = (ms: number) => {
    if (this.intervalId) return;
    this.intervalId = window.setInterval(() => this.captureFrameAsync(), ms);
  };

  private stopTimedCapture = () => {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  };

  private init() {
    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 1, 10000);
    this.placeObjectsAroundYou();
    this.renderer = new THREE.WebGLRenderer();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.equiManaged = new CubemapToEquirectangular(this.renderer, true, '4K');
    const container = document.getElementsByClassName('container')[0] as HTMLElement;
    this.canvas = container.appendChild(this.renderer.domElement);
    this.controls = new OrbitControls(this.camera, container);
    this.camera.position.z = 0.01;

    this.scene.add(new THREE.AmbientLight(0x404040));
    const light = new THREE.PointLight('white', 1, 50);
    light.position.set(0, 1, 0);
    this.scene.add(light);
  }

  private placeObjectsAroundYou() {
    const top = new THREE.Vector3(0, 38, 0);
    const bottom = new THREE.Vector3(0, -38, 0);
    const left = new THREE.Vector3(-50, 0, 0);
    const right = new THREE.Vector3(50, 0, 0);
    const front = new THREE.Vector3(0, 0, 50);
    const behind = new THREE.Vector3(0, 0, -50);

    const locations = [top, bottom, behind, front, left, right];

    for (let i = 0; i < locations.length; i++) {
      this.makeSingleObject(locations[i], i);
    }
  }

  private locationNames = ['top', 'bottom', 'front', 'behind', 'left', 'right'];

  private makeSingleObject(location: any, index: number) {
    const geometry = new THREE.SphereGeometry(25, 40, 40);

    const map = new THREE.TextureLoader().load(`textures/${this.locationNames[index]}.png`);

    map.wrapS = map.wrapT = THREE.RepeatWrapping;
    map.repeat.set(8, 8);
    map.anisotropy = 16;

    const material = new THREE.MeshLambertMaterial({
      map: map,
      side: THREE.DoubleSide
    });

    const mesh = new THREE.Mesh(geometry, material);

    mesh.position.add(location);
    this.meshes.push(mesh);
    this.scene.add(mesh);
    return mesh;
  }

  private animate = (delta?: number) => {
    requestAnimationFrame(this.animate);

    const now = performance.now();
    const dt = now - this.lastTime;
    this.lastTime = now;
    if (this.adaptive && this.equiManaged) {
      const target = 1000 / this.targetFps;
      this.avgDt = this.avgDt * 0.9 + dt * 0.1;
      const levels = ['1K','2K','4K','8K','12K','16K'];
      const cur = levels.indexOf(this.currentResolution);
      const min = Math.max(0, levels.indexOf(this.adaptiveMin));
      const max = Math.min(levels.length - 1, levels.indexOf(this.adaptiveMax));
      if (this.avgDt > target * 1.5 && cur > min) {
        this.currentResolution = levels[cur - 1];
        this.equiManaged.setResolution(this.currentResolution, true);
      } else if (this.avgDt < target * 0.8 && cur < max) {
        this.currentResolution = levels[cur + 1];
        this.equiManaged.setResolution(this.currentResolution, true);
      }
    }

    this.meshes.forEach(mesh => {
      mesh.rotation.y += 0.003;
    });

    this.controls.update(delta);

    this.renderer.render(this.scene, this.camera);
    if (this.stereo) {
      const out = this.equiManaged.updateStereo(this.camera, this.scene);
      this.capturer360.capture(out);
    } else {
      this.capturer360.capture(this.canvas as HTMLCanvasElement);
    }
    if (this.recording) {
      this.frameCount++;
      const elapsed = Math.floor((performance.now() - this.startTime) / 1000);
      this.sendRemoteStatus({ progress: this.frameCount, mode: this.captureMode, frame: this.frameCount, elapsed });
      this.updateVrHud();
      const text = document.getElementById('progress-text');
      const bar = document.getElementById('progress-bar') as HTMLProgressElement | null;
      if (text) text.textContent = `${this.frameCount}f ${elapsed}s`;
      if (bar) {
        bar.style.display = 'block';
        bar.removeAttribute('value');
      }
    } else {
      const text = document.getElementById('progress-text');
      const bar = document.getElementById('progress-bar') as HTMLProgressElement | null;
      if (text) text.textContent = '';
      if (bar) {
        bar.style.display = 'none';
        bar.value = 0;
      }
    }

    if (this.ffmpegEncoder) {
      this.equiManaged.preBlob(this.equiManaged.cubeCamera, this.camera, this.scene);
      this.equiManaged.canvas.toBlob(async blob => {
        if (!blob) return;
        const buffer = await blob.arrayBuffer();
        await this.ffmpegEncoder!.addFrame(new Uint8Array(buffer));
      }, 'image/jpeg');
    }

    if (this.hlsUrl) {
      this.equiManaged.preBlob(this.equiManaged.cubeCamera, this.camera, this.scene);
      this.equiManaged.canvas.toBlob(async blob => {
        if (!blob) return;
        fetch(this.hlsUrl + '/frame', { method: 'POST', body: blob });
      }, 'image/jpeg');
    }

    if (this.rtmpUrl) {
      this.equiManaged.preBlob(this.equiManaged.cubeCamera, this.camera, this.scene);
      this.equiManaged.canvas.toBlob(async blob => {
        if (!blob) return;
        fetch(this.rtmpUrl + '/frame', { method: 'POST', body: blob });
      }, 'image/jpeg');
    }
  };

  private onWindowResize = () => {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  };

  private checkCapabilities = () => {
    const sel = document.getElementById('capture-mode') as HTMLSelectElement | null;
    if (!sel) return;
    if (!(window as any).VideoEncoder) {
      const opt = sel.querySelector('option[value="webcodecs"]') as HTMLOptionElement;
      if (opt) opt.disabled = true;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      const opt = sel.querySelector('option[value="webm"]') as HTMLOptionElement;
      if (opt) opt.disabled = true;
    }
    if (!(navigator as any).gpu) {
      const opt = sel.querySelector('option[value="wasm"]') as HTMLOptionElement;
      if (opt) opt.disabled = true;
    }
  };

  public bindWindow() {
    window.addEventListener('resize', this.onWindowResize, false);
    window.addEventListener('load', this.checkCapabilities);
    (window as any).startCapture360 = this.startCapture360;
    (window as any).stopCapture360 = this.stopCapture360;
    (window as any).startWebMRecording = this.startWebMRecording;
    (window as any).stopWebMRecording = this.stopWebMRecording;
    (window as any).startWebCodecsRecording = this.startWebCodecsRecording;
    (window as any).stopWebCodecsRecording = this.stopWebCodecsRecording;
    (window as any).startRecording = this.startRecording;
    (window as any).stopRecording = this.stopRecording;
    (window as any).stopWasmRecording = this.stopWasmRecording;
    (window as any).toggleStereo = this.toggleStereo;
    (window as any).toggleAdaptive = this.toggleAdaptive;
    (window as any).startTimedCapture = () => {
      const input = document.getElementById('intervalMs') as HTMLInputElement | null;
      const ms = input ? parseInt(input.value, 10) : 0;
      if (ms > 0) this.startTimedCapture(ms);
    };
    (window as any).stopTimedCapture = this.stopTimedCapture;
    (window as any).downloadLittlePlanet = this.downloadLittlePlanet;
    (window as any).captureFrameAsync = this.captureFrameAsync;
    (window as any).captureFrameAsyncForCli = this.captureFrameAsyncForCli;
    (window as any).addFrameProcessor = (p: (frame: Uint8Array) => Uint8Array | Promise<Uint8Array>) => this.addFrameProcessor(p);
    (window as any).enterVR = this.enterVR;
    (window as any).stopWebMRecordingForCli = this.stopWebMRecordingForCli;
    (window as any).stopWebCodecsRecordingForCli = this.stopWebCodecsRecordingForCli;
    (window as any).startWasmRecording = this.startWasmRecording;
    (window as any).stopWasmRecordingForCli = this.stopWasmRecordingForCli;
    (window as any).startStreaming = this.startStreaming;
    (window as any).stopStreaming = this.stopStreaming;
    (window as any).startHLS = this.startHLS;
    (window as any).stopHLS = this.stopHLS;
    (window as any).startRTMP = this.startRTMP;
    (window as any).stopRTMP = this.stopRTMP;
    (window as any).createWebGLProcessor = createWebGLProcessor;
    (window as any).setAdaptiveRange = (min: string, max: string) => this.setAdaptiveRange(min, max);
  }
}

export const j360App = new J360App();
j360App.bindWindow();
