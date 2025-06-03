export type FrameProcessor = (frame: Uint8Array) => Uint8Array | Promise<Uint8Array>;
export declare class FfmpegEncoder {
    private ffmpeg;
    private frames;
    private chunks;
    private chunkSize;
    private audioRec;
    private audioChunks;
    private audioData;
    constructor(fps?: number, format?: 'mp4' | 'webm', incremental?: boolean, includeAudio?: boolean, extAudioData?: Uint8Array | null, streamEncode?: boolean, codec?: 'h264' | 'vp9' | 'av1', processors?: FrameProcessor[]);
    init(): Promise<void>;
    addProcessor(p: FrameProcessor): void;
    addFrame(data: Uint8Array): Promise<void>;
    encode(onProgress?: (p: number) => void): Promise<Uint8Array>;
}
