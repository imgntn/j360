const fs = require('fs');

function injectMp4(file){
  const data = fs.readFileSync(file);
  const moov = data.indexOf('moov');
  if(moov < 0) throw new Error('moov atom not found');
  const size = data.readUInt32BE(moov - 4);
  const end = moov - 4 + size;
  const before = data.slice(0, end);
  const after = data.slice(end);
  const xml = Buffer.from(`<?xml version="1.0"?>\n<rdf:SphericalVideo xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns:GSpherical="http://ns.google.com/videos/1.0/spherical/">\n<GSpherical:Spherical>true</GSpherical:Spherical>\n<GSpherical:Stitched>true</GSpherical:Stitched>\n<GSpherical:StitchingSoftware>j360 built-in</GSpherical:StitchingSoftware>\n<GSpherical:ProjectionType>equirectangular</GSpherical:ProjectionType>\n</rdf:SphericalVideo>`);
  const uuid = Buffer.from('ffcc8263f8554d02a9e59e4a505a9c9a','hex');
  const boxSize = Buffer.alloc(4);
  boxSize.writeUInt32BE(8 + uuid.length + xml.length);
  const box = Buffer.concat([boxSize, Buffer.from('uuid'), uuid, xml]);
  const newMoov = Buffer.concat([before, box]);
  newMoov.writeUInt32BE(size + box.length, moov - 4);
  const out = Buffer.concat([newMoov, after]);
  fs.writeFileSync(file, out);
}

module.exports = { injectMp4 };
