#!/usr/bin/env node
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';
import { parseArgs } from 'node:util';

export interface Parsed {
  values: ReturnType<typeof parseArgs>['values'];
  positionals: string[];
}

export function parse(argv = process.argv.slice(2)): Parsed {
  const parsed = parseArgs({
    args: argv,
    options: {
      frames: { type: 'string', short: 'f' },
      resolution: { type: 'string', short: 'r' },
      stereo: { type: 'boolean', short: 's' },
      webm: { type: 'boolean', short: 'w' },
      wasm: { type: 'boolean' },
      fps: { type: 'string' },
      audio: { type: 'boolean' },
      'audio-file': { type: 'string' },
      stream: { type: 'boolean' },
      'signal-url': { type: 'string' },
      incremental: { type: 'boolean' },
      hls: { type: 'boolean' },
      interval: { type: 'string' },
      'stream-encode': { type: 'boolean' },
      screenshot: { type: 'boolean' },
      rtmp: { type: 'string' },
      codec: { type: 'string' },
      plugin: { type: 'string', multiple: true },
      adaptive: { type: 'boolean' }
    },
    allowPositionals: true
  });
  return { values: parsed.values, positionals: parsed.positionals };
}

async function run() {
  const { values, positionals } = parse();
  const output = positionals[0] || 'video.mp4';
  const html = positionals[1] || 'index.html';
  const frames = parseInt((values as any).frames || '300', 10);
  const resolution = (values as any).resolution || '4K';
  const stereo = !!(values as any).stereo;
  const useWebM = !!(values as any).webm;
  const useWasm = !!(values as any).wasm;
  const fps = parseInt((values as any).fps || '60', 10);
  const captureAudio = !!(values as any).audio;
  const audioFilePath = (values as any)['audio-file'];
  const audioFileData = audioFilePath ? fs.readFileSync(audioFilePath).toString('base64') : null;
  const includeAudio = captureAudio || !!audioFileData;
  const stream = !!(values as any).stream;
  const signalUrl = (values as any)['signal-url'] || 'http://localhost:3000';
  const incremental = !!(values as any).incremental;
  const hls = !!(values as any).hls;
  const interval = parseInt((values as any).interval || '0', 10);
  const streamEncode = !!(values as any)['stream-encode'];
  const screenshot = !!(values as any).screenshot;
  const rtmpUrl = (values as any).rtmp as string | undefined;
  const codec = ((values as any).codec || 'h264') as string;
  const plugins = (values as any).plugin ? ([] as string[]).concat(values.plugin) : [];
  const adaptive = !!(values as any).adaptive;

  function checkCmd(cmd: string) {
    const res = spawnSync('which', [cmd]);
    if (res.status !== 0) {
      throw new Error(`${cmd} not found in PATH`);
    }
  }

  try {
    if (!useWasm) {
      try {
        require('tar-stream');
        require('ffmpeg-static');
      } catch {
        checkCmd('tar');
        checkCmd('ffmpeg');
      }
    }
  } catch (e) {
    console.error(String(e));
    process.exit(1);
  }

  let hlsProc: any;
  let rtmpProc: any;
  if (hls) {
    hlsProc = require('child_process').spawn('node', [path.join('tools', 'hls-server.js'), '--fps', String(fps)], { stdio: 'inherit' });
  }
  if (rtmpUrl) {
    rtmpProc = require('child_process').spawn('node', [path.join('tools', 'rtmp-server.js'), '--url', rtmpUrl, '--fps', String(fps)], { stdio: 'inherit' });
  }

  const puppeteer = require('puppeteer');
  const url = 'file://' + path.resolve(html);
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto(url);
  await page.waitForFunction('window.startCapture360');
  for (const p of plugins) {
    const code = fs.readFileSync(p, 'utf8');
    await page.evaluate(async (src) => {
      const blob = new Blob([src], { type: 'text/javascript' });
      const u = URL.createObjectURL(blob);
      const mod = await import(u);
      (window as any).addFrameProcessor(mod.default || mod.process || mod);
    }, code);
  }

  if (screenshot) {
    const buffer = await page.evaluate(() => (window as any).captureFrameAsyncForCli());
    await browser.close();
    if (!buffer) throw new Error('No image data received');
    fs.writeFileSync(output, Buffer.from(buffer));
    console.log('Saved screenshot to', output);
    return;
  }
  await page.evaluate(({ resolution, stereo, useWebM, useWasm, fps, includeAudio, audioFileData, stream, signalUrl, hls, rtmp, incremental, interval, streamEncode, codec, adaptive }) => {
    const sel = document.getElementById('resolution') as HTMLSelectElement | null;
    if (sel) sel.value = resolution;
    if (stereo) (window as any).toggleStereo();
    if (adaptive) (window as any).toggleAdaptive();
    if (useWebM) {
      (window as any).startWebMRecording(fps, includeAudio);
    } else if (useWasm) {
      let audio: Uint8Array | undefined = undefined;
      if (audioFileData) {
        const bin = atob(audioFileData);
        const arr = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
        audio = arr;
      }
      (window as any).startWasmRecording(fps, incremental, includeAudio, audio, streamEncode, codec);
    } else {
      try { (window as any).startWebCodecsRecording(fps, includeAudio, codec); } catch { (window as any).startCapture360(); }
    }
    if (stream) {
      (window as any).startStreaming(signalUrl);
    }
    if (hls) {
      (window as any).startHLS('http://localhost:8000');
    }
    if (rtmp) {
      (window as any).startRTMP('http://localhost:8001');
    }
    if (interval > 0) {
      const input = document.getElementById('intervalMs') as HTMLInputElement | null;
      if (input) input.value = String(interval);
      (window as any).startTimedCapture();
    }
  }, { resolution, stereo, useWebM, useWasm, fps, includeAudio, audioFileData, stream, signalUrl, hls, rtmp: !!rtmpUrl, incremental, interval, streamEncode, codec, adaptive });

  const durationMs = (frames / fps) * 1000;
  const step = 1000;
  for (let t = 0; t < durationMs; t += step) {
    const percent = Math.floor((t / durationMs) * 100);
    process.stdout.write(`\rCapturing ${percent}%`);
    await page.waitForTimeout(step);
  }
  process.stdout.write('\rCapturing 100%\n');

  if (useWebM) {
    const buffer = await page.evaluate(() => (window as any).stopWebMRecordingForCli());
    await browser.close();
    if (hls && hlsProc) hlsProc.kill('SIGINT');
    if (rtmpProc) rtmpProc.kill('SIGINT');
    if (!buffer) throw new Error('No WebM data received');
    fs.writeFileSync(output, Buffer.from(buffer));
    console.log('Saved WebM to', output);
    return;
  }

  if (useWasm) {
    await page.exposeFunction('ffmpegProgress', (p: number) => {
      process.stdout.write(`\rEncoding ${p}%`);
    });
    const buffer = await page.evaluate(() =>
      (window as any).stopWasmRecordingForCli((p: number) => (window as any).ffmpegProgress(p))
    );
    process.stdout.write('\rEncoding 100%\n');
    await browser.close();
    if (hls && hlsProc) hlsProc.kill('SIGINT');
    if (rtmpProc) rtmpProc.kill('SIGINT');
    if (!buffer) throw new Error('No video data received');
    fs.writeFileSync(output, Buffer.from(buffer));
    console.log('Saved video to', output);
    return;
  }

  await page.evaluate(() => {
    (window as any).stopCapture360();
    if ((window as any).stopStreaming) (window as any).stopStreaming();
    if ((window as any).stopHLS) (window as any).stopHLS();
    if ((window as any).stopRTMP) (window as any).stopRTMP();
  });
  await browser.close();
  if (hls && hlsProc) hlsProc.kill('SIGINT');
  if (rtmpProc) rtmpProc.kill('SIGINT');

  const archives = fs.readdirSync(process.cwd()).filter(f => /^capture-.*\.tar$/.test(f));
  if (archives.length === 0) {
    console.error('No capture archives found');
    process.exit(1);
  }

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'j360-'));
  console.log(`Extracting archives to ${tmpDir}`);
  archives.forEach((archive, idx) => {
    const label = `[${idx + 1}/${archives.length}] ${archive}`;
    process.stdout.write(label + '\n');
    const res = spawnSync('tar', ['-xf', archive, '-C', tmpDir], { stdio: 'inherit' });
    if (res.status !== 0) process.exit(res.status);
  });

  const frameCount = fs.readdirSync(tmpDir).filter(f => f.endsWith('.jpg')).length;
  console.log(`Found ${frameCount} frames`);

  const codecMap: any = { av1: 'libaom-av1', vp9: 'libvpx-vp9', h264: 'libx264' };
  const ffmpegArgs = ['-y', '-framerate', String(fps), '-i', path.join(tmpDir, '%07d.jpg'), '-c:v', codecMap[codec] || 'libx264', output];
  console.log(`Running ffmpeg ${ffmpegArgs.join(' ')}`);
  let res = spawnSync('ffmpeg', ffmpegArgs, { stdio: 'inherit' });
  if (res.status !== 0) {
    console.error('ffmpeg failed');
    process.exit(res.status);
  }
  console.log('ffmpeg complete');

  try {
    const which = spawnSync('which', ['spatialmedia']);
    if (which.status === 0) {
      const injected = path.join(path.dirname(output), path.parse(output).name + '_360' + path.parse(output).ext);
      const args = ['-i', output, injected];
      console.log(`Injecting metadata: spatialmedia ${args.join(' ')}`);
      res = spawnSync('spatialmedia', args, { stdio: 'inherit' });
      if (res.status === 0) {
        console.log(`Metadata injected video at ${injected}`);
      } else {
        console.error('Metadata injection failed');
      }
    } else {
      console.log('spatialmedia not found, skipping metadata injection');
    }
  } catch (e) {
    console.log('spatialmedia not found, skipping metadata injection');
  }

  console.log('Done');
  fs.rmSync(tmpDir, { recursive: true, force: true });
}

if (require.main === module) {
  run().catch(err => { console.error(err); process.exit(1); });
}
