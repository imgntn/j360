#!/usr/bin/env node
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const puppeteer = require('puppeteer');

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) {
        args[key] = next;
        i++;
      } else {
        args[key] = true;
      }
    } else {
      args._.push(a);
    }
  }
  return args;
}

const args = parseArgs(process.argv);

const output = args._[0] || 'video.mp4';
const html = args._[1] || 'index.html';
const frames = parseInt(args.frames || '300', 10);
const resolution = args.resolution || '4K';
const stereo = !!args.stereo;
const useWebM = !!args.webm;

async function run() {
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
    process.stdout.write('.');
    await page.waitForTimeout(step);
  }
  process.stdout.write('\n');

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
    console.log(`  [${idx + 1}/${archives.length}] ${archive}`);
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
