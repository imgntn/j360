export declare class EquirectangularToCubemap {
  private device;
  private queue;
  private pipeline;
  private sampler;
  private srcTex;
  private cubeTex;
  private init(): Promise<void>;
  convert(image: ImageBitmap, size: number): Promise<ImageBitmap[]>;
}
