export default `
precision mediump float;
varying vec2 v;
uniform sampler2D t;
void main(){
  vec4 c = texture2D(t, v);
  gl_FragColor = vec4(1.0 - c.rgb, c.a);
}`;
