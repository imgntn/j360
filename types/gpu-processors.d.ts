export declare function createWebGLProcessor(src: string): (frame: Uint8Array) => Promise<Uint8Array>;
export declare const invertFilter: (frame: Uint8Array) => Promise<Uint8Array>;
export declare const grayscaleFilter: (frame: Uint8Array) => Promise<Uint8Array>;
export declare function tintFilter(color: [number, number, number]): (frame: Uint8Array) => Promise<Uint8Array>;
