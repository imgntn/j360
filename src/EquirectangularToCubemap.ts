export class EquirectangularToCubemap {
  private device: GPUDevice | null = null;
  private queue: GPUQueue | null = null;
  private pipeline: GPUComputePipeline | null = null;
  private sampler: GPUSampler | null = null;
  private srcTex: GPUTexture | null = null;
  private cubeTex: GPUTexture | null = null;

  private async init() {
    if (this.device) return;
    const adapter = await (navigator as any).gpu.requestAdapter();
    if (!adapter) throw new Error('WebGPU adapter not found');
    this.device = await adapter.requestDevice();
    this.queue = this.device.queue;
    const code = await fetch(new URL('./cubemap-webgpu.wgsl', import.meta.url)).then(r => r.text());
    const module = this.device.createShaderModule({ code });
    this.pipeline = this.device.createComputePipeline({ layout: 'auto', compute: { module, entryPoint: 'main' } });
    this.sampler = this.device.createSampler({ magFilter: 'linear', minFilter: 'linear' });
  }

  async convert(image: ImageBitmap, size: number): Promise<ImageBitmap[]> {
    await this.init();
    const device = this.device as GPUDevice;
    const queue = this.queue as GPUQueue;
    if (!this.srcTex || this.srcTex.width !== image.width) {
      this.srcTex = device.createTexture({
        size: [image.width, image.height],
        format: 'rgba8unorm',
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST
      });
    }
    if (!this.cubeTex || this.cubeTex.width !== size) {
      this.cubeTex = device.createTexture({
        size: [size, size, 6],
        format: 'rgba8unorm',
        usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.COPY_SRC
      });
    }
    queue.copyExternalImageToTexture({ source: image }, { texture: this.srcTex }, [image.width, image.height]);
    const bind = device.createBindGroup({
      layout: this.pipeline!.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: this.sampler! },
        { binding: 1, resource: this.srcTex.createView() },
        { binding: 2, resource: this.cubeTex.createView({ dimension: '2d-array' }) }
      ]
    });
    const encoder = device.createCommandEncoder();
    const pass = encoder.beginComputePass();
    pass.setPipeline(this.pipeline!);
    pass.setBindGroup(0, bind);
    pass.dispatchWorkgroups(Math.ceil(size / 8), Math.ceil(size / 8), 6);
    pass.end();
    const buffers: GPUBuffer[] = [];
    for (let i = 0; i < 6; i++) {
      const buf = device.createBuffer({
        size: size * size * 4,
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
      });
      encoder.copyTextureToBuffer({ texture: this.cubeTex, origin: [0, 0, i] }, { buffer: buf, bytesPerRow: size * 4 }, [size, size, 1]);
      buffers.push(buf);
    }
    queue.submit([encoder.finish()]);
    const faces: ImageBitmap[] = [];
    for (const buf of buffers) {
      await buf.mapAsync(GPUMapMode.READ);
      const data = new Uint8Array(buf.getMappedRange());
      const img = new ImageData(new Uint8ClampedArray(data.slice()), size, size);
      faces.push(await createImageBitmap(img));
      buf.unmap();
    }
    return faces;
  }
}
