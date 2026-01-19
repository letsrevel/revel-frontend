<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { CropWindow, defaultValue, type CropValue, type Media } from 'svelte-crop-window';
	import { X, RotateCcw, RotateCw, Check, Loader2 } from 'lucide-svelte';
	import * as m from '$lib/paraglide/messages.js';

	/**
	 * ImageCropperModal Component
	 *
	 * A modal dialog for cropping and rotating images before upload.
	 * Supports HEIC/HEIF conversion for iPhone photos.
	 *
	 * @example
	 * ```svelte
	 * <ImageCropperModal
	 *   file={selectedFile}
	 *   aspectRatio={1}
	 *   shape="round"
	 *   onSave={(blob) => uploadImage(blob)}
	 *   onCancel={() => showModal = false}
	 * />
	 * ```
	 */
	interface Props {
		/** The image file to crop */
		file: File;
		/** Aspect ratio (width/height). Default 1 = square */
		aspectRatio?: number;
		/** Crop shape: 'rect' or 'round' */
		shape?: 'rect' | 'round';
		/** Output image quality (0-1). Default 0.9 */
		quality?: number;
		/** Output format. Default 'image/jpeg' */
		outputFormat?: 'image/jpeg' | 'image/png';
		/** Maximum output dimension (width or height). Default 1200 */
		maxOutputSize?: number;
		/** Callback when user saves the cropped image */
		onSave: (blob: Blob) => void;
		/** Callback when user cancels */
		onCancel: () => void;
	}

	let {
		file,
		aspectRatio = 1,
		shape = 'rect',
		quality = 0.9,
		outputFormat = 'image/jpeg',
		maxOutputSize = 1200,
		onSave,
		onCancel
	}: Props = $props();

	let isLoading = $state(true);
	let isProcessing = $state(false);
	let error = $state<string | null>(null);
	let imageUrl = $state<string | null>(null);
	let originalImage = $state<HTMLImageElement | null>(null);

	let cropValue = $state<CropValue>({ ...defaultValue, aspect: aspectRatio });

	// Media object for CropWindow
	const media = $derived<Media | null>(
		imageUrl
			? {
					content_type: 'image',
					url: imageUrl
				}
			: null
	);

	// Check if file is HEIC/HEIF
	function isHeicFile(file: File): boolean {
		const type = file.type.toLowerCase();
		const name = file.name.toLowerCase();
		return (
			type === 'image/heic' ||
			type === 'image/heif' ||
			name.endsWith('.heic') ||
			name.endsWith('.heif')
		);
	}

	// Convert HEIC to JPEG
	async function convertHeicToJpeg(file: File): Promise<Blob> {
		const heic2any = (await import('heic2any')).default;
		const result = await heic2any({
			blob: file,
			toType: 'image/jpeg',
			quality: 0.92
		});
		// heic2any can return array for multi-image HEIC, we take first
		return Array.isArray(result) ? result[0] : result;
	}

	// Load image and prepare for cropping
	async function loadImage() {
		isLoading = true;
		error = null;

		try {
			let imageBlob: Blob = file;

			// Convert HEIC if needed
			if (isHeicFile(file)) {
				imageBlob = await convertHeicToJpeg(file);
			}

			// Create object URL for display
			imageUrl = URL.createObjectURL(imageBlob);

			// Load image to get dimensions
			const img = new Image();
			img.src = imageUrl;
			await new Promise<void>((resolve, reject) => {
				img.onload = () => resolve();
				img.onerror = () => reject(new Error('Failed to load image'));
			});
			originalImage = img;
		} catch (err) {
			console.error('Failed to load image:', err);
			error = m['imageCropper.loadError']();
		} finally {
			isLoading = false;
		}
	}

	// Apply crop and rotation using canvas
	async function applyCrop(): Promise<Blob> {
		if (!originalImage || !imageUrl) {
			throw new Error('Image not loaded');
		}

		const img = originalImage;

		// Calculate output dimensions
		let outputWidth = maxOutputSize;
		let outputHeight = maxOutputSize / aspectRatio;

		if (outputHeight > maxOutputSize) {
			outputHeight = maxOutputSize;
			outputWidth = maxOutputSize * aspectRatio;
		}

		// Create canvas
		const canvas = document.createElement('canvas');
		canvas.width = outputWidth;
		canvas.height = outputHeight;
		const ctx = canvas.getContext('2d');
		if (!ctx) throw new Error('Could not get canvas context');

		// Calculate the scale factor: how much larger the image is compared to the crop window
		// cropValue.scale is relative to the crop window height
		const scaledImageHeight = cropValue.scale * outputHeight;
		const scaledImageWidth = (img.width / img.height) * scaledImageHeight;

		// Center of the canvas
		const centerX = outputWidth / 2;
		const centerY = outputHeight / 2;

		// Position offset (relative values multiplied by output height)
		const offsetX = cropValue.position.x * outputHeight;
		const offsetY = cropValue.position.y * outputHeight;

		// Clear canvas
		ctx.fillStyle = '#ffffff';
		ctx.fillRect(0, 0, outputWidth, outputHeight);

		// Apply transformations
		ctx.save();
		ctx.translate(centerX + offsetX, centerY + offsetY);
		ctx.rotate((cropValue.rotation * Math.PI) / 180);

		// Draw image centered
		ctx.drawImage(
			img,
			-scaledImageWidth / 2,
			-scaledImageHeight / 2,
			scaledImageWidth,
			scaledImageHeight
		);

		ctx.restore();

		// Apply circular mask if shape is round
		if (shape === 'round') {
			ctx.globalCompositeOperation = 'destination-in';
			ctx.beginPath();
			ctx.arc(centerX, centerY, Math.min(outputWidth, outputHeight) / 2, 0, Math.PI * 2);
			ctx.fill();
		}

		// Convert to blob
		return new Promise((resolve, reject) => {
			canvas.toBlob(
				(blob) => {
					if (blob) resolve(blob);
					else reject(new Error('Failed to create blob'));
				},
				outputFormat,
				quality
			);
		});
	}

	// Handle save button
	async function handleSave() {
		isProcessing = true;
		error = null;

		try {
			const blob = await applyCrop();
			onSave(blob);
		} catch (err) {
			console.error('Failed to crop image:', err);
			error = m['imageCropper.cropError']();
		} finally {
			isProcessing = false;
		}
	}

	// Rotate controls
	function rotateLeft() {
		cropValue.rotation = (cropValue.rotation - 90) % 360;
	}

	function rotateRight() {
		cropValue.rotation = (cropValue.rotation + 90) % 360;
	}

	// Reset crop
	function resetCrop() {
		cropValue = { ...defaultValue, aspect: aspectRatio };
	}

	// Load image on mount
	onMount(() => {
		loadImage();
	});

	// Cleanup on unmount
	onDestroy(() => {
		if (imageUrl) {
			URL.revokeObjectURL(imageUrl);
		}
	});
</script>

<!-- Modal backdrop -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
	role="dialog"
	aria-modal="true"
	aria-labelledby="cropper-title"
	tabindex="-1"
	onkeydown={(e) => e.key === 'Escape' && onCancel()}
>
	<!-- Modal content -->
	<div class="flex max-h-[90vh] w-full max-w-lg flex-col rounded-lg bg-background shadow-xl">
		<!-- Header -->
		<div class="flex items-center justify-between border-b px-4 py-3">
			<h2 id="cropper-title" class="text-lg font-semibold">
				{m['imageCropper.title']()}
			</h2>
			<button
				type="button"
				onclick={onCancel}
				class="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
				aria-label={m['imageCropper.cancel']()}
			>
				<X class="h-5 w-5" />
			</button>
		</div>

		<!-- Crop area -->
		<div class="relative flex-1 overflow-hidden">
			{#if isLoading}
				<div class="flex h-80 items-center justify-center">
					<Loader2 class="h-8 w-8 animate-spin text-muted-foreground" />
					<span class="ml-2 text-muted-foreground">{m['imageCropper.loading']()}</span>
				</div>
			{:else if error}
				<div class="flex h-80 flex-col items-center justify-center text-destructive">
					<p>{error}</p>
					<button
						type="button"
						onclick={onCancel}
						class="mt-4 rounded-md bg-muted px-4 py-2 text-sm"
					>
						{m['imageCropper.cancel']()}
					</button>
				</div>
			{:else if media}
				<div class="h-80">
					<CropWindow
						bind:value={cropValue}
						{media}
						options={{
							shape,
							crop_window_margin: 20,
							overlay_options: {
								overlay_color: '#000000',
								line_color: '#ffffff',
								show_third_lines: true
							}
						}}
					/>
				</div>
			{/if}
		</div>

		<!-- Controls -->
		{#if !isLoading && !error}
			<div class="flex items-center justify-center gap-4 border-t px-4 py-3">
				<button
					type="button"
					onclick={rotateLeft}
					class="rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
					aria-label={m['imageCropper.rotateLeft']()}
					title={m['imageCropper.rotateLeft']()}
				>
					<RotateCcw class="h-5 w-5" />
				</button>
				<button
					type="button"
					onclick={resetCrop}
					class="rounded-md px-3 py-1 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
				>
					{m['imageCropper.reset']()}
				</button>
				<button
					type="button"
					onclick={rotateRight}
					class="rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
					aria-label={m['imageCropper.rotateRight']()}
					title={m['imageCropper.rotateRight']()}
				>
					<RotateCw class="h-5 w-5" />
				</button>
			</div>
		{/if}

		<!-- Footer -->
		<div class="flex items-center justify-end gap-3 border-t px-4 py-3">
			<button
				type="button"
				onclick={onCancel}
				disabled={isProcessing}
				class="rounded-md border border-input bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground disabled:cursor-not-allowed disabled:opacity-50"
			>
				{m['imageCropper.cancel']()}
			</button>
			<button
				type="button"
				onclick={handleSave}
				disabled={isLoading || isProcessing || !!error}
				class="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
			>
				{#if isProcessing}
					<Loader2 class="h-4 w-4 animate-spin" />
					<span>{m['imageCropper.processing']()}</span>
				{:else}
					<Check class="h-4 w-4" />
					<span>{m['imageCropper.save']()}</span>
				{/if}
			</button>
		</div>
	</div>
</div>
