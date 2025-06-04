@group(0) @binding(0) var samp : sampler;
@group(0) @binding(1) var src : texture_2d<f32>;
@group(0) @binding(2) var dst : texture_storage_2d_array<rgba8unorm, write>;

@compute @workgroup_size(8,8,1)
fn main(@builtin(global_invocation_id) id : vec3<u32>) {
  let dims = textureDimensions(dst);
  if (id.x >= dims.x || id.y >= dims.y || id.z >= 6u) { return; }
  let size = f32(dims.x);
  let uv = (vec2<f32>(f32(id.x) + 0.5, f32(id.y) + 0.5) / size) * 2.0 - 1.0;
  var dir = vec3<f32>(0.0);
  switch(i32(id.z)) {
    case 0: dir = normalize(vec3<f32>(1.0, -uv.y, -uv.x));
    case 1: dir = normalize(vec3<f32>(-1.0, -uv.y, uv.x));
    case 2: dir = normalize(vec3<f32>(uv.x, 1.0, uv.y));
    case 3: dir = normalize(vec3<f32>(uv.x, -1.0, -uv.y));
    case 4: dir = normalize(vec3<f32>(uv.x, -uv.y, 1.0));
    default: dir = normalize(vec3<f32>(-uv.x, -uv.y, -1.0));
  }
  let theta = atan2(dir.z, dir.x);
  let phi = acos(dir.y);
  let u = (theta + 3.141592653589793) / 6.283185307179586;
  let v = phi / 3.141592653589793;
  let color = textureSample(src, samp, vec2<f32>(u, v));
  textureStore(dst, vec3<i32>(i32(id.x), i32(id.y), i32(id.z)), color);
}
