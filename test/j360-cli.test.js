const assert = require('assert');
const { parse } = require('../tools/j360-cli.js');

const res1 = parse(['-f','120','out.mp4']);
assert.strictEqual(res1.values.frames, '120');
assert.strictEqual(res1.positionals[0], 'out.mp4');

const res2 = parse(['--stereo','--webm']);
assert.strictEqual(res2.values.stereo, true);
assert.strictEqual(res2.values.webm, true);

const res3 = parse(['--fps','30','--audio','--wasm']);
assert.strictEqual(res3.values.fps, '30');
assert.strictEqual(res3.values.audio, true);
assert.strictEqual(res3.values.wasm, true);

const res4 = parse(['--incremental','--hls','--audio-file','track.wav']);
assert.strictEqual(res4.values.incremental, true);
assert.strictEqual(res4.values.hls, true);
assert.strictEqual(res4.values['audio-file'], 'track.wav');

const res5 = parse(['--interval','500']);
assert.strictEqual(res5.values.interval, '500');

const res6 = parse(['--stream-encode']);
assert.strictEqual(res6.values['stream-encode'], true);

const res7 = parse(['--screenshot']);
assert.strictEqual(res7.values.screenshot, true);

const res8 = parse(['--rtmp','rtmp://example']);
assert.strictEqual(res8.values.rtmp, 'rtmp://example');

const res9 = parse(['--codec','av1']);
assert.strictEqual(res9.values.codec, 'av1');

const res10 = parse(['--plugin','a.js','--plugin','b.js']);
assert.deepStrictEqual(res10.values.plugin, ['a.js','b.js']);

const res11 = parse(['--adaptive']);
assert.strictEqual(res11.values.adaptive, true);

console.log('j360-cli argument parsing ok');
