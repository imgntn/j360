#!/usr/bin/env node
const express = require('express');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const args = require('minimist')(process.argv.slice(2));
const fps = parseInt(args.fps || '60', 10);
const outDir = path.resolve(process.cwd(), 'hls');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);
const ffmpegPath = (() => { try { return require('ffmpeg-static'); } catch { return 'ffmpeg'; }})();
const ffmpeg = spawn(ffmpegPath, ['-y','-f','image2pipe','-r', String(fps), '-i','-','-f','hls','-hls_time','1','-hls_list_size','4','-hls_flags','delete_segments+append_list', path.join(outDir,'out.m3u8')]);
ffmpeg.stderr.on('data', d => process.stderr.write(d));
const app = express();
app.use(express.raw({ limit: '10mb', type: '*/*' }));
app.post('/frame', (req,res) => { ffmpeg.stdin.write(req.body); res.end('ok'); });
app.use('/hls', express.static(outDir));
const server = app.listen(8000, () => console.log('HLS server at http://localhost:8000/hls/out.m3u8'));
process.on('SIGINT', () => { ffmpeg.stdin.end(); ffmpeg.kill('SIGINT'); server.close(() => process.exit()); });
