#!/usr/bin/env node
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { parseArgs } = require('node:util');
const puppeteer = require('puppeteer');

const parsed = parseArgs({
  args: process.argv.slice(2),
  options: {
    frames: { type: 'string', short: 'f' },
    resolution: { type: 'string', short: 'r' },
    stereo: { type: 'boolean', short: 's' },
    webm: { type: 'boolean', short: 'w' }
  },
  allowPositionals: true
});

const values = parsed.values;
const positionals = parsed.positionals;

const output = positionals[0] || 'video.mp4';
const html = positionals[1] || 'index.html';
const frames = parseInt(values.frames || '300', 10);
const resolution = values.resolution || '4K';
const stereo = !!values.stereo;
const useWebM = !!values.webm;

function checkCmd(cmd) {
  const res = spawnSync('which', [cmd]);
  if (res.status !== 0) {
    throw new Error(`${cmd} not found in PATH`);
  }
}

const output = args._[0] || 'video.mp4';
const html = args._[1] || 'index.html';
const frames = parseInt(args.frames || '300', 10);
const resolution = args.resolution || '4K';
const stereo = !!args.stereo;
const useWebM = !!args.webm;

async function run() {
  try {
    checkCmd('tar');
    checkCmd('ffmpeg');
  } catch (e) {
    console.error(String(e));
    process.exit(1);
  }
  const url = 'file://' + path.resolve(html);
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto(url);
  await page.waitForFunction('window.startCapture360');
  await page.evaluate(({ resolution, stereo, useWebM }) => {
    const sel = document.getElementById('resolution');
    if (sel) sel.value = resolution;
    if (stereo) window.toggleStereo();
    if (useWebM) {
      window.startWebMRecording();
    } else {
      window.startCapture360();
    }
  }, { resolution, stereo, useWebM });

  const durationMs = (frames / 60) * 1000;
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
    if (!buffer) throw new Error('No WebM data received');
    fs.writeFileSync(output, Buffer.from(buffer));
    console.log('Saved WebM to', output);
    return;
  }

  await page.evaluate(() => window.stopCapture360());
  await browser.close();

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

  const ffmpegArgs = ['-y', '-i', path.join(tmpDir, '%07d.jpg'), output];
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

run().catch(err => { console.error(err); process.exit(1); });
