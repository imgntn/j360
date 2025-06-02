'use strict';
import { WebMRecorder } from './WebMRecorder';
import { CubemapToEquirectangular } from './CubemapToEquirectangular';
import { FfmpegEncoder } from './FfmpegEncoder';

export class J360App {
  private jpegWorker = new Worker(new URL('./convertWorker.ts', import.meta.url), { type: 'module' });
  private capturer360 = new CCapture({ format: 'threesixty', display: true, autoSaveTime: 3 });
  private webmRecorder: WebMRecorder | null = null;
  private ffmpegEncoder: FfmpegEncoder | null = null;
  private scene: any;
  private camera: any;
  private renderer: any;
  private canvas: HTMLCanvasElement | null = null;
  private controls: any;
  private equiManaged: any;
  private meshes: any[] = [];
  private stereo = false;
  private vrSession: XRSession | null = null;

  constructor() {
    this.init();
    this.animate();
  }

  private startCapture360 = () => {
    const resSel = document.getElementById('resolution') as HTMLSelectElement | null;
    if (resSel && this.equiManaged) {
      this.equiManaged.setResolution(resSel.value, true);
    }
    this.capturer360.start();
  };

  private stopCapture360 = () => {
    this.capturer360.stop();
  };

  private startWebMRecording = (fps = 60, includeAudio = true) => {
    if (!this.webmRecorder) {
      const src = this.stereo ? this.equiManaged.getStereoCanvas() : (this.canvas as HTMLCanvasElement);
      this.webmRecorder = new WebMRecorder(src as HTMLCanvasElement, fps, includeAudio);
    }
    this.webmRecorder.start();
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
  };

  private stopWebMRecordingForCli = async () => {
    if (!this.webmRecorder) return null;
    const blob = await this.webmRecorder.stop();
    const buffer = await blob.arrayBuffer();
    this.webmRecorder = null;
    return buffer;
  };

  private startWasmRecording = async (fps = 60) => {
    if (!this.ffmpegEncoder) {
      this.ffmpegEncoder = new FfmpegEncoder(fps, 'mp4');
      await this.ffmpegEncoder.init();
    }
  };

  private stopWasmRecordingForCli = async () => {
    if (!this.ffmpegEncoder) return null;
    const data = await this.ffmpegEncoder.encode();
    this.ffmpegEncoder = null;
    return data.buffer;
  };

  private toggleStereo = () => {
    this.stereo = !this.stereo;
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
      this.vrSession = await navigator.xr.requestSession('immersive-vr', { optionalFeatures: ['local-floor', 'dom-overlay'], domOverlay: { root: overlay } });
      if (overlay) overlay.style.display = 'block';
      this.renderer.xr.enabled = true;
      this.renderer.xr.setSession(this.vrSession);
      this.vrSession.addEventListener('end', () => {
        if (overlay) overlay.style.display = 'none';
        this.vrSession = null;
      });
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

  private init() {
    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 1, 10000);
    this.placeObjectsAroundYou();
    this.renderer = new THREE.WebGLRenderer();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.equiManaged = new CubemapToEquirectangular(this.renderer, true, '4K');
    const container = document.getElementsByClassName('container')[0] as HTMLElement;
    this.canvas = container.appendChild(this.renderer.domElement);
    this.controls = new THREE.OrbitControls(this.camera, container);
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

    if (this.ffmpegEncoder) {
      this.equiManaged.preBlob(this.equiManaged.cubeCamera, this.camera, this.scene);
      this.equiManaged.canvas.toBlob(async blob => {
        if (!blob) return;
        const buffer = await blob.arrayBuffer();
        this.ffmpegEncoder!.addFrame(new Uint8Array(buffer));
      }, 'image/jpeg');
    }
  };

  private onWindowResize = () => {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  };

  public bindWindow() {
    window.addEventListener('resize', this.onWindowResize, false);
    (window as any).startCapture360 = this.startCapture360;
    (window as any).stopCapture360 = this.stopCapture360;
    (window as any).startWebMRecording = this.startWebMRecording;
    (window as any).stopWebMRecording = this.stopWebMRecording;
    (window as any).toggleStereo = this.toggleStereo;
    (window as any).captureFrameAsync = this.captureFrameAsync;
    (window as any).enterVR = this.enterVR;
    (window as any).stopWebMRecordingForCli = this.stopWebMRecordingForCli;
    (window as any).startWasmRecording = this.startWasmRecording;
    (window as any).stopWasmRecordingForCli = this.stopWasmRecordingForCli;
  }
}

export const j360App = new J360App();
j360App.bindWindow();
