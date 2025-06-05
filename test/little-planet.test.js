const assert = require('assert');

function FakeCanvas() {
  this.width = 0;
  this.height = 0;
}
FakeCanvas.prototype.getContext = function() {
  const self = this;
  return {
    getImageData: () => ({ data: new Uint8ClampedArray(self.width * self.height * 4) }),
    createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }),
    putImageData: () => {}
  };
};
FakeCanvas.prototype.toBlob = function(cb) { cb(new Blob()); };

global.document = { createElement: () => new FakeCanvas() };
if (typeof ImageData === 'undefined') {
  global.ImageData = function(data, w, h){ this.data=data; this.width=w; this.height=h; };
}

function toLittlePlanet(ctx, width, height) {
  const size = Math.min(width, height);
  const out = new FakeCanvas();
  out.width = size;
  out.height = size;
  const octx = out.getContext('2d');
  const src = ctx.getImageData(0, 0, width, height).data;
  const dst = octx.createImageData(size, size);
  const cx = size / 2;
  const cy = size / 2;
  const radius = size / 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const r = Math.sqrt(dx * dx + dy * dy);
      if (r > radius) continue;
      const theta = Math.atan2(dy, dx);
      const phi = 2 * Math.atan(r / radius);
      let u = (theta + Math.PI) / (2 * Math.PI);
      let v = phi / Math.PI;
      const sx = Math.min(width - 1, Math.max(0, Math.floor(u * width)));
      const sy = Math.min(height - 1, Math.max(0, Math.floor(v * height)));
      const si = (sy * width + sx) * 4;
      const di = (y * size + x) * 4;
      dst.data[di] = src[si];
      dst.data[di + 1] = src[si + 1];
      dst.data[di + 2] = src[si + 2];
      dst.data[di + 3] = 255;
    }
  }
  octx.putImageData(dst, 0, 0);
  return out;
}

function toLittlePlanetGpu(renderer, ctx, width, height) {
  const gl = renderer && renderer.getContext && renderer.getContext();
  if (!gl) {
    return toLittlePlanet(ctx, width, height);
  }
  return new FakeCanvas();
}

const canvas = new FakeCanvas();
canvas.width = 1024;
canvas.height = 512;
const ctx = canvas.getContext('2d');
const out = toLittlePlanetGpu({ getContext: () => null }, ctx, canvas.width, canvas.height);
assert.strictEqual(out.width, 512);
assert.strictEqual(out.height, 512);
console.log('little planet gpu test ok');
