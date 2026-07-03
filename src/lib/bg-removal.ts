// Client-side clothing image pipeline: AI background removal (runs fully
// in the browser via @imgly/background-removal) followed by canvas
// post-processing that trims the cutout and re-centers it on a uniform
// square, so every item in the closet renders at a consistent size.

export const OUTPUT_SIZE = 1024;
/** How much of the output square the item's longest edge occupies. */
const FILL = 0.82;
const ALPHA_THRESHOLD = 20;
/** Cutouts covering less of the frame than this are treated as failures. */
const MIN_COVERAGE = 0.004;

export class EmptyCutoutError extends Error {
  constructor() {
    super("No clothing item could be isolated from this photo.");
    this.name = "EmptyCutoutError";
  }
}

export type ProcessProgress = {
  stage: "model" | "processing";
  /** 0..1 when known, null while indeterminate. */
  value: number | null;
};

/**
 * Removes the background (people, hands, hangers, rooms — everything that
 * isn't the foreground subject), then trims + centers the item.
 * Throws EmptyCutoutError when segmentation finds nothing usable.
 */
export async function processClothingImage(
  file: Blob,
  onProgress?: (p: ProcessProgress) => void,
): Promise<Blob> {
  const { removeBackground } = await import("@imgly/background-removal");
  const cutout = await removeBackground(file, {
    output: { format: "image/png" },
    progress: (key, current, total) => {
      onProgress?.({
        stage: key.startsWith("fetch") ? "model" : "processing",
        value: total > 0 ? current / total : null,
      });
    },
  });
  onProgress?.({ stage: "processing", value: null });
  return normalizeCutout(cutout, { requireAlpha: true });
}

/** Trim transparent margins and center the item on a uniform square PNG. */
export async function normalizeCutout(
  source: Blob,
  opts: { requireAlpha?: boolean } = {},
): Promise<Blob> {
  const bitmap = await createImageBitmap(source);
  try {
    return await normalizeRegion(
      bitmap,
      { x: 0, y: 0, width: bitmap.width, height: bitmap.height },
      opts,
    );
  } finally {
    bitmap.close();
  }
}

export interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Manual-crop fallback: cut a region and normalize it the same way.
 * `rect` is relative — all values are fractions of the image size (0..1).
 */
export async function cropAndNormalize(
  source: Blob,
  rect: CropRect,
): Promise<Blob> {
  const bitmap = await createImageBitmap(source);
  try {
    return await normalizeRegion(
      bitmap,
      {
        x: rect.x * bitmap.width,
        y: rect.y * bitmap.height,
        width: rect.width * bitmap.width,
        height: rect.height * bitmap.height,
      },
      { requireAlpha: false },
    );
  } finally {
    bitmap.close();
  }
}

async function normalizeRegion(
  bitmap: ImageBitmap,
  rect: CropRect,
  { requireAlpha = false }: { requireAlpha?: boolean },
): Promise<Blob> {
  const sw = Math.max(1, Math.round(rect.width));
  const sh = Math.max(1, Math.round(rect.height));

  const temp = document.createElement("canvas");
  temp.width = sw;
  temp.height = sh;
  const tctx = temp.getContext("2d");
  if (!tctx) throw new Error("Canvas is not available");
  tctx.drawImage(bitmap, rect.x, rect.y, sw, sh, 0, 0, sw, sh);

  // bounding box of visible (non-transparent) pixels
  const data = tctx.getImageData(0, 0, sw, sh).data;
  let minX = sw,
    minY = sh,
    maxX = -1,
    maxY = -1;
  for (let y = 0; y < sh; y++) {
    for (let x = 0; x < sw; x++) {
      if (data[(y * sw + x) * 4 + 3] > ALPHA_THRESHOLD) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  let box: CropRect;
  if (maxX < 0) {
    if (requireAlpha) throw new EmptyCutoutError();
    box = { x: 0, y: 0, width: sw, height: sh };
  } else {
    box = { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
    if (requireAlpha && (box.width * box.height) / (sw * sh) < MIN_COVERAGE) {
      throw new EmptyCutoutError();
    }
  }

  const out = document.createElement("canvas");
  out.width = OUTPUT_SIZE;
  out.height = OUTPUT_SIZE;
  const octx = out.getContext("2d");
  if (!octx) throw new Error("Canvas is not available");
  octx.imageSmoothingEnabled = true;
  octx.imageSmoothingQuality = "high";

  const scale = (OUTPUT_SIZE * FILL) / Math.max(box.width, box.height);
  const dw = box.width * scale;
  const dh = box.height * scale;
  octx.drawImage(
    temp,
    box.x,
    box.y,
    box.width,
    box.height,
    (OUTPUT_SIZE - dw) / 2,
    (OUTPUT_SIZE - dh) / 2,
    dw,
    dh,
  );

  return new Promise<Blob>((resolve, reject) => {
    out.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new Error("Failed to encode PNG")),
      "image/png",
    );
  });
}
