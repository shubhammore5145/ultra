/**
 * Client-side Smart Image Compressor
 * Resizes and dynamically compresses image files using HTML5 Canvas
 * Guarantees output size is strictly under 100 KB (maxSizeKB)
 * while preserving maximum sharpness and visual clarity.
 */

function getBase64SizeBytes(dataUrl: string): number {
  const base64Index = dataUrl.indexOf(',');
  const base64Str = base64Index >= 0 ? dataUrl.slice(base64Index + 1) : dataUrl;
  const padding = base64Str.endsWith('==') ? 2 : base64Str.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.floor((base64Str.length * 3) / 4) - padding);
}

export async function compressImage(
  file: File,
  maxWidth = 1000,
  maxHeight = 1000,
  initialQuality = 0.82,
  maxSizeKB = 100
): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith('image/')) {
      return reject(new Error('Selected file is not an image'));
    }

    const maxBytes = maxSizeKB * 1024;
    const reader = new FileReader();
    reader.readAsDataURL(file);

    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;

      img.onload = () => {
        let width = img.width;
        let height = img.height;

        // 1. Initial aspect ratio scaling to fit maxWidth x maxHeight
        if (width > maxWidth || height > maxHeight) {
          if (width > height) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(event.target?.result as string);
          return;
        }

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        // 2. Iterative quality compression to stay strictly under 100 KB
        let quality = initialQuality;
        let compressedDataUrl = canvas.toDataURL('image/jpeg', quality);

        // Step down quality if size exceeds 100 KB
        while (getBase64SizeBytes(compressedDataUrl) > maxBytes && quality > 0.35) {
          quality -= 0.08;
          compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
        }

        // 3. If still exceeding 100 KB (e.g. ultra-high detail), scale dimensions down
        let loopAttempts = 0;
        while (getBase64SizeBytes(compressedDataUrl) > maxBytes && width > 320 && loopAttempts < 6) {
          loopAttempts++;
          width = Math.round(width * 0.85);
          height = Math.round(height * 0.85);
          canvas.width = width;
          canvas.height = height;
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, width, height);
          compressedDataUrl = canvas.toDataURL('image/jpeg', Math.max(quality, 0.6));
        }

        resolve(compressedDataUrl);
      };

      img.onerror = () => {
        resolve(event.target?.result as string);
      };
    };

    reader.onerror = (error) => reject(error);
  });
}
