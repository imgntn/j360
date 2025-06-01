export declare class WebMRecorder {
    private canvas;
    private recorder;
    private chunks;
    constructor(canvas: HTMLCanvasElement, fps?: number);
    start(): void;
    stop(): Promise<Blob>;
}
