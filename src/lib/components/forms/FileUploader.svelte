<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { cn } from '$lib/utils/cn';
	import { getImageUrl } from '$lib/utils';
	import { Upload, X, FileIcon, RefreshCw, AlertCircle, Loader2 } from 'lucide-svelte';
	import type { QuestionnaireFileSchema } from '$lib/api/generated';
	import { questionnairefileUploadFile, questionnairefileDeleteFile } from '$lib/api/generated';
	import { Button } from '$lib/components/ui/button';

	/**
	 * FileUploader Component
	 *
	 * Multi-file drag-and-drop uploader with immediate API upload.
	 * Files are uploaded to the user's questionnaire file library.
	 *
	 * @example
	 * ```svelte
	 * <FileUploader
	 *   uploadedFiles={files}
	 *   accept="application/pdf,image/*"
	 *   maxSize={5 * 1024 * 1024}
	 *   maxFiles={3}
	 *   onUploadComplete={(file) => files = [...files, file]}
	 *   onFileRemove={(id) => files = files.filter(f => f.id !== id)}
	 * />
	 * ```
	 */
	interface Props {
		/** Already uploaded files */
		uploadedFiles?: QuestionnaireFileSchema[];
		/** Unique identifier for the input */
		id?: string;
		/** Label text displayed above the uploader */
		label?: string;
		/** Accepted MIME types (comma-separated) */
		accept?: string;
		/** Maximum file size in bytes (default: 5MB) */
		maxSize?: number;
		/** Maximum number of files (default: 1) */
		maxFiles?: number;
		/** Whether the field is required */
		required?: boolean;
		/** Whether the field is disabled */
		disabled?: boolean;
		/** Error message to display */
		error?: string;
		/** Additional CSS classes */
		class?: string;
		/** Callback fired when a file is successfully uploaded */
		onUploadComplete?: (file: QuestionnaireFileSchema) => void;
		/** Callback fired when a file is removed */
		onFileRemove?: (fileId: string) => void;
		/** Callback fired when an upload fails */
		onUploadError?: (file: File, error: string) => void;
	}

	let {
		uploadedFiles = [],
		id,
		label,
		accept = '*/*',
		maxSize = 10 * 1024 * 1024, // 10MB default
		maxFiles = 1,
		required = false,
		disabled = false,
		error,
		class: className,
		onUploadComplete,
		onFileRemove,
		onUploadError
	}: Props = $props();

	// Generate unique ID if not provided
	const inputId = $derived(id || `file-${Math.random().toString(36).substr(2, 9)}`);

	// Drag state
	let isDragging = $state(false);

	// Pending uploads: files currently being uploaded
	interface PendingUpload {
		file: File;
		progress: number; // 0-100 or -1 for error
		error?: string;
		abortController?: AbortController;
	}
	let pendingUploads = $state<PendingUpload[]>([]);

	// File input reference
	let fileInput: HTMLInputElement;

	// Check if we can add more files
	const canAddMore = $derived(
		(uploadedFiles?.length || 0) + pendingUploads.length < maxFiles && !disabled
	);

	// Format file size for display
	function formatFileSize(bytes: number): string {
		if (bytes === 0) return '0 B';
		const k = 1024;
		const sizes = ['B', 'KB', 'MB', 'GB'];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
	}

	// Format accepted MIME types for display
	function formatAcceptedTypes(acceptStr: string): string {
		if (acceptStr === '*/*') return m['fileUploader.allFiles']?.() || 'All files';
		return acceptStr
			.split(',')
			.map((type) => {
				const trimmed = type.trim();
				if (trimmed.endsWith('/*')) {
					return trimmed.split('/')[0].charAt(0).toUpperCase() + trimmed.split('/')[0].slice(1);
				}
				const ext = trimmed.split('/')[1];
				return ext ? ext.toUpperCase() : trimmed;
			})
			.join(', ');
	}

	// Validate file
	function validateFile(file: File): string | null {
		// Check file type
		if (accept !== '*/*') {
			const acceptedTypes = accept.split(',').map((type) => type.trim());
			const isValid = acceptedTypes.some((type) => {
				if (type.endsWith('/*')) {
					const prefix = type.slice(0, -2);
					return file.type.startsWith(prefix);
				}
				return file.type === type;
			});

			if (!isValid) {
				return (
					m['fileUploader.error_invalidFileType']?.({ accept: formatAcceptedTypes(accept) }) ||
					`Invalid file type. Allowed: ${formatAcceptedTypes(accept)}`
				);
			}
		}

		// Check file size
		if (maxSize && file.size > maxSize) {
			return (
				m['fileUploader.error_fileTooLarge']?.({ maxSize: formatFileSize(maxSize) }) ||
				`File too large. Max: ${formatFileSize(maxSize)}`
			);
		}

		return null;
	}

	// Upload a single file
	async function uploadFile(file: File): Promise<void> {
		const validationError = validateFile(file);
		if (validationError) {
			onUploadError?.(file, validationError);
			return;
		}

		// Check if we can add more files
		if ((uploadedFiles?.length || 0) + pendingUploads.length >= maxFiles) {
			const errorMsg =
				m['fileUploader.error_tooManyFiles']?.({ maxFiles }) || `Maximum ${maxFiles} files allowed`;
			onUploadError?.(file, errorMsg);
			return;
		}

		// Add to pending uploads
		const abortController = new AbortController();
		const pending: PendingUpload = {
			file,
			progress: 0,
			abortController
		};
		pendingUploads = [...pendingUploads, pending];

		try {
			// Set progress to indeterminate (we don't have real progress events)
			pending.progress = 50;
			pendingUploads = [...pendingUploads];

			// Upload the file
			const response = await questionnairefileUploadFile({
				body: { file }
			});

			if (response.data) {
				// Success - remove from pending and notify
				pendingUploads = pendingUploads.filter((p) => p.file !== file);
				onUploadComplete?.(response.data);
			} else {
				throw new Error('Upload failed');
			}
		} catch (err) {
			// Update pending with error
			const errorMsg = err instanceof Error ? err.message : 'Upload failed';
			pendingUploads = pendingUploads.map((p) =>
				p.file === file ? { ...p, progress: -1, error: errorMsg } : p
			);
			onUploadError?.(file, errorMsg);
		}
	}

	// Handle file selection
	function handleFiles(files: FileList | File[]): void {
		const fileArray = Array.from(files);
		const available = maxFiles - (uploadedFiles?.length || 0) - pendingUploads.length;

		if (fileArray.length > available) {
			const errorMsg =
				m['fileUploader.error_tooManyFiles']?.({ maxFiles }) || `Maximum ${maxFiles} files allowed`;
			// Still upload what we can
			fileArray.slice(0, available).forEach(uploadFile);
			if (fileArray.length > available) {
				onUploadError?.(fileArray[available], errorMsg);
			}
		} else {
			fileArray.forEach(uploadFile);
		}
	}

	// Handle input change
	function handleInputChange(event: Event): void {
		const target = event.target as HTMLInputElement;
		if (target.files && target.files.length > 0) {
			handleFiles(target.files);
			// Reset input so same file can be selected again
			target.value = '';
		}
	}

	// Handle drag events
	function handleDragEnter(event: DragEvent): void {
		event.preventDefault();
		if (!disabled && canAddMore) {
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

		if (disabled || !canAddMore) return;

		const files = event.dataTransfer?.files;
		if (files && files.length > 0) {
			handleFiles(files);
		}
	}

	// Remove an uploaded file
	async function removeUploadedFile(fileId: string): Promise<void> {
		try {
			await questionnairefileDeleteFile({ path: { file_id: fileId } });
			onFileRemove?.(fileId);
		} catch {
			// Still remove from UI even if API fails (file might already be deleted)
			onFileRemove?.(fileId);
		}
	}

	// Remove a pending upload (cancel)
	function removePendingUpload(file: File): void {
		const pending = pendingUploads.find((p) => p.file === file);
		if (pending?.abortController) {
			pending.abortController.abort();
		}
		pendingUploads = pendingUploads.filter((p) => p.file !== file);
	}

	// Retry a failed upload
	function retryUpload(file: File): void {
		pendingUploads = pendingUploads.filter((p) => p.file !== file);
		uploadFile(file);
	}

	// Open file browser
	function openFileBrowser(): void {
		if (!disabled && canAddMore) {
			fileInput?.click();
		}
	}

	// Handle keyboard interaction
	function handleKeydown(event: KeyboardEvent): void {
		if ((event.key === 'Enter' || event.key === ' ') && canAddMore) {
			event.preventDefault();
			openFileBrowser();
		}
	}

	// Check if file is an image
	function isImage(mimeType: string): boolean {
		return mimeType.startsWith('image/');
	}

	// Get file icon based on MIME type
	function getFileTypeLabel(mimeType: string): string {
		if (mimeType.startsWith('image/')) return 'Image';
		if (mimeType.startsWith('video/')) return 'Video';
		if (mimeType.startsWith('audio/')) return 'Audio';
		if (mimeType === 'application/pdf') return 'PDF';
		if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return 'Excel';
		if (mimeType.includes('word') || mimeType.includes('document')) return 'Word';
		if (mimeType.includes('zip') || mimeType.includes('archive')) return 'Archive';
		return 'File';
	}
</script>

<div class={cn('space-y-3', className)}>
	{#if label}
		<label for={inputId} class="block text-sm font-medium text-gray-900 dark:text-gray-100">
			{label}
			{#if required}
				<span class="text-destructive" aria-label={m['fileUploader.required']?.() || 'required'}
					>*</span
				>
			{/if}
		</label>
	{/if}

	<!-- File Grid -->
	{#if (uploadedFiles && uploadedFiles.length > 0) || pendingUploads.length > 0}
		<div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
			<!-- Uploaded files -->
			{#each uploadedFiles || [] as file (file.id)}
				<div class="relative flex items-center gap-3 rounded-lg border bg-card p-3">
					{#if isImage(file.mime_type) && file.file_url}
						<img
							src={getImageUrl(file.file_url)}
							alt={file.original_filename}
							class="h-12 w-12 rounded object-cover"
						/>
					{:else}
						<div class="flex h-12 w-12 items-center justify-center rounded bg-muted">
							<FileIcon class="h-6 w-6 text-muted-foreground" />
						</div>
					{/if}
					<div class="min-w-0 flex-1">
						<p class="truncate text-sm font-medium">{file.original_filename}</p>
						<p class="text-xs text-muted-foreground">
							{getFileTypeLabel(file.mime_type)} - {formatFileSize(file.file_size)}
						</p>
					</div>
					{#if !disabled}
						<Button
							variant="ghost"
							size="icon"
							class="h-8 w-8 shrink-0"
							onclick={() => removeUploadedFile(file.id)}
							aria-label={m['fileUploader.removeFile']?.() || 'Remove file'}
						>
							<X class="h-4 w-4" />
						</Button>
					{/if}
				</div>
			{/each}

			<!-- Pending uploads -->
			{#each pendingUploads as pending (pending.file.name + pending.file.lastModified)}
				<div class="relative flex items-center gap-3 rounded-lg border bg-card p-3">
					<div class="flex h-12 w-12 items-center justify-center rounded bg-muted">
						{#if pending.progress === -1}
							<AlertCircle class="h-6 w-6 text-destructive" />
						{:else}
							<Loader2 class="h-6 w-6 animate-spin text-primary" />
						{/if}
					</div>
					<div class="min-w-0 flex-1">
						<p class="truncate text-sm font-medium">{pending.file.name}</p>
						{#if pending.progress === -1}
							<p class="text-xs text-destructive">{pending.error || 'Upload failed'}</p>
						{:else}
							<p class="text-xs text-muted-foreground">
								{m['fileUploader.uploading']?.() || 'Uploading...'}
							</p>
						{/if}
					</div>
					{#if pending.progress === -1}
						<Button
							variant="ghost"
							size="icon"
							class="h-8 w-8 shrink-0"
							onclick={() => retryUpload(pending.file)}
							aria-label={m['fileUploader.retryUpload']?.() || 'Retry upload'}
						>
							<RefreshCw class="h-4 w-4" />
						</Button>
					{/if}
					<Button
						variant="ghost"
						size="icon"
						class="h-8 w-8 shrink-0"
						onclick={() => removePendingUpload(pending.file)}
						aria-label={m['fileUploader.removeFile']?.() || 'Remove file'}
					>
						<X class="h-4 w-4" />
					</Button>
				</div>
			{/each}
		</div>
	{/if}

	<!-- Drop Zone (only show if can add more) -->
	{#if canAddMore}
		<div
			role="button"
			tabindex={disabled ? -1 : 0}
			onclick={openFileBrowser}
			onkeydown={handleKeydown}
			ondragenter={handleDragEnter}
			ondragleave={handleDragLeave}
			ondragover={handleDragOver}
			ondrop={handleDrop}
			aria-label={m['fileUploader.uploadFile']?.() || 'Upload file'}
			aria-describedby={error ? `${inputId}-error` : `${inputId}-hint`}
			class={cn(
				'flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 transition-all',
				'hover:border-primary hover:bg-gray-50 dark:hover:bg-gray-800/50',
				'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2',
				isDragging && 'border-primary bg-primary/5',
				error ? 'border-destructive' : 'border-gray-300 dark:border-gray-600',
				disabled && 'cursor-not-allowed opacity-50 hover:border-gray-300 hover:bg-transparent'
			)}
		>
			<Upload
				class={cn('mb-2 h-8 w-8', isDragging ? 'text-primary' : 'text-muted-foreground')}
				aria-hidden="true"
			/>

			<p class="mb-1 text-sm font-medium text-gray-900 dark:text-gray-100">
				{#if isDragging}
					{m['fileUploader.dropFilesHere']?.() || 'Drop files here'}
				{:else}
					{m['fileUploader.clickToUpload']?.() || 'Click to upload or drag and drop'}
				{/if}
			</p>

			<p id="{inputId}-hint" class="text-center text-xs text-muted-foreground">
				{formatAcceptedTypes(accept)}
				{#if maxSize}
					- {m['fileUploader.upTo']?.({ maxSize: formatFileSize(maxSize) }) ||
						`up to ${formatFileSize(maxSize)}`}
				{/if}
				{#if maxFiles > 1}
					<br />
					{m['fileUploader.maxFiles']?.({ count: maxFiles }) || `Maximum ${maxFiles} files`}
				{/if}
			</p>
		</div>
	{/if}

	<!-- Hidden file input -->
	<input
		bind:this={fileInput}
		type="file"
		id={inputId}
		name={inputId}
		{accept}
		multiple={maxFiles > 1}
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
