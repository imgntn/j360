This project shows how to export 4K resolution 360 Videos and Photos from inside of Three.js scenes.

The process is described in this blog post: https://medium.com/p/788226f2c75f

# Examples

[example 4k video from demo scene on YouTube ](https://www.youtube.com/watch?v=nsJS0_vms5c)

![Alt text](screencap2.jpg?raw=true "Inside of a 3D environment")

[example 4k test video on YouTube ](https://www.youtube.com/watch?v=GcY7f8EYEQg)

![Alt text](screencap.jpg?raw=true "Early Tests")

# How this works
Basically you take a cube camera, save it to equirectangular photo, and then stitch those together to make a video.  Add some metadata and voila! You can then post them to Facebook and Youtube.

I made some modifications to the [CCapture.js library](https://github.com/spite/ccapture.js/), where I added a CC360Encoder class that calls into an cubemap to equirectangular image capture library [from the same author](https://github.com/spite/THREE.CubemapToEquirectangular). I made modifications to that library also, where I prepare the cube camera data for the encoder with the preBlob class.  Finally, I was running into memory issues very quickly, so I re-implemented the broken batching in CCapture.js for .jpg sequences.

The app will capture a batch every N seconds, according to the autoSaveTime parameter.  Save and unarchive these .tar files, then use FFMPEG to stitch the images together.  See the post on Medium for more about metadata.

# Try Online

[demo scene](https://imgntn.github.io/j360/demo.html)

[simple tests](https://imgntn.github.io/j360/index.html)


# Example files

Clone the repository and serve its files using a webserver of your choice.


[index.html](index.html) contains simple test shapes.  moving the camera during capture has no effect.

[demo.html](demo.html) is hacked into a three.js demo scene.  moving the camera during capture will change the final shot.


# Use it yourself

Include the modified CCapture.js and CubeMapToEquirectangular.js libraries.  You'll need tar.js and download.js as well.  Which controls to include are up to you.

Instantiate a capturer.  Batches will download automatically every N seconds according to the autoSaveTime property.

```
// Create a capturer that exports Equirectangular 360 JPG images in a TAR file
var capturer360 = new CCapture({
    format: 'threesixty',
    display: true,
    autoSaveTime: 3,
});
```

Add a managed CubemapToEquirectangular camera when you setup your scene.

Here we use “4K” but you can also use “2K” or “1K” as resolutions. The examples
now expose dropdowns so you can change the resolution and `autoSaveTime` at
runtime.

```equiManaged = new CubemapToEquirectangular(renderer, true, "4K");```

The library will automatically fall back to the best resolution supported by
your GPU. For example, if 8K is requested but not supported it will choose 4K
or lower based on `MAX_CUBE_MAP_TEXTURE_SIZE` and `MAX_TEXTURE_SIZE`.


Call the capture method at the end render loop, and give it your canvas.

```capturer360.capture(canvas); ```

These functions will start and stop the recording.

```
function startCapture360(event) {
    capturer360.start();
}

function stopCapture360(event) {
    capturer360.stop();
}
```

## Direct WebM Capture

Call `startWebMRecording()` and `stopWebMRecording()` to record the canvas
to a WebM file using WebCodecs. When stopped a WebM file will download
automatically eliminating the external `ffmpeg` step.

### WebCodecs Recorder

Call `startWebCodecsRecording()` and `stopWebCodecsRecording()` for a lower
latency capture path based on the WebCodecs API. When supported this records
directly to VP9 with optional microphone audio. Browsers without WebCodecs
fall back to the MediaRecorder based `WebMRecorder` automatically.

Use `captureFrameAsync()` to grab a single JPEG without blocking the main
thread. The encoding work happens in a Web Worker so interactive scenes stay
smooth even at high resolutions.

When WebGPU is available the library can output equirectangular frames at
**16K** and **12K** resolutions. The converter automatically selects WebGPU when
these ultra high resolutions are requested and now uses a compute shader for
fast cubemap projection.

## Headless Rendering

Run `npm run headless` to launch a Puppeteer instance that captures a scene
and invokes `tools/create-video.js` to build a video without any browser
interaction.

### Command Line Interface

`node tools/j360-cli.js [options] [output] [html]`

The CLI now accepts options for resolution, stereo mode, frame count, and
direct WebM output. Additional flags include `--fps <n>` to control frame rate,
`--audio` to record from the microphone or `--audio-file <file>` to mix an existing
track. Use `--wasm` to encode video in the browser with ffmpeg.wasm. Use `--stream` with `--signal-url` to broadcast a
WebRTC preview while capturing. Argument parsing uses Node's built in
`parseArgs` library. When available, the CLI automatically uses `ffmpeg-static`
and `tar-stream` instead of shelling out to external commands. A simple progress
indicator shows capture status and, when using `--wasm`, encoding progress as
well. Example:

Use `--screenshot` to save a single equirectangular JPEG and exit immediately.

Use `--incremental` with `--wasm` to encode video in small chunks to reduce
memory usage. For live previews an HLS server can be launched automatically with
`--hls`, and frames will stream to `http://localhost:8000/hls/out.m3u8` during
capture.
Use `--rtmp <url>` to push frames to an RTMP endpoint via a helper server at `http://localhost:8001`.
Select AV1 encoding with `--codec av1` for smaller file sizes.

```bash
node tools/j360-cli.js --resolution 4K --frames 600 --stereo output.mp4 demo.html
```

Use `--webm` to record directly to WebM instead of capturing JPEG frames.
Use `--wasm` to encode the capture using ffmpeg.wasm (produces MP4) entirely in
the browser. Frame rate and audio can be controlled with `--fps <n>` and
`--no-audio` respectively.

## Stereo 360° Capture

Toggle stereo mode at runtime with `toggleStereo()`. When enabled the output
frames contain left and right eye views side‑by‑side for VR playback.

### WebXR Preview

Use the "Enter VR" button to view the scene in a compatible headset before
exporting. When in VR a small on-screen overlay lets you exit or begin
recording without removing the headset. This is useful for verifying stereo
alignment and overall scene composition.

### Frame Processing Plugins

Register custom processors with `addFrameProcessor(fn)` to modify each JPEG frame
before encoding. See `src/processors.ts` for an example grayscale implementation.
Plugins can also be loaded from the CLI with `--plugin my-filter.js`.
GPU accelerated filters can be built with `createWebGLProcessor()` from `src/gpu-processors.ts` which runs custom shaders in an `OffscreenCanvas` for high performance transformations.

### Live Streaming

Call `startStreaming(url)` to send the canvas over WebRTC to a signaling server.
`stopStreaming()` ends the connection. A simple signaling server is provided in
`tools/signaling-server.js` and can be started with `npm run signaling`. Use its
URL with `--signal-url` or `startStreaming()` to preview remotely. The CLI
exposes `--stream` and `--signal-url` to automate remote preview from headless

### Remote Viewer

Open `viewer.html` in any browser to watch the WebRTC preview. The page connects to the signaling server on port 3000 and displays the incoming stream.

### HLS Viewer

When capturing with `--hls`, frames stream to an HLS server on port 8000. Open `hls-viewer.html` to play the generated playlist using `hls.js` while monitoring progress.

### Adaptive Resolution

Enable adaptive mode with `toggleAdaptive()` or pass `--adaptive` to the CLI. When active the library lowers the resolution if frames take longer than 40ms to render and raises it again once performance recovers.

# Unarchive, Convert, and Add Metadata

You can do this manually by extracting the files and running FFMPEG yourself:

```ffmpeg -i %07d.jpg video.mp4```

The “%07d” tells FFMPEG that there are 7 decimals before the “.jpg” extension in each filename.

To automate the process a script is provided in `tools/create-video.js`.  It requires `node`, `tar` and `ffmpeg` to be installed.  The script now embeds the necessary 360° metadata directly in Node so the external Spatial Media tool is no longer required.

Example usage:

```bash
node tools/create-video.js video.mp4 capture-*.tar
```

The script now reports progress as it extracts each archive and runs `ffmpeg` so
you know how many frames are being processed.

In tests of a 30 second capture, I've seen a 1.66GB folder of 4K 360 images compress into a single 3.12mb  4K 360 video.  A lot depends on how much movement there is in the scene, but the reductions are dramatic.

## Build and Run

Install dependencies with `npm install` and start a development server:

```bash
npm run dev
```

Build the bundled assets:

```bash
npm run build
```

Preview the production build locally:

```bash
npm run serve
```

# Contact
Get in touch with me on LinkedIn for custom 360 content or more versatile deployments of this software.  

https://www.linkedin.com/in/jamespollack
