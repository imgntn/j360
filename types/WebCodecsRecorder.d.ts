export declare class WebCodecsRecorder {
    private canvas;
    private fps;
    private includeAudio;
    private bitrate;
    private encoder;
    private frames;
    private audioRec;
    private audioChunks;
    private frameCount;
    constructor(canvas: HTMLCanvasElement, fps?: number, includeAudio?: boolean, bitrate?: number);
    init(): Promise<void>;
    start(): void;
    addFrame(): void;
    private buildIvf;
    stop(): Promise<Blob>;
}
