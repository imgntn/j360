export declare class FfmpegEncoder {
    private ffmpeg;
    private frames;
    private chunks;
    private chunkSize;
    constructor(fps?: number, format?: 'mp4' | 'webm', incremental?: boolean);
    init(): Promise<void>;
    addFrame(data: Uint8Array): void;
    encode(): Promise<Uint8Array>;
}
