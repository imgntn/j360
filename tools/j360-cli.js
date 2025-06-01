#!/usr/bin/env node
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const puppeteer = require('puppeteer');

const [output = 'video.mp4', html = 'index.html', frames = '300'] = process.argv.slice(2);

async function run() {
  const url = 'file://' + path.resolve(html);
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto(url);
  await page.waitForFunction('window.startCapture360');
  await page.evaluate(() => window.startCapture360());
  const durationMs = (parseInt(frames, 10) / 60) * 1000;
  await page.waitForTimeout(durationMs);
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
