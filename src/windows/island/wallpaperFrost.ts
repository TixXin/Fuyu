const SAMPLE_WIDTH = 64;

export type Frosted = { source: string; url: string; width: number; height: number; pixels: Uint8ClampedArray | null };

export function loadImage(source: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = source;
  });
}

function canvas(width: number, height: number) {
  return Object.assign(document.createElement("canvas"), { width, height });
}

function padded(image: HTMLImageElement, pad: number) {
  const width = image.naturalWidth;
  const height = image.naturalHeight;
  const out = canvas(width + pad * 2, height + pad * 2);
  const context = out.getContext("2d");
  if (!context) return out;
  const strips: [number, number, number, number, number, number, number, number][] = [
    [0, 0, width, 1, pad, 0, width, pad],
    [0, height - 1, width, 1, pad, height + pad, width, pad],
    [0, 0, 1, height, 0, pad, pad, height],
    [width - 1, 0, 1, height, width + pad, pad, pad, height],
    [0, 0, 1, 1, 0, 0, pad, pad],
    [width - 1, 0, 1, 1, width + pad, 0, pad, pad],
    [0, height - 1, 1, 1, 0, height + pad, pad, pad],
    [width - 1, height - 1, 1, 1, width + pad, height + pad, pad, pad],
  ];
  if (pad > 0) for (const strip of strips) context.drawImage(image, ...strip);
  context.drawImage(image, pad, pad);
  return out;
}

export function frostImage(image: HTMLImageElement, source: string, blur: number, saturation: number): Frosted {
  const width = image.naturalWidth;
  const height = image.naturalHeight;
  const pad = Math.ceil(blur * 2);
  const out = canvas(width, height);
  const context = out.getContext("2d");
  if (context) {
    context.filter = `blur(${blur}px) saturate(${saturation})`;
    context.drawImage(padded(image, pad), -pad, -pad);
  }
  const sampleHeight = Math.max(1, Math.round((height * SAMPLE_WIDTH) / Math.max(width, 1)));
  const sample = canvas(SAMPLE_WIDTH, sampleHeight);
  const sampleContext = sample.getContext("2d", { willReadFrequently: true });
  sampleContext?.drawImage(out, 0, 0, SAMPLE_WIDTH, sampleHeight);
  return {
    source,
    url: out.toDataURL("image/jpeg", 0.9),
    width: SAMPLE_WIDTH,
    height: sampleHeight,
    pixels: sampleContext ? sampleContext.getImageData(0, 0, SAMPLE_WIDTH, sampleHeight).data : null,
  };
}

const linear = (channel: number) => (channel / 255) ** 2.2;

export function regionLuminance(frosted: Frosted, box: { left: number; top: number; right: number; bottom: number }) {
  if (!frosted.pixels) return null;
  const x0 = Math.floor(box.left * frosted.width);
  const x1 = Math.min(frosted.width, Math.max(x0 + 1, Math.ceil(box.right * frosted.width)));
  const y0 = Math.floor(box.top * frosted.height);
  const y1 = Math.min(frosted.height, Math.max(y0 + 1, Math.ceil(box.bottom * frosted.height)));
  let total = 0;
  let count = 0;
  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      const index = (y * frosted.width + x) * 4;
      total += 0.2126 * linear(frosted.pixels[index]) + 0.7152 * linear(frosted.pixels[index + 1]) + 0.0722 * linear(frosted.pixels[index + 2]);
      count += 1;
    }
  }
  return count ? total / count : null;
}
