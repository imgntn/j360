self.onmessage = async (e: MessageEvent) => {
  const { width, height, pixels, returnBuffer } = e.data as {
    width: number;
    height: number;
    pixels: ArrayBuffer;
    returnBuffer?: boolean;
  };
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    self.postMessage({ error: 'no-context' });
    return;
  }
  const imageData = new ImageData(new Uint8ClampedArray(pixels), width, height);
  ctx.putImageData(imageData, 0, 0);
  const blob = await canvas.convertToBlob({ type: 'image/jpeg' });
  if (returnBuffer) {
    const buffer = await blob.arrayBuffer();
    self.postMessage({ buffer }, [buffer]);
  } else {
    const url = URL.createObjectURL(blob);
    self.postMessage({ url });
  }
};
