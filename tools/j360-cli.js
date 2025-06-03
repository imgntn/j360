#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parse = parse;
const fs_1 = require("fs");
const os_1 = require("os");
const path_1 = require("path");
const child_process_1 = require("child_process");
const node_util_1 = require("node:util");
function parse(argv = process.argv.slice(2)) {
    const parsed = (0, node_util_1.parseArgs)({
        args: argv,
        options: {
            frames: { type: 'string', short: 'f' },
            resolution: { type: 'string', short: 'r' },
            stereo: { type: 'boolean', short: 's' },
            webm: { type: 'boolean', short: 'w' },
            wasm: { type: 'boolean' },
            fps: { type: 'string' },
            'no-audio': { type: 'boolean' },
            audio: { type: 'boolean' },
            'audio-file': { type: 'string' },
            stream: { type: 'boolean' },
            'signal-url': { type: 'string' },
            incremental: { type: 'boolean' },
            hls: { type: 'boolean' }
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
    const includeAudioFlag = !values['no-audio'];
    const captureAudio = !!values.audio;
    const audioFilePath = values['audio-file'];
    let audioFileData = null;
    if (audioFilePath) {
        audioFileData = fs_1.default.readFileSync(audioFilePath).toString('base64');
    }
    const withAudio = includeAudioFlag && (captureAudio || !!audioFileData);
    const stream = !!values.stream;
    const signalUrl = values['signal-url'] || 'http://localhost:3000';
    const incremental = !!values.incremental;
    const hls = !!values.hls;
    function checkCmd(cmd) {
        const res = (0, child_process_1.spawnSync)('which', [cmd]);
        if (res.status !== 0) {
            throw new Error(`${cmd} not found in PATH`);
        }
    }
    try {
        if (!useWasm) {
            checkCmd('tar');
            checkCmd('ffmpeg');
        }
    }
    catch (e) {
        console.error(String(e));
        process.exit(1);
    }
    let hlsProc;
    if (hls) {
        hlsProc = require('child_process').spawn('node', [path_1.default.join('tools', 'hls-server.js'), '--fps', String(fps)], { stdio: 'inherit' });
    }
    const puppeteer = require('puppeteer');
    const url = 'file://' + path_1.default.resolve(html);
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto(url);
    await page.waitForFunction('window.startCapture360');
    await page.evaluate(({ resolution, stereo, useWebM, useWasm, fps, withAudio, audioFileData, stream, signalUrl, incremental, hls }) => {
        const sel = document.getElementById('resolution');
        if (sel)
            sel.value = resolution;
        if (stereo)
            window.toggleStereo();
        if (useWebM) {
            window.startWebMRecording(fps, withAudio);
        }
        else if (useWasm) {
            let audio = undefined;
            if (audioFileData) {
                const bin = atob(audioFileData);
                const arr = new Uint8Array(bin.length);
                for (let i = 0; i < bin.length; i++)
                    arr[i] = bin.charCodeAt(i);
                audio = arr;
            }
            window.startWasmRecording(fps, incremental, withAudio, audio);
        }
        else {
            try {
                window.startWebCodecsRecording(fps, withAudio);
            }
            catch (_a) {
                window.startCapture360();
            }
        }
        if (stream) {
            window.startStreaming(signalUrl);
        }
        if (hls) {
            window.startHLS('http://localhost:8000');
        }
    }, { resolution, stereo, useWebM, useWasm, fps, withAudio, audioFileData, stream, signalUrl, incremental, hls });
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
        if (hls && hlsProc)
            hlsProc.kill('SIGINT');
        if (!buffer)
            throw new Error('No WebM data received');
        fs_1.default.writeFileSync(output, Buffer.from(buffer));
        console.log('Saved WebM to', output);
        return;
    }
    if (useWasm) {
        await page.exposeFunction('ffmpegProgress', (p) => {
            process.stdout.write(`\rEncoding ${p}%`);
        });
        const buffer = await page.evaluate(() => window.stopWasmRecordingForCli((p) => window.ffmpegProgress(p)));
        process.stdout.write('\rEncoding 100%\n');
        await browser.close();
        if (hls && hlsProc)
            hlsProc.kill('SIGINT');
        if (!buffer)
            throw new Error('No video data received');
        fs_1.default.writeFileSync(output, Buffer.from(buffer));
        console.log('Saved video to', output);
        return;
    }
    await page.evaluate(() => {
        window.stopCapture360();
        if (window.stopStreaming)
            window.stopStreaming();
        if (window.stopHLS)
            window.stopHLS();
    });
    await browser.close();
    if (hls && hlsProc)
        hlsProc.kill('SIGINT');
    const archives = fs_1.default.readdirSync(process.cwd()).filter(f => /^capture-.*\.tar$/.test(f));
    if (archives.length === 0) {
        console.error('No capture archives found');
        process.exit(1);
    }
    const tmpDir = fs_1.default.mkdtempSync(path_1.default.join(os_1.default.tmpdir(), 'j360-'));
    console.log(`Extracting archives to ${tmpDir}`);
    archives.forEach((archive, idx) => {
        const label = `[${idx + 1}/${archives.length}] ${archive}`;
        process.stdout.write(label + '\n');
        const res = (0, child_process_1.spawnSync)('tar', ['-xf', archive, '-C', tmpDir], { stdio: 'inherit' });
        if (res.status !== 0)
            process.exit(res.status);
    });
    const frameCount = fs_1.default.readdirSync(tmpDir).filter(f => f.endsWith('.jpg')).length;
    console.log(`Found ${frameCount} frames`);
    const ffmpegArgs = ['-y', '-framerate', String(fps), '-i', path_1.default.join(tmpDir, '%07d.jpg'), output];
    console.log(`Running ffmpeg ${ffmpegArgs.join(' ')}`);
    let res = (0, child_process_1.spawnSync)('ffmpeg', ffmpegArgs, { stdio: 'inherit' });
    if (res.status !== 0) {
        console.error('ffmpeg failed');
        process.exit(res.status);
    }
    console.log('ffmpeg complete');
    try {
        const which = (0, child_process_1.spawnSync)('which', ['spatialmedia']);
        if (which.status === 0) {
            const injected = path_1.default.join(path_1.default.dirname(output), path_1.default.parse(output).name + '_360' + path_1.default.parse(output).ext);
            const args = ['-i', output, injected];
            console.log(`Injecting metadata: spatialmedia ${args.join(' ')}`);
            res = (0, child_process_1.spawnSync)('spatialmedia', args, { stdio: 'inherit' });
            if (res.status === 0) {
                console.log(`Metadata injected video at ${injected}`);
            }
            else {
                console.error('Metadata injection failed');
            }
        }
        else {
            console.log('spatialmedia not found, skipping metadata injection');
        }
    }
    catch (e) {
        console.log('spatialmedia not found, skipping metadata injection');
    }
    console.log('Done');
    fs_1.default.rmSync(tmpDir, { recursive: true, force: true });
}
if (require.main === module) {
    run().catch(err => { console.error(err); process.exit(1); });
}
