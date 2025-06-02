export declare class WebMRecorder {
    private canvas;
    private recorder;
    private chunks;
    constructor(canvas: HTMLCanvasElement, fps?: number, includeAudio?: boolean);
    start(): void;
    stop(): Promise<Blob>;
}
