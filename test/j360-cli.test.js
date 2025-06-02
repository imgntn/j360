const assert = require('assert');
const { parse } = require('../tools/j360-cli.js');

const res1 = parse(['-f','120','out.mp4']);
assert.strictEqual(res1.values.frames, '120');
assert.strictEqual(res1.positionals[0], 'out.mp4');

const res2 = parse(['--stereo','--webm']);
assert.strictEqual(res2.values.stereo, true);
assert.strictEqual(res2.values.webm, true);

const res3 = parse(['--fps','30','--no-audio','--wasm']);
assert.strictEqual(res3.values.fps, '30');
assert.strictEqual(res3.values['no-audio'], true);
assert.strictEqual(res3.values.wasm, true);

console.log('j360-cli argument parsing ok');
