const assert = require('assert');
const { parse } = require('../tools/j360-cli.js');

const res1 = parse(['-f','120','out.mp4']);
assert.strictEqual(res1.values.frames, '120');
assert.strictEqual(res1.positionals[0], 'out.mp4');

const res2 = parse(['--stereo','--webm']);
assert.strictEqual(res2.values.stereo, true);
assert.strictEqual(res2.values.webm, true);

console.log('j360-cli argument parsing ok');
