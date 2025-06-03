export function createWebGLProcessor(fragmentSource: string) {
  let canvas: OffscreenCanvas | null = null;
  let gl: WebGLRenderingContext | null = null;
  let program: WebGLProgram | null = null;
  const vertex = `attribute vec2 p;varying vec2 v;void main(){v=p*0.5+0.5;gl_Position=vec4(p,0,1);}`;
  function init(width: number, height: number) {
    canvas = new OffscreenCanvas(width, height);
    gl = canvas.getContext('webgl');
    if (!gl) return;
    const vs = gl.createShader(gl.VERTEX_SHADER)!; gl.shaderSource(vs, vertex); gl.compileShader(vs);
    const fs = gl.createShader(gl.FRAGMENT_SHADER)!; gl.shaderSource(fs, fragmentSource); gl.compileShader(fs);
    program = gl.createProgram()!; gl.attachShader(program, vs); gl.attachShader(program, fs); gl.linkProgram(program);
    gl.useProgram(program);
    const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,1,1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(program,'p');
    gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc,2,gl.FLOAT,false,0,0);
  }
  return async (frame: Uint8Array) => {
    const blob = new Blob([frame], {type:'image/jpeg'});
    const bmp = await createImageBitmap(blob);
    if(!canvas) init(bmp.width, bmp.height);
    if(!gl||!program||!canvas) return frame;
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,bmp);
    gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
    const pixels = new Uint8Array(bmp.width*bmp.height*4);
    gl.readPixels(0,0,bmp.width,bmp.height,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
    const ctx = canvas.getContext('2d');
    if(!ctx) return frame;
    const imgData = new ImageData(new Uint8ClampedArray(pixels), bmp.width, bmp.height);
    ctx.putImageData(imgData,0,0);
    const out = await canvas.convertToBlob({type:'image/jpeg'});
    const buf = await out.arrayBuffer();
    return new Uint8Array(buf);
  };
}

export const invertFilter = createWebGLProcessor(
  'precision mediump float;varying vec2 v;uniform sampler2D t;void main(){gl_FragColor=vec4(1.0-texture2D(t,v).rgb,1.0);}'
);
