/** A crop rectangle in source-image pixel coordinates (svelte-easy-crop `pixels`). */
export interface CropPixels {
	x: number;
	y: number;
	width: number;
	height: number;
}

/** Canonical cover/banner aspect ratio — matches the backend's 1200x630 social card. */
export const COVER_ASPECT_RATIO = 1200 / 630;

/** Logos are square. */
export const LOGO_ASPECT_RATIO = 1;

/**
 * Output canvas size for a cropped image: preserve the crop's aspect ratio,
 * cap the longest side at `maxOutputSize`, never upscale, round to whole pixels.
 */
export function computeCropOutputSize(
	pixels: CropPixels,
	maxOutputSize: number
): { width: number; height: number } {
	const longest = Math.max(pixels.width, pixels.height);
	const scale = longest > maxOutputSize ? maxOutputSize / longest : 1;
	return {
		width: Math.round(pixels.width * scale),
		height: Math.round(pixels.height * scale)
	};
}
