const { execSync } = require('child_process');
const path = require('path');
let ts;
try {
  ts = require('typescript');
} catch {
  const root = execSync('npm root -g').toString().trim();
  ts = require(path.join(root, 'typescript'));
}
module.exports = ts;
