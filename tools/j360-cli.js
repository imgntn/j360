#!/usr/bin/env node
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { parseArgs } = require('node:util');

function parse(argv = process.argv.slice(2)) {
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
      interval: { type: 'string' }
    },
    allowPositionals: true
  });
  return { values: parsed.values, positionals: parsed.positionals };
}

async function run() {
  const { values, positionals } = parse();
  const output = positionals[0] || 'video.mp4';
  const html = positionals[1] || 'index.html';
  const frames = parseInt(values.frames || '300', 10);
  const resolution = values.resolution || '4K';
  const stereo = !!values.stereo;
  const useWebM = !!values.webm;
  const useWasm = !!values.wasm;
  const fps = parseInt(values.fps || '60', 10);
  const captureAudio = !!values.audio;
  const audioFilePath = values['audio-file'];
  let audioFileData = null;
  if (audioFilePath) {
    audioFileData = fs.readFileSync(audioFilePath).toString('base64');
  }
  const includeAudio = captureAudio || !!audioFileData;
  const stream = !!values.stream;
  const signalUrl = values['signal-url'] || 'http://localhost:3000';
  const incremental = !!values.incremental;
  const hls = !!values.hls;
  const interval = parseInt(values.interval || '0', 10);

  function checkCmd(cmd) {
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

  let hlsProc;
  if (hls) {
    hlsProc = require('child_process').spawn('node', [path.join('tools', 'hls-server.js'), '--fps', String(fps)], { stdio: 'inherit' });
  }
  const puppeteer = require('puppeteer');
  const url = 'file://' + path.resolve(html);
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto(url);
  await page.waitForFunction('window.startCapture360');
  await page.evaluate(({ resolution, stereo, useWebM, useWasm, fps, includeAudio, audioFileData, stream, signalUrl, hls, incremental, interval }) => {
    const sel = document.getElementById('resolution');
    if (sel) sel.value = resolution;
    if (stereo) window.toggleStereo();
    if (useWebM) {
      window.startWebMRecording(fps, includeAudio);
    } else if (useWasm) {
      let audio = undefined;
      if (audioFileData) {
        const bin = atob(audioFileData);
        const arr = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
        audio = arr;
      }
      window.startWasmRecording(fps, incremental, includeAudio, audio);
    } else {
      try {
        window.startWebCodecsRecording(fps, includeAudio);
      } catch { window.startCapture360(); }
    }
    if (stream) {
      window.startStreaming(signalUrl);
    }
    if (hls) {
      window.startHLS('http://localhost:8000');
    }
    if (interval > 0) {
      const input = document.getElementById('intervalMs');
      if (input) input.value = String(interval);
      window.startTimedCapture();
    }
  }, { resolution, stereo, useWebM, useWasm, fps, includeAudio, audioFileData, stream, signalUrl, hls, incremental, interval });

  const durationMs = (frames / fps) * 1000;
  const step = 1000;
  for (let t = 0; t < durationMs; t += step) {
    const percent = Math.floor((t / durationMs) * 100);
    process.stdout.write(`\rCapturing ${percent}%`);
    await page.waitForTimeout(step);
  }
  process.stdout.write('\rCapturing 100%\n');

  if (useWebM) {
    const buffer = await page.evaluate(() => window.stopWebMRecordingForCli());
    await browser.close();
    if (hls && hlsProc) hlsProc.kill('SIGINT');
    if (!buffer) throw new Error('No WebM data received');
    fs.writeFileSync(output, Buffer.from(buffer));
    console.log('Saved WebM to', output);
    return;
  }

  if (useWasm) {
    const buffer = await page.evaluate(() => window.stopWasmRecordingForCli());
    await browser.close();
    if (hls && hlsProc) hlsProc.kill('SIGINT');
    if (!buffer) throw new Error('No video data received');
    fs.writeFileSync(output, Buffer.from(buffer));
    console.log('Saved video to', output);
    return;
  }

  const buffer = await page.evaluate(() => window.stopWebCodecsRecordingForCli && window.stopWebCodecsRecordingForCli());
  if (buffer) {
    await browser.close();
    if (hls && hlsProc) hlsProc.kill('SIGINT');
    fs.writeFileSync(output, Buffer.from(buffer));
    console.log('Saved video to', output);
    return;
  }

  await page.evaluate(() => { window.stopCapture360(); if (window.stopStreaming) window.stopStreaming(); if (window.stopHLS) window.stopHLS(); });
  await browser.close();
  if (hls && hlsProc) hlsProc.kill('SIGINT');

  const archives = fs.readdirSync(process.cwd()).filter(f => /^capture-.*\.tar$/.test(f));
  if (archives.length === 0) {
    console.error('No capture archives found');
    process.exit(1);
  }

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'j360-'));
  console.log(`Extracting archives to ${tmpDir}`);
  let tarExtract;
  try { tarExtract = require('tar-stream').extract(); } catch {}
  if (tarExtract) {
    const extract = require('tar-stream').extract();
    const pipeline = require('stream').pipeline;
    const fsSync = require('fs');
    await Promise.all(archives.map(a => new Promise((resolve, reject) => {
      pipeline(fsSync.createReadStream(a), extract, err => err ? reject(err) : resolve());
    })));
  } else {
    archives.forEach((archive, idx) => {
      const label = `[${idx + 1}/${archives.length}] ${archive}`;
      process.stdout.write(label + '\n');
      const res = spawnSync('tar', ['-xf', archive, '-C', tmpDir], { stdio: 'inherit' });
      if (res.status !== 0) process.exit(res.status);
    });
  }

  const frameCount = fs.readdirSync(tmpDir).filter(f => f.endsWith('.jpg')).length;
  console.log(`Found ${frameCount} frames`);

  const ffmpegPath = (() => { try { return require('ffmpeg-static'); } catch { return 'ffmpeg'; }})();
  const ffmpegArgs = ['-y', '-framerate', String(fps), '-i', path.join(tmpDir, '%07d.jpg'), output];
  console.log(`Running ffmpeg ${ffmpegArgs.join(' ')}`);
  let res = spawnSync(ffmpegPath, ffmpegArgs, { stdio: 'inherit' });
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

module.exports = { parse };
