const rgbToHex = (r, g, b) =>
  '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');

const colorDistance = (c1, c2) =>
  Math.sqrt(
    (c1[0] - c2[0]) ** 2 +
    (c1[1] - c2[1]) ** 2 +
    (c1[2] - c2[2]) ** 2
  );

const isNearWhite = (r, g, b) => r > 230 && g > 230 && b > 230;
const isNearBlack = (r, g, b) => r < 30 && g < 30 && b < 30;
const isGray = (r, g, b) => {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return (max - min) < 30;
};

const quantize = (pixels, steps = 4) => {
  const buckets = {};
  const step = 256 / steps;
  pixels.forEach(([r, g, b]) => {
    const key = `${Math.floor(r / step)}_${Math.floor(g / step)}_${Math.floor(b / step)}`;
    buckets[key] = (buckets[key] || 0) + 1;
  });
  return Object.entries(buckets)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([key]) => {
      const parts = key.split('_').map(Number);
      return [
        Math.round(parts[0] * step + step / 2),
        Math.round(parts[1] * step + step / 2),
        Math.round(parts[2] * step + step / 2),
      ];
    });
};

const getLuminance = (r, g, b) => {
  const rs = r / 255, gs = g / 255, bs = b / 255;
  return 0.2126 * (rs <= 0.03928 ? rs / 12.92 : ((rs + 0.055) / 1.055) ** 2.4) +
    0.7152 * (gs <= 0.03928 ? gs / 12.92 : ((gs + 0.055) / 1.055) ** 2.4) +
    0.0722 * (bs <= 0.03928 ? bs / 12.92 : ((bs + 0.055) / 1.055) ** 2.4);
};

const scoreColor = (r, g, b) => {
  if (isNearWhite(r, g, b) || isNearBlack(r, g, b) || isGray(r, g, b)) return -1;
  const lum = getLuminance(r, g, b);
  const sat = Math.max(r, g, b) - Math.min(r, g, b);
  return sat * (1 - Math.abs(lum - 0.5) * 2);
};

export const extractColors = (imageDataUrl) => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const size = 80;
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, size, size);

      const imageData = ctx.getImageData(0, 0, size, size).data;
      const pixels = [];
      for (let i = 0; i < imageData.length; i += 16) {
        const r = imageData[i];
        const g = imageData[i + 1];
        const b = imageData[i + 2];
        const a = imageData[i + 3];
        if (a < 200) continue;
        const score = scoreColor(r, g, b);
        if (score > 0) pixels.push({ r, g, b, score });
      }

      if (pixels.length === 0) {
        resolve({ primary: '#4F46E5', accent: '#8B5CF6', secondary: '#10B981', background: '#F8FAFC' });
        return;
      }

      pixels.sort((a, b) => b.score - a.score);
      const topPixels = pixels.slice(0, Math.min(200, pixels.length)).map(p => [p.r, p.g, p.b]);
      const palette = quantize(topPixels, 6);

      let best = palette[0] || [79, 70, 229];
      let bestScore = -1;
      palette.forEach(([r, g, b]) => {
        const s = scoreColor(r, g, b);
        if (s > bestScore) { bestScore = s; best = [r, g, b]; }
      });

      const primary = rgbToHex(...best);
      const accent = palette[1] ? rgbToHex(...palette[1]) : '#8B5CF6';
      const secondary = palette[2] ? rgbToHex(...palette[2]) : '#10B981';
      const bg = rgbToHex(
        Math.min(255, best[0] + 180),
        Math.min(255, best[1] + 180),
        Math.min(255, best[2] + 180)
      );

      resolve({ primary, accent, secondary, background: bg });
    };
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = imageDataUrl;
  });
};
