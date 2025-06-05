# Repository Diagrams

This document provides a visual overview of how J360 components fit together. Diagrams use [Mermaid](https://mermaid.js.org/) syntax and can be rendered directly on GitHub.

## Capture Flowchart

```mermaid
flowchart TD
    A[Start Capture] --> B{Mode}
    B -->|CCapture| C[Frames -> TAR archives]
    B -->|WebMRecorder| D[WebM download]
    B -->|WebCodecs| E[VP9 WebM]
    B -->|ffmpeg.wasm| F[MP4 output]
    C --> G{Post Process?}
    G -->|ffmpeg| H[Video File]
    G -->|HLS/RTMP| I[Streamed Frames]
```

This chart summarizes the recording paths described in [README.md](../README.md).

## CLI Sequence Diagram

```mermaid
sequenceDiagram
    participant User
    participant CLI
    participant Browser
    participant Page
    User->>CLI: Run `j360-cli.js`
    CLI->>Browser: Launch headless
    Browser->>Page: Load HTML scene
    CLI->>Page: startCapture360()
    Page-->>CLI: progress updates
    CLI-->>Browser: Close
    CLI->>User: Video file
```

The sequence is based on [tools/j360-cli.ts](../tools/j360-cli.ts).

## Class Relationships

```mermaid
classDiagram
    class J360App {
        +startCapture360()
        +startWebMRecording()
        +startWebCodecsRecording()
        +startWasmRecording()
    }
    J360App --> WebMRecorder
    J360App --> WebCodecsRecorder
    J360App --> FfmpegEncoder
    J360App --> WebRTCStreamer
```

Methods shown above are defined in [src/j360.ts](../src/j360.ts).

## Development Timeline

```mermaid
timeline
    title Typical Workflow
    2025 : Clone repository
    2025 : npm install
    2025 : npm run dev
    2025 : Record demo
    2025 : Run j360-cli.js
    2025 : Convert with create-video.js
    2025 : Release v2.0
```

## Gitgraph

```mermaid
gitGraph
    commit id: "init" tag: "v1"
    commit id: "recorder" tag: "recording"
    commit id: "stream" tag: "streaming"
    commit id: "cli" tag: "cli"
    commit id: "webgpu" tag: "v2"
```

