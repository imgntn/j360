#!/usr/bin/env node
const path = require('path');
const { spawnSync } = require('child_process');
const puppeteer = require('puppeteer');

const [output = 'video.mp4', html = 'index.html', frames = '300'] = process.argv.slice(2);

(async () => {
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
  spawnSync('node', [path.join('tools', 'create-video.js'), output, 'capture-*.tar'], {
    stdio: 'inherit'
  });
})();
