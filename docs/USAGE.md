# J360 Documentation

## Overview

J360 is a toolkit for capturing high resolution 360° images and video from Three.js scenes. It can export to JPG archives or directly to WebM/MP4 using WebCodecs or ffmpeg.wasm. Features include stereo capture, VR preview, adaptive resolution, and live streaming via WebRTC or HLS.

## Features

- Capture 360° frames in up to 16K resolution when WebGPU is available.
- Export JPG sequences with CCapture.js or record WebM directly.
- Optional encoding with ffmpeg.wasm for MP4 output.
- Stereo mode for VR playback.
- Headless rendering with Puppeteer and a command line interface.
- WebRTC streaming preview and remote control server.
- HLS and RTMP helpers for live video workflows.
- Frame processor plugins for custom effects.

## Getting Started

Clone the repository and install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

Visit `http://localhost:5173` to open the demo scene. Choose a capture mode from the "Capture" selector and click **Start Recording**. A progress label and bar show captured frames and elapsed time. Unsupported options are disabled automatically based on browser capabilities.

## Building and Serving

To create a production build:

```bash
npm run build
```

Preview the build locally:

```bash
npm run serve
```

## Command Line Usage

The CLI allows automated capture without a browser UI.

```bash
node tools/j360-cli.js [options] [output] [html]
```

Key options:

- `--frames <n>` – number of frames to capture.
- `--resolution <1K|2K|4K|8K>` – output size.
- `--stereo` – enable stereo 360° capture.
- `--webm` – record directly to WebM.
- `--wasm` – encode in the browser with ffmpeg.wasm.
- `--fps <n>` – frame rate.
- `--audio` – record from the microphone.
- `--audio-file <file>` – mix an existing audio track.
- `--stream` – send a WebRTC preview to `viewer.html`.
- `--hls` – stream frames to an HLS server.
- `--rtmp <url>` – push frames to an RTMP endpoint.
- `--screenshot` – save a single JPEG and exit.
- `--adaptive` – enable automatic resolution switching.
- `--min-res <1K|2K|4K|8K|12K|16K>` – lower bound for adaptive mode.
- `--max-res <1K|2K|4K|8K|12K|16K>` – upper bound for adaptive mode.

See `plugins/invert-plugin.js` for a GPU shader example usable with `--plugin`.

See `tools/j360-cli.ts` for all supported flags.

## Live Streaming and Remote Control

Run the signaling server for WebRTC preview:

```bash
npm run signaling
```

Open `viewer.html` to watch the stream. Use `remote-control.html` to start or stop recording remotely. A lightweight WebSocket server relays status updates to connected clients.

For HLS workflows execute:

```bash
node tools/hls-server.js --fps 60
```

Frames stream to `http://localhost:8000/hls/out.m3u8` and can be monitored with `hls-viewer.html`.

## FAQ

### The browser says WebCodecs is not supported

Not all browsers expose the WebCodecs API. Use the default CCapture.js mode or the ffmpeg.wasm `--wasm` flag in those cases.

### How do I capture still images?

Use `captureFrameAsync()` from the browser console or `--screenshot` with the CLI to save a single equirectangular JPEG.

### Encoding fails with "ffmpeg not found"

Install `ffmpeg` on your system or ensure `ffmpeg-static` is available. The CLI checks for the binary and reports an error if missing.

### Can I add filters to the frames?

Yes. Register a processor with `addFrameProcessor(fn)` or pass `--plugin my-filter.js` to the CLI. See `src/processors.ts` for a grayscale example or `plugins/invert-plugin.js` for a WebGL shader filter.

## Running Tests

Execute the unit tests with:

```bash
npm test
```

This validates CLI argument parsing and the ffmpeg encoder stub.

## Additional Resources

The original blog post describing the approach can be found at [Medium](https://medium.com/p/788226f2c75f). For questions or custom 360° projects, reach out via [LinkedIn](https://www.linkedin.com/in/jamespollack).
