@group(0) @binding(0) var samp : sampler;
@group(0) @binding(1) var src : texture_cube<f32>;
@group(0) @binding(2) var dst : texture_storage_2d<rgba8unorm, write>;

@compute @workgroup_size(8,8)
fn main(@builtin(global_invocation_id) id : vec3<u32>) {
  let dims = textureDimensions(dst);
  if (id.x >= dims.x || id.y >= dims.y) { return; }
  let width = f32(dims.x);
  let height = f32(dims.y);
  let u = (f32(id.x) + 0.5) / width;
  let v = (f32(id.y) + 0.5) / height;
  let longitude = u * 6.283185307179586 - 3.141592653589793 + 1.5707963267948966;
  let latitude = v * 3.141592653589793;
  var dir = vec3<f32>(-sin(longitude) * sin(latitude), cos(latitude), -cos(longitude) * sin(latitude));
  dir = normalize(dir);
  let color = textureSample(src, samp, dir);
  textureStore(dst, vec2<i32>(i32(id.x), i32(id.y)), color);
}
