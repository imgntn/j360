export declare class FfmpegEncoder {
    private ffmpeg;
    private frames;
    constructor(fps?: number, format?: 'mp4' | 'webm');
    init(): Promise<void>;
    addFrame(data: Uint8Array): void;
    encode(): Promise<Uint8Array>;
}
