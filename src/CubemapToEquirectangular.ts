import * as THREE from "three";
export class CubemapToEquirectangular {
  width = 1;
  height = 1;
  renderer: any;
  material: any;
  scene: any;
  quad: any;
  camera: any;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D | null;
  cubeCamera: any = null;
  cubeCameraR: any = null;
  attachedCamera: any = null;
  stereoCanvas: HTMLCanvasElement | null = null;
  worker: Worker;
  useWebGPU: boolean;
  cubeMapSize: number;
  maxTextureSize: number;
  private device: GPUDevice | null = null;
  private pipeline: GPUComputePipeline | null = null;
  private sampler: GPUSampler | null = null;
  private cubeTex: GPUTexture | null = null;
  private outputTex: GPUTexture | null = null;
  private queue: GPUQueue | null = null;

  selectBestResolution(preferred: string) {
    const gl = this.renderer.getContext();
    const cubeSize = gl.getParameter(gl.MAX_CUBE_MAP_TEXTURE_SIZE);
    const texSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);
    const prefs = preferred ? [preferred.toUpperCase(), '16K', '12K', '8K', '4K', '2K', '1K'] : ['16K', '12K', '8K', '4K', '2K', '1K'];
    for (const res of prefs) {
      if ((res === '16K' || res === '12K') && (navigator as any).gpu) return res;
      if (res === '8K' && cubeSize >= 4096 && texSize >= 8192) return '8K';
      if (res === '4K' && cubeSize >= 2048 && texSize >= 4096) return '4K';
      if (res === '2K' && cubeSize >= 1024 && texSize >= 2048) return '2K';
      if (res === '1K') return '1K';
    }
    return '1K';
  }

  vertexShader = `
attribute vec3 position;
attribute vec2 uv;

uniform mat4 projectionMatrix;
uniform mat4 modelViewMatrix;

varying vec2 vUv;

void main()  {

        vUv = vec2( 1.- uv.x, uv.y );
        gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

}`;

  fragmentShader = `
precision mediump float;

uniform samplerCube map;

varying vec2 vUv;

#define M_PI 3.1415926535897932384626433832795

void main()  {

        vec2 uv = vUv;

        float longitude = uv.x * 2. * M_PI - M_PI + M_PI / 2.;
        float latitude = uv.y * M_PI;

        vec3 dir = vec3(
                - sin( longitude ) * sin( latitude ),
                cos( latitude ),
                - cos( longitude ) * sin( latitude )
        );
        normalize( dir );

        gl_FragColor = vec4( textureCube( map, dir ).rgb, 1. );

}`;

  constructor(renderer: any, provideCubeCamera = true, resolution = '4K') {
    this.renderer = renderer;
    resolution = this.selectBestResolution(resolution);
    this.useWebGPU = (resolution === '16K' || resolution === '12K') && !!(navigator as any).gpu;

    this.worker = new Worker(new URL('./equirectWorker.ts', import.meta.url), { type: 'module' });

    this.material = new THREE.RawShaderMaterial({
      uniforms: {
        map: { type: 't', value: null }
      },
      vertexShader: this.vertexShader,
      fragmentShader: this.fragmentShader,
      side: THREE.DoubleSide
    });

    this.scene = new THREE.Scene();
    this.quad = new THREE.Mesh(
      new THREE.PlaneBufferGeometry(1, 1),
      this.material
    );
    this.scene.add(this.quad);
    this.camera = new THREE.OrthographicCamera(1 / -2, 1 / 2, 1 / 2, 1 / -2, -10000, 10000);

    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d');

    if (resolution === '16K') {
      this.setSize(16384, 8192);
    } else if (resolution === '12K') {
      this.setSize(12288, 6144);
    } else if (resolution === '8K') {
      this.setSize(8192, 4096);
    } else if (resolution === '4K') {
      this.setSize(4096, 2048);
    } else if (resolution === '2K') {
      this.setSize(2048, 1024);
    } else {
      this.setSize(1024, 512);
      resolution = '1K';
    }

    const gl = this.renderer.getContext();
    this.cubeMapSize = gl.getParameter(gl.MAX_CUBE_MAP_TEXTURE_SIZE);
    this.maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);

    if (provideCubeCamera) {
      if (resolution === '16K') {
        this.getCubeCamera(8192);
      } else if (resolution === '12K') {
        this.getCubeCamera(6144);
      } else if (resolution === '8K') {
        this.getCubeCamera(4096);
      } else if (resolution === '4K') {
        this.getCubeCamera(2048);
      } else if (resolution === '2K') {
        this.getCubeCamera(1024);
      } else {
        this.getCubeCamera(512);
      }
    }
  }

  setSize(width: number, height: number) {
    this.width = width;
    this.height = height;

    this.quad.scale.set(this.width, this.height, 1);

    this.camera.left = this.width / -2;
    this.camera.right = this.width / 2;
    this.camera.top = this.height / 2;
    this.camera.bottom = this.height / -2;

    this.camera.updateProjectionMatrix();

    this.output = new THREE.WebGLRenderTarget(this.width, this.height, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      wrapS: THREE.ClampToEdgeWrapping,
      wrapT: THREE.ClampToEdgeWrapping,
      format: THREE.RGBA,
      type: THREE.UnsignedByteType
    });

    this.canvas.width = this.width;
    this.canvas.height = this.height;
  }

  output: any;

  getCubeCamera(size: number = this.width / 2) {
    this.cubeCamera = new THREE.CubeCamera(0.1, 10000, new THREE.WebGLCubeRenderTarget(Math.min(this.cubeMapSize, size)));
    return this.cubeCamera;
  }

  private async initWebGPU() {
    if (this.device) return;
    const adapter = await (navigator as any).gpu.requestAdapter();
    if (!adapter) throw new Error('WebGPU adapter not found');
    this.device = await adapter.requestDevice();
    this.queue = this.device.queue;
    const shader = await fetch(new URL('./equirect-webgpu.wgsl', import.meta.url)).then(r => r.text());
    const module = this.device.createShaderModule({ code: shader });
    this.pipeline = this.device.createComputePipeline({ layout: 'auto', compute: { module, entryPoint: 'main' } });
    this.sampler = this.device.createSampler({ magFilter: 'linear', minFilter: 'linear' });
  }

  getCubeCameraR(size: number = this.width / 2) {
    this.cubeCameraR = new THREE.CubeCamera(0.1, 10000, new THREE.WebGLCubeRenderTarget(Math.min(this.cubeMapSize, size)));
    return this.cubeCameraR;
  }

  setResolution(resolution: string, updateCamera?: boolean) {
    resolution = this.selectBestResolution(resolution || '4K');

    let cubeSize: number;
    if (resolution === '16K') {
      this.setSize(16384, 8192);
      cubeSize = 8192;
    } else if (resolution === '12K') {
      this.setSize(12288, 6144);
      cubeSize = 6144;
    } else if (resolution === '8K') {
      this.setSize(8192, 4096);
      cubeSize = 4096;
    } else if (resolution === '4K') {
      this.setSize(4096, 2048);
      cubeSize = 2048;
    } else if (resolution === '2K') {
      this.setSize(2048, 1024);
      cubeSize = 1024;
    } else {
      this.setSize(1024, 512);
      cubeSize = 512;
    }

    if (updateCamera) {
      this.getCubeCamera(cubeSize);
      this.getCubeCameraR(cubeSize);
    }
  }

  attachCubeCamera(camera: any) {
    this.getCubeCamera();
    this.attachedCamera = camera;
  }

  private async convertWebGPU(cubeCamera: any) {
    await this.initWebGPU();
    const device = this.device as GPUDevice;
    const queue = this.queue as GPUQueue;
    const size = cubeCamera.renderTarget.width;
    if (!this.cubeTex || this.cubeTex.width !== size) {
      this.cubeTex = device.createTexture({
        size: [size, size, 6],
        format: 'rgba8unorm',
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST
      });
    }
    if (!this.outputTex || this.outputTex.width !== this.width) {
      this.outputTex = device.createTexture({
        size: [this.width, this.height],
        format: 'rgba8unorm',
        usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.COPY_SRC
      });
    }
    for (let i = 0; i < 6; i++) {
      const pixels = new Uint8Array(4 * size * size);
      this.renderer.readRenderTargetPixels(cubeCamera.renderTarget, 0, 0, size, size, pixels, i);
      const bitmap = await createImageBitmap(new ImageData(new Uint8ClampedArray(pixels), size, size));
      queue.copyExternalImageToTexture({ source: bitmap }, { texture: this.cubeTex, origin: [0, 0, i] }, [size, size]);
    }
    const bind = device.createBindGroup({
      layout: this.pipeline!.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: this.sampler! },
        { binding: 1, resource: this.cubeTex.createView({ dimension: 'cube' }) },
        { binding: 2, resource: this.outputTex.createView() }
      ]
    });
    const encoder = device.createCommandEncoder();
    const pass = encoder.beginComputePass();
    pass.setPipeline(this.pipeline!);
    pass.setBindGroup(0, bind);
    pass.dispatchWorkgroups(Math.ceil(this.width / 8), Math.ceil(this.height / 8));
    pass.end();
    const readBuf = device.createBuffer({
      size: this.width * this.height * 4,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
    });
    encoder.copyTextureToBuffer({ texture: this.outputTex }, { buffer: readBuf, bytesPerRow: this.width * 4 }, [this.width, this.height]);
    queue.submit([encoder.finish()]);
    await readBuf.mapAsync(GPUMapMode.READ);
    const pixels = new Uint8Array(readBuf.getMappedRange());
    const data = new Uint8ClampedArray(pixels.slice());
    readBuf.unmap();
    const imageData = new ImageData(data, this.width, this.height);
    this.ctx?.putImageData(imageData, 0, 0);
  }

  async convert(cubeCamera: any) {
    if (this.useWebGPU) {
      return this.convertWebGPU(cubeCamera);
    }
    this.quad.material.uniforms.map.value = cubeCamera.renderTarget.texture;
    this.renderer.render(this.scene, this.camera, this.output, true);

    const pixels = new Uint8Array(4 * this.width * this.height);
    this.renderer.readRenderTargetPixels(this.output, 0, 0, this.width, this.height, pixels);

    const imageData = new ImageData(new Uint8ClampedArray(pixels), this.width, this.height);

    this.ctx?.putImageData(imageData, 0, 0);

    this.canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);

      const fileName = 'pano-' + document.title + '-' + Date.now() + '.jpg';
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.setAttribute('download', fileName);
      anchor.className = 'download-js-link';
      anchor.innerHTML = 'downloading...';
      anchor.style.display = 'none';
      document.body.appendChild(anchor);
      setTimeout(() => {
        anchor.click();
        document.body.removeChild(anchor);
      }, 1);

    }, 'image/jpeg');
  }

  convertStereo(leftCamera: any, rightCamera: any) {
    this.quad.material.uniforms.map.value = leftCamera.renderTarget.texture;
    this.renderer.render(this.scene, this.camera, this.output, true);
    const leftPixels = new Uint8Array(4 * this.width * this.height);
    this.renderer.readRenderTargetPixels(this.output, 0, 0, this.width, this.height, leftPixels);
    const leftData = new ImageData(new Uint8ClampedArray(leftPixels), this.width, this.height);

    this.quad.material.uniforms.map.value = rightCamera.renderTarget.texture;
    this.renderer.render(this.scene, this.camera, this.output, true);
    const rightPixels = new Uint8Array(4 * this.width * this.height);
    this.renderer.readRenderTargetPixels(this.output, 0, 0, this.width, this.height, rightPixels);
    const rightData = new ImageData(new Uint8ClampedArray(rightPixels), this.width, this.height);

    if (!this.stereoCanvas) {
      this.stereoCanvas = document.createElement('canvas');
    }
    this.stereoCanvas.width = this.width * 2;
    this.stereoCanvas.height = this.height;
    const sctx = this.stereoCanvas.getContext('2d');
    if (sctx) {
      sctx.putImageData(leftData, 0, 0);
      sctx.putImageData(rightData, this.width, 0);
    }
    return this.stereoCanvas;
  }

  getStereoCanvas() {
    if (!this.stereoCanvas) {
      this.stereoCanvas = document.createElement('canvas');
      this.stereoCanvas.width = this.width * 2;
      this.stereoCanvas.height = this.height;
    }
    return this.stereoCanvas;
  }

  private convertOffThread(faces: ImageBitmap[]): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      const handler = (e: MessageEvent) => {
        this.worker.removeEventListener('message', handler);
        resolve(e.data.buffer);
      };
      this.worker.addEventListener('message', handler, { once: true });
      this.worker.addEventListener('error', err => {
        reject(err);
      }, { once: true });
      this.worker.postMessage({ faces, width: this.width, height: this.height }, faces);
    });
  }

  async preBlobAsync(cubeCamera: any, camera: any, scene: any) {
    const autoClear = this.renderer.autoClear;
    this.renderer.autoClear = true;
    this.cubeCamera.position.copy(camera.position);
    this.cubeCamera.update(this.renderer, scene);
    this.renderer.autoClear = autoClear;

    const size = cubeCamera.renderTarget.width;
    const faces: ImageBitmap[] = [];
    for (let i = 0; i < 6; i++) {
      const pixels = new Uint8Array(4 * size * size);
      this.renderer.readRenderTargetPixels(cubeCamera.renderTarget, 0, 0, size, size, pixels, i);
      const bitmap = await createImageBitmap(new ImageData(new Uint8ClampedArray(pixels), size, size));
      faces.push(bitmap);
    }
    const buffer = await this.convertOffThread(faces);
    const imageData = new ImageData(new Uint8ClampedArray(buffer), this.width, this.height);
    this.ctx?.putImageData(imageData, 0, 0);
  }

  preBlob(cubeCamera: any, camera: any, scene: any) {
    const autoClear = this.renderer.autoClear;
    this.renderer.autoClear = true;
    this.cubeCamera.position.copy(camera.position);
    this.cubeCamera.update(this.renderer, scene);
    this.renderer.autoClear = autoClear;

    this.quad.material.uniforms.map.value = cubeCamera.renderTarget.texture;
    this.renderer.render(this.scene, this.camera, this.output, true);

    const pixels = new Uint8Array(4 * this.width * this.height);
    this.renderer.readRenderTargetPixels(this.output, 0, 0, this.width, this.height, pixels);

    const imageData = new ImageData(new Uint8ClampedArray(pixels), this.width, this.height);

    this.ctx?.putImageData(imageData, 0, 0);
  }

  async update(camera: any, scene: any) {
    const autoClear = this.renderer.autoClear;
    this.renderer.autoClear = true;
    this.cubeCamera.position.copy(camera.position);
    this.cubeCamera.update(this.renderer, scene);
    this.renderer.autoClear = autoClear;

    await this.convert(this.cubeCamera);
  }

  updateStereo(camera: any, scene: any, eyeOffset = 0.032) {
    if (!this.cubeCamera) this.getCubeCamera(this.width / 2);
    if (!this.cubeCameraR) this.getCubeCameraR(this.width / 2);

    const autoClear = this.renderer.autoClear;
    this.renderer.autoClear = true;

    this.cubeCamera.position.copy(camera.position).add(new THREE.Vector3(-eyeOffset, 0, 0));
    this.cubeCamera.update(this.renderer, scene);

    this.cubeCameraR.position.copy(camera.position).add(new THREE.Vector3(eyeOffset, 0, 0));
    this.cubeCameraR.update(this.renderer, scene);
    this.renderer.autoClear = autoClear;

    return this.convertStereo(this.cubeCamera, this.cubeCameraR);
  }

  toLittlePlanet() {
    const size = Math.min(this.width, this.height);
    const out = document.createElement('canvas');
    out.width = size;
    out.height = size;
    const ctx = out.getContext('2d');
    if (!ctx || !this.ctx) return out;
    const src = this.ctx.getImageData(0, 0, this.width, this.height).data;
    const dst = ctx.createImageData(size, size);
    const cx = size / 2;
    const cy = size / 2;
    const radius = size / 2;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const dx = x - cx;
        const dy = y - cy;
        const r = Math.sqrt(dx * dx + dy * dy);
        if (r > radius) continue;
        const theta = Math.atan2(dy, dx);
        const phi = 2 * Math.atan(r / radius);
        let u = (theta + Math.PI) / (2 * Math.PI);
        let v = phi / Math.PI;
        const sx = Math.min(this.width - 1, Math.max(0, Math.floor(u * this.width)));
        const sy = Math.min(this.height - 1, Math.max(0, Math.floor(v * this.height)));
        const si = (sy * this.width + sx) * 4;
        const di = (y * size + x) * 4;
        dst.data[di] = src[si];
        dst.data[di + 1] = src[si + 1];
        dst.data[di + 2] = src[si + 2];
        dst.data[di + 3] = 255;
      }
    }
    ctx.putImageData(dst, 0, 0);
    return out;
  }
}
