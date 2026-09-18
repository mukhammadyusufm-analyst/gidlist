/**
 * A phone photograph, made small enough to send over mobile data and to keep.
 *
 * Phones hand over 2–5 MB per picture. For evidence — "the fridge read 4°C",
 * "the floor was clean" — 1600 px on the long edge at JPEG quality 0.8 is still
 * sharp enough to read a thermometer or a label, at roughly a tenth of the size.
 * That tenth is paid three times over: the upload on a weak connection, the
 * copy held in the offline queue, and storage plus its nightly backup, which
 * only ever grow.
 *
 * Runs in the browser before anything leaves the phone, so it works offline
 * too. Anything that cannot be shrunk — a PDF, a format this browser cannot
 * decode (HEIC outside Safari), a picture that would come out larger — is
 * returned untouched, because a large photograph is still evidence and a
 * missing one is not.
 *
 * Re-encoding also drops the original's metadata, including the GPS position
 * phones embed. The app records where and when an item was ticked itself, so
 * nothing the record relies on is lost, and nothing about the phone's owner is
 * published with the picture.
 */

export const MAX_EDGE = 1600;
const QUALITY = 0.8;

/** Dimensions that fit inside `max` on the long edge, never enlarged. */
export function fitWithin(width: number, height: number, max = MAX_EDGE) {
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

export async function shrinkPhoto(file: File): Promise<File> {
  if (!file.type.startsWith('image/')) return file;

  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const { width, height } = fitWithin(bitmap.width, bitmap.height);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) return file;

    // JPEG has no transparency; a transparent PNG would otherwise turn black.
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, width, height);
    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', QUALITY),
    );
    if (!blob || blob.size >= file.size) return file;

    const name = `${file.name.replace(/\.[^.]*$/, '') || 'photo'}.jpg`;
    return new File([blob], name, { type: 'image/jpeg', lastModified: file.lastModified });
  } catch {
    return file;
  }
}
