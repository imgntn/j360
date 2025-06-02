export declare class FfmpegEncoder {
    private ffmpeg;
    private frames;
    private chunks;
    private chunkSize;
    private audioRec;
    private audioChunks;
    private audioData;
    constructor(fps?: number, format?: 'mp4' | 'webm', incremental?: boolean, includeAudio?: boolean, extAudioData?: Uint8Array | null);
    init(): Promise<void>;
    addFrame(data: Uint8Array): void;
    encode(onProgress?: (p: number) => void): Promise<Uint8Array>;
}
