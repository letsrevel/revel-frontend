<script lang="ts">
	import { cn } from '$lib/utils/cn';
	import { Upload, X, Image as ImageIcon } from 'lucide-svelte';

	/**
	 * ImageUploader Component
	 *
	 * Drag-and-drop image uploader with preview and validation.
	 * Supports click-to-browse and mobile camera access.
	 *
	 * @example
	 * ```svelte
	 * <ImageUploader
	 *   bind:value={eventImage}
	 *   label="Event Banner"
	 *   maxSize={5 * 1024 * 1024}
	 *   error={errors.image}
	 * />
	 * ```
	 */
	interface Props {
		/** Selected file */
		value?: File | null;
		/** URL for preview (existing image) */
		preview?: string | null;
		/** Unique identifier for the input */
		id?: string;
		/** Label text displayed above the uploader */
		label?: string;
		/** Accepted file types */
		accept?: string;
		/** Maximum file size in bytes */
		maxSize?: number;
		/** Whether the field is required */
		required?: boolean;
		/** Whether the field is disabled */
		disabled?: boolean;
		/** Error message to display */
		error?: string;
		/** Additional CSS classes */
		class?: string;
		/** Aspect ratio for preview: 'square' or 'wide' (default: 'wide') */
		aspectRatio?: 'square' | 'wide';
		/** Callback fired when file is selected */
		onFileSelect?: (file: File | null) => void;
	}

	let {
		value = $bindable(null),
		preview = null,
		id,
		label,
		accept = 'image/jpeg,image/png,image/webp',
		maxSize = 5 * 1024 * 1024, // 5MB default
		required = false,
		disabled = false,
		error,
		class: className,
		aspectRatio = 'wide',
		onFileSelect
	}: Props = $props();

	// Generate unique ID if not provided
	const inputId = $derived(id || `image-${Math.random().toString(36).substr(2, 9)}`);

	// Drag state
	let isDragging = $state(false);

	// Preview URL state (from selected file or existing preview)
	let previewUrl = $state<string | null>(preview);

	// File input reference
	let fileInput: HTMLInputElement;

	// Sync preview URL with prop
	$effect(() => {
		if (preview && !value) {
			previewUrl = preview;
		}
	});

	// Format file size for display
	function formatFileSize(bytes: number): string {
		if (bytes === 0) return '0 Bytes';
		const k = 1024;
		const sizes = ['Bytes', 'KB', 'MB'];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
	}

	// Validate file
	function validateFile(file: File): string | null {
		// Check file type
		const acceptedTypes = accept.split(',').map((type) => type.trim());
		const isValid = acceptedTypes.some((type) => {
			if (type.endsWith('/*')) {
				// Handle wildcard types like "image/*"
				const prefix = type.slice(0, -2);
				return file.type.startsWith(prefix);
			}
			// Handle specific types like "image/png"
			return file.type === type;
		});

		if (!isValid) {
			return `Please select a valid image file (${accept})`;
		}

		// Check file size
		if (maxSize && file.size > maxSize) {
			return `File size must be less than ${formatFileSize(maxSize)}`;
		}

		return null;
	}

	// Handle file selection
	function handleFileSelect(file: File | null): void {
		if (!file) {
			value = null;
			previewUrl = preview;
			onFileSelect?.(null);
			return;
		}

		// Validate file
		const validationError = validateFile(file);
		if (validationError) {
			error = validationError;
			return;
		}

		value = file;
		onFileSelect?.(file);

		// Generate preview URL
		const reader = new FileReader();
		reader.onloadend = () => {
			previewUrl = reader.result as string;
		};
		reader.readAsDataURL(file);
	}

	// Handle input change
	function handleInputChange(event: Event): void {
		const target = event.target as HTMLInputElement;
		const file = target.files?.[0] || null;
		handleFileSelect(file);
	}

	// Handle drag events
	function handleDragEnter(event: DragEvent): void {
		event.preventDefault();
		if (!disabled) {
			isDragging = true;
		}
	}

	function handleDragLeave(event: DragEvent): void {
		event.preventDefault();
		isDragging = false;
	}

	function handleDragOver(event: DragEvent): void {
		event.preventDefault();
	}

	function handleDrop(event: DragEvent): void {
		event.preventDefault();
		isDragging = false;

		if (disabled) return;

		const file = event.dataTransfer?.files?.[0] || null;
		handleFileSelect(file);
	}

	// Remove selected image
	function removeImage(): void {
		value = null;
		previewUrl = preview;
		if (fileInput) {
			fileInput.value = '';
		}
		onFileSelect?.(null);
	}

	// Open file browser
	function openFileBrowser(): void {
		if (!disabled) {
			fileInput?.click();
		}
	}

	// Handle keyboard interaction
	function handleKeydown(event: KeyboardEvent): void {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			openFileBrowser();
		}
	}
</script>

<div class={cn('space-y-2', className)}>
	{#if label}
		<label for={inputId} class="block text-sm font-medium text-gray-900 dark:text-gray-100">
			{label}
			{#if required}
				<span class="text-destructive" aria-label="required">*</span>
			{/if}
		</label>
	{/if}

	{#if previewUrl}
		<!-- Image Preview -->
		<div
			class="relative mx-auto overflow-hidden rounded-lg border-2 border-gray-300 dark:border-gray-600"
			class:aspect-square={aspectRatio === 'square'}
			class:max-w-xs={aspectRatio === 'square'}
			class:max-w-2xl={aspectRatio === 'wide'}
		>
			<img
				src={previewUrl}
				alt="Preview"
				class="h-full w-full object-cover"
				class:h-48={aspectRatio === 'wide'}
			/>

			{#if !disabled}
				<button
					type="button"
					onclick={removeImage}
					class="absolute right-2 top-2 rounded-full bg-destructive p-2 text-white shadow-lg transition-colors hover:bg-destructive/90 focus:outline-none focus:ring-2 focus:ring-destructive focus:ring-offset-2"
					aria-label="Remove image"
				>
					<X class="h-4 w-4" aria-hidden="true" />
				</button>
			{/if}

			{#if value}
				<div class="absolute bottom-0 left-0 right-0 bg-black/70 p-2 text-xs text-white">
					<p class="truncate">{value.name}</p>
					<p class="text-gray-300">{formatFileSize(value.size)}</p>
				</div>
			{/if}
		</div>
	{:else}
		<!-- Upload Area -->
		<div
			role="button"
			tabindex={disabled ? -1 : 0}
			onclick={openFileBrowser}
			onkeydown={handleKeydown}
			ondragenter={handleDragEnter}
			ondragleave={handleDragLeave}
			ondragover={handleDragOver}
			ondrop={handleDrop}
			aria-label="Upload image"
			aria-describedby={error ? `${inputId}-error` : `${inputId}-hint`}
			class={cn(
				'flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-all',
				'hover:border-primary hover:bg-gray-50 dark:hover:bg-gray-800/50',
				'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2',
				isDragging && 'border-primary bg-primary/5',
				error ? 'border-destructive' : 'border-gray-300 dark:border-gray-600',
				disabled && 'cursor-not-allowed opacity-50 hover:border-gray-300 hover:bg-transparent'
			)}
		>
			<Upload
				class={cn('mb-4 h-12 w-12', isDragging ? 'text-primary' : 'text-muted-foreground')}
				aria-hidden="true"
			/>

			<p class="mb-1 text-sm font-medium text-gray-900 dark:text-gray-100">
				{#if isDragging}
					Drop image here
				{:else}
					Click to upload or drag and drop
				{/if}
			</p>

			<p id="{inputId}-hint" class="text-xs text-muted-foreground">
				{accept
					.split(',')
					.map((type) => type.split('/')[1].toUpperCase())
					.join(', ')} up to {formatFileSize(maxSize)}
			</p>
		</div>
	{/if}

	<!-- Hidden file input -->
	<input
		bind:this={fileInput}
		type="file"
		{id}
		name={inputId}
		{accept}
		{required}
		{disabled}
		onchange={handleInputChange}
		aria-invalid={!!error}
		class="sr-only"
	/>

	{#if error}
		<p id="{inputId}-error" class="text-sm text-destructive" role="alert">
			{error}
		</p>
	{/if}
</div>
