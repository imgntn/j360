#!/usr/bin/env node
const express = require('express');
const path = require('path');
const { spawn } = require('child_process');
const args = require('minimist')(process.argv.slice(2));
const fps = parseInt(args.fps || '60', 10);
const url = args.url;
if (!url) {
  console.error('RTMP URL required via --url');
  process.exit(1);
}
const ffmpegPath = (() => { try { return require('ffmpeg-static'); } catch { return 'ffmpeg'; }})();
const ffmpeg = spawn(ffmpegPath, ['-y','-f','image2pipe','-r',String(fps),'-i','-','-c:v','libx264','-f','flv',url]);
ffmpeg.stderr.on('data', d => process.stderr.write(d));
const app = express();
app.use(express.raw({ limit: '10mb', type: '*/*' }));
app.post('/frame', (req,res) => { ffmpeg.stdin.write(req.body); res.end('ok'); });
const server = app.listen(8001, () => console.log('RTMP proxy on http://localhost:8001 -> ' + url));
process.on('SIGINT', () => { ffmpeg.stdin.end(); ffmpeg.kill('SIGINT'); server.close(() => process.exit()); });
