const assert = require('assert');
const { parseArgs } = require('node:util');

function parse(argv) {
  const parsed = parseArgs({
    args: argv,
    options: {
      frames: { type: 'string', short: 'f' },
      resolution: { type: 'string', short: 'r' },
      stereo: { type: 'boolean', short: 's' },
      webm: { type: 'boolean', short: 'w' }
    },
    allowPositionals: true
  });
  return { values: parsed.values, positionals: parsed.positionals };
}

const res1 = parse(['-f','120','out.mp4']);
assert.strictEqual(res1.values.frames, '120');
assert.strictEqual(res1.positionals[0], 'out.mp4');

const res2 = parse(['--stereo','--webm']);
assert.strictEqual(res2.values.stereo, true);
assert.strictEqual(res2.values.webm, true);

console.log('j360-cli argument parsing ok');
