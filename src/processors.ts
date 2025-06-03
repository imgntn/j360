export async function grayscale(frame: Uint8Array): Promise<Uint8Array> {
  const blob = new Blob([frame], { type: 'image/jpeg' });
  const bitmap = await createImageBitmap(blob);
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const ctx = canvas.getContext('2d');
  if (!ctx) return frame;
  ctx.drawImage(bitmap, 0, 0);
  const img = ctx.getImageData(0, 0, bitmap.width, bitmap.height);
  for (let i = 0; i < img.data.length; i += 4) {
    const avg = (img.data[i] + img.data[i + 1] + img.data[i + 2]) / 3;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = avg;
  }
  ctx.putImageData(img, 0, 0);
  const out = await canvas.convertToBlob({ type: 'image/jpeg' });
  const buf = await out.arrayBuffer();
  return new Uint8Array(buf);
}
