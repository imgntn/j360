#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

if (process.argv.length < 4) {
  console.error('Usage: node tools/create-video.js <output.mp4> <archive.tar ...>');
  process.exit(1);
}

const output = path.resolve(process.argv[2]);
const archives = process.argv.slice(3);

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'j360-'));

console.log(`Extracting archives to ${tmpDir}`);

(async () => {
  let hasTarStream = false;
  try { require('tar-stream'); hasTarStream = true; } catch {}

  if (hasTarStream) {
    const { extract } = require('tar-stream');
    const fsP = fs.promises;
    for (const [idx, archive] of archives.entries()) {
      console.log(`  [${idx + 1}/${archives.length}] ${archive}`);
      await new Promise((resolve, reject) => {
        const ext = extract();
        ext.on('entry', async (header, stream, next) => {
          try {
            const dest = path.join(tmpDir, header.name);
            if (header.type === 'directory') {
              await fsP.mkdir(dest, { recursive: true });
              stream.resume();
              next();
            } else {
              await fsP.mkdir(path.dirname(dest), { recursive: true });
              const out = fs.createWriteStream(dest);
              stream.pipe(out);
              out.on('finish', next);
              out.on('error', reject);
            }
          } catch (err) {
            reject(err);
          }
        });
        ext.on('finish', resolve);
        ext.on('error', reject);
        fs.createReadStream(archive).on('error', reject).pipe(ext);
      }).catch(err => {
        console.error(`Failed to extract ${archive}:`, err.message);
        process.exit(1);
      });
    }
  } else {
    archives.forEach((archive, idx) => {
      console.log(`  [${idx + 1}/${archives.length}] ${archive}`);
      const res = spawnSync('tar', ['-xf', archive, '-C', tmpDir], { stdio: 'inherit' });
      if (res.status !== 0) {
        console.error(`Failed to extract ${archive}`);
        process.exit(res.status);
      }
    });
  }

const frameCount = fs.readdirSync(tmpDir).filter(f => f.endsWith('.jpg')).length;
console.log(`Found ${frameCount} frames`);


const ffmpegPath = (() => { try { return require('ffmpeg-static'); } catch { return 'ffmpeg'; }})();
const ffmpegArgs = ['-y', '-i', path.join(tmpDir, '%07d.jpg'), output];
console.log(`Running ffmpeg ${ffmpegArgs.join(' ')}`);
let res = spawnSync(ffmpegPath, ffmpegArgs, { stdio: 'inherit' });
if (res.status !== 0) {
  console.error('ffmpeg failed');
  process.exit(res.status);
}
console.log('ffmpeg complete');

try {
  const { injectMp4 } = require('./metadata');
  console.log('Injecting 360 metadata');
  injectMp4(output);
  console.log('Metadata injected');
} catch (e) {
  console.error('Metadata injection failed:', e.message);
}

console.log('Done');
fs.rmSync(tmpDir, { recursive: true, force: true });
})().catch(e => {
  console.error('Extraction failed:', e.message || e);
  process.exit(1);
});
