
const vertexShader = `
attribute vec3 position;
attribute vec2 uv;

uniform mat4 projectionMatrix;
uniform mat4 modelViewMatrix;

varying vec2 vUv;

void main()  {
        vUv = vec2( 1.- uv.x, uv.y );
        gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
}`;

const fragmentShader = `
precision mediump float;

uniform samplerCube map;

varying vec2 vUv;

#define M_PI 3.1415926535897932384626433832795

void main()  {
        vec2 uv = vUv;
        float longitude = uv.x * 2. * M_PI - M_PI + M_PI / 2.;
        float latitude = uv.y * M_PI;
        vec3 dir = vec3(
                - sin( longitude ) * sin( latitude ),
                cos( latitude ),
                - cos( longitude ) * sin( latitude )
        );
        normalize( dir );
        gl_FragColor = vec4( textureCube( map, dir ).rgb, 1. );
}`;

self.onmessage = async (e: MessageEvent) => {
  const { faces, width, height } = e.data as { faces: ImageBitmap[]; width: number; height: number };
  const canvas = new OffscreenCanvas(width, height);
  const renderer = new THREE.WebGLRenderer({ canvas });
  const material = new THREE.RawShaderMaterial({
    uniforms: { map: { value: null } },
    vertexShader,
    fragmentShader,
    side: THREE.DoubleSide
  });
  const scene = new THREE.Scene();
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(width, height), material);
  scene.add(quad);
  const camera = new THREE.OrthographicCamera(width / -2, width / 2, height / 2, height / -2, -10000, 10000);
  const output = new THREE.WebGLRenderTarget(width, height, {
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    wrapS: THREE.ClampToEdgeWrapping,
    wrapT: THREE.ClampToEdgeWrapping,
    format: THREE.RGBAFormat,
    type: THREE.UnsignedByteType
  });
  const texture = new THREE.CubeTexture(faces);
  texture.needsUpdate = true;
  material.uniforms.map.value = texture;
  renderer.render(scene, camera, output, true);
  const pixels = new Uint8Array(4 * width * height);
  renderer.readRenderTargetPixels(output, 0, 0, width, height, pixels);
  self.postMessage({ buffer: pixels.buffer }, [pixels.buffer]);
};
