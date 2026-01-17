<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { cn } from '$lib/utils/cn';
	import { getImageUrl } from '$lib/utils';
	import { Upload, X, FileIcon, Loader2, Clock, ChevronDown, ChevronUp } from 'lucide-svelte';
	import type { QuestionnaireFileSchema } from '$lib/api/generated';
	import { questionnairefileUploadFile, questionnairefileListFiles } from '$lib/api/generated';
	import { Button } from '$lib/components/ui/button';
	import { createQuery } from '@tanstack/svelte-query';

	/**
	 * FileUploadQuestion Component
	 *
	 * A file upload component for questionnaire submissions that supports:
	 * - Uploading new files
	 * - Selecting from recently uploaded files
	 */
	interface Props {
		/** Unique question identifier */
		questionId: string;
		/** Already selected files for this question */
		selectedFiles?: QuestionnaireFileSchema[];
		/** Accepted MIME types (comma-separated) */
		accept?: string;
		/** Maximum file size in bytes */
		maxSize?: number;
		/** Maximum number of files */
		maxFiles?: number;
		/** Whether the field is required */
		required?: boolean;
		/** Whether the field is disabled */
		disabled?: boolean;
		/** Error message to display */
		error?: string;
		/** Callback when files change */
		onFilesChange?: (files: QuestionnaireFileSchema[]) => void;
	}

	let {
		questionId,
		selectedFiles = [],
		accept = '*/*',
		maxSize = 10 * 1024 * 1024,
		maxFiles = 1,
		required = false,
		disabled = false,
		error,
		onFilesChange
	}: Props = $props();

	// Generate unique ID
	const inputId = $derived(`file-upload-${questionId}`);

	// Drag state
	let isDragging = $state(false);

	// Pending uploads
	interface PendingUpload {
		file: File;
		progress: number;
		error?: string;
	}
	let pendingUploads = $state<PendingUpload[]>([]);

	// Upload error message (for validation errors)
	let uploadError = $state<string | null>(null);

	// File input reference
	let fileInput: HTMLInputElement;

	// Recent files panel state
	let showRecentFiles = $state(false);

	// Query for recent files
	const recentFilesQuery = createQuery(() => ({
		queryKey: ['questionnaire-files', 'recent'],
		queryFn: async () => {
			const response = await questionnairefileListFiles({
				query: { page: 1, page_size: 20 }
			});
			return response.data?.results || [];
		},
		staleTime: 30 * 1000, // Cache for 30 seconds
		enabled: showRecentFiles // Only fetch when panel is open
	}));

	// Check if we can add more files
	const canAddMore = $derived(selectedFiles.length + pendingUploads.length < maxFiles && !disabled);

	// Format file size
	function formatFileSize(bytes: number): string {
		if (bytes === 0) return '0 B';
		const k = 1024;
		const sizes = ['B', 'KB', 'MB', 'GB'];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
	}

	// Format accepted MIME types for display
	function formatAcceptedTypes(acceptStr: string): string {
		if (acceptStr === '*/*') return 'All files';
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
		if (accept !== '*/*') {
			const acceptedTypes = accept.split(',').map((type) => type.trim());
			const isValid = acceptedTypes.some((type) => {
				if (type.endsWith('/*')) {
					return file.type.startsWith(type.slice(0, -2));
				}
				return file.type === type;
			});
			if (!isValid) {
				return `Invalid file type. Allowed: ${formatAcceptedTypes(accept)}`;
			}
		}
		if (maxSize && file.size > maxSize) {
			return `File too large. Max: ${formatFileSize(maxSize)}`;
		}
		return null;
	}

	// Upload a single file
	async function uploadFile(file: File): Promise<void> {
		// Clear previous error
		uploadError = null;

		const validationError = validateFile(file);
		if (validationError) {
			uploadError = validationError;
			return;
		}

		if (selectedFiles.length + pendingUploads.length >= maxFiles) {
			uploadError = `Maximum ${maxFiles} file${maxFiles > 1 ? 's' : ''} allowed`;
			return;
		}

		// Add to pending
		const pending: PendingUpload = { file, progress: 0 };
		pendingUploads = [...pendingUploads, pending];

		try {
			pending.progress = 50;
			pendingUploads = [...pendingUploads];

			const response = await questionnairefileUploadFile({
				body: { file }
			});

			if (response.data) {
				pendingUploads = pendingUploads.filter((p) => p.file !== file);
				onFilesChange?.([...selectedFiles, response.data]);
			} else {
				throw new Error('Upload failed');
			}
		} catch (err) {
			const errorMsg = err instanceof Error ? err.message : 'Upload failed';
			uploadError = errorMsg;
			pendingUploads = pendingUploads.filter((p) => p.file !== file);
		}
	}

	// Handle file selection
	function handleFiles(files: FileList | File[]): void {
		const fileArray = Array.from(files);
		const available = maxFiles - selectedFiles.length - pendingUploads.length;
		const filesToUpload = fileArray.slice(0, available);
		filesToUpload.forEach(uploadFile);
	}

	// Handle input change
	function handleInputChange(event: Event): void {
		const target = event.target as HTMLInputElement;
		if (target.files && target.files.length > 0) {
			handleFiles(target.files);
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

	// Remove a selected file
	function removeFile(fileId: string): void {
		onFilesChange?.(selectedFiles.filter((f) => f.id !== fileId));
	}

	// Remove a pending upload
	function removePendingUpload(file: File): void {
		pendingUploads = pendingUploads.filter((p) => p.file !== file);
	}

	// Select a recent file
	function selectRecentFile(file: QuestionnaireFileSchema): void {
		// Check if already selected
		if (selectedFiles.some((f) => f.id === file.id)) {
			return;
		}
		if (selectedFiles.length >= maxFiles) {
			return;
		}
		// Validate file type
		if (accept !== '*/*') {
			const acceptedTypes = accept.split(',').map((type) => type.trim());
			const isValid = acceptedTypes.some((type) => {
				if (type.endsWith('/*')) {
					return file.mime_type.startsWith(type.slice(0, -2));
				}
				return file.mime_type === type;
			});
			if (!isValid) {
				return;
			}
		}
		onFilesChange?.([...selectedFiles, file]);
		showRecentFiles = false;
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

	// Check if a recent file can be selected (matches accept criteria)
	function canSelectRecentFile(file: QuestionnaireFileSchema): boolean {
		if (selectedFiles.some((f) => f.id === file.id)) return false;
		if (accept === '*/*') return true;
		const acceptedTypes = accept.split(',').map((type) => type.trim());
		return acceptedTypes.some((type) => {
			if (type.endsWith('/*')) {
				return file.mime_type.startsWith(type.slice(0, -2));
			}
			return file.mime_type === type;
		});
	}
</script>

<div class="space-y-3">
	<!-- Selected files -->
	{#if selectedFiles.length > 0 || pendingUploads.length > 0}
		<div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
			{#each selectedFiles as file (file.id)}
				<div class="relative flex items-center gap-3 rounded-lg border bg-card p-3">
					{#if isImage(file.mime_type) && file.file_url}
						<img
							src={getImageUrl(file.file_url)}
							alt={file.original_filename}
							class="h-10 w-10 rounded object-cover"
						/>
					{:else}
						<div class="flex h-10 w-10 items-center justify-center rounded bg-muted">
							<FileIcon class="h-5 w-5 text-muted-foreground" />
						</div>
					{/if}
					<div class="min-w-0 flex-1">
						<p class="truncate text-sm font-medium">{file.original_filename}</p>
						<p class="text-xs text-muted-foreground">{formatFileSize(file.file_size)}</p>
					</div>
					{#if !disabled}
						<Button
							variant="ghost"
							size="icon"
							class="h-8 w-8 shrink-0"
							onclick={() => removeFile(file.id)}
							aria-label="Remove file"
						>
							<X class="h-4 w-4" />
						</Button>
					{/if}
				</div>
			{/each}

			{#each pendingUploads as pending (pending.file.name + pending.file.lastModified)}
				<div class="relative flex items-center gap-3 rounded-lg border bg-card p-3">
					<div class="flex h-10 w-10 items-center justify-center rounded bg-muted">
						<Loader2 class="h-5 w-5 animate-spin text-primary" />
					</div>
					<div class="min-w-0 flex-1">
						<p class="truncate text-sm font-medium">{pending.file.name}</p>
						<p class="text-xs text-muted-foreground">
							{pending.error || 'Uploading...'}
						</p>
					</div>
					<Button
						variant="ghost"
						size="icon"
						class="h-8 w-8 shrink-0"
						onclick={() => removePendingUpload(pending.file)}
						aria-label="Cancel upload"
					>
						<X class="h-4 w-4" />
					</Button>
				</div>
			{/each}
		</div>
	{/if}

	<!-- Upload area (only show if can add more) -->
	{#if canAddMore}
		<div class="flex gap-2">
			<!-- Upload button -->
			<div
				role="button"
				tabindex={disabled ? -1 : 0}
				onclick={openFileBrowser}
				onkeydown={handleKeydown}
				ondragenter={handleDragEnter}
				ondragleave={handleDragLeave}
				ondragover={handleDragOver}
				ondrop={handleDrop}
				aria-label="Upload file"
				class={cn(
					'flex flex-1 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-4 transition-all',
					'hover:border-primary hover:bg-gray-50 dark:hover:bg-gray-800/50',
					'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2',
					isDragging && 'border-primary bg-primary/5',
					error ? 'border-destructive' : 'border-gray-300 dark:border-gray-600',
					disabled && 'cursor-not-allowed opacity-50 hover:border-gray-300 hover:bg-transparent'
				)}
			>
				<Upload
					class={cn('mb-1 h-6 w-6', isDragging ? 'text-primary' : 'text-muted-foreground')}
					aria-hidden="true"
				/>
				<p class="text-sm font-medium text-gray-900 dark:text-gray-100">
					{#if isDragging}
						Drop files here
					{:else}
						Click to upload
					{/if}
				</p>
				<p class="text-center text-xs text-muted-foreground">
					{formatAcceptedTypes(accept)} · Max {formatFileSize(maxSize)}
				</p>
			</div>

			<!-- Select recent button -->
			<Button
				type="button"
				variant="outline"
				size="sm"
				class="h-auto flex-col gap-1 px-4 py-3"
				onclick={() => (showRecentFiles = !showRecentFiles)}
				{disabled}
			>
				<Clock class="h-5 w-5" />
				<span class="text-xs">Recent</span>
				{#if showRecentFiles}
					<ChevronUp class="h-3 w-3" />
				{:else}
					<ChevronDown class="h-3 w-3" />
				{/if}
			</Button>
		</div>
	{/if}

	<!-- Recent files panel -->
	{#if showRecentFiles}
		<div class="rounded-lg border bg-muted/50 p-3">
			<p class="mb-2 text-sm font-medium">Select from recent uploads</p>
			{#if recentFilesQuery.isPending}
				<div class="flex items-center justify-center py-4">
					<Loader2 class="h-5 w-5 animate-spin text-muted-foreground" />
				</div>
			{:else if recentFilesQuery.data && recentFilesQuery.data.length > 0}
				<div class="grid max-h-48 grid-cols-1 gap-2 overflow-y-auto sm:grid-cols-2">
					{#each recentFilesQuery.data as file (file.id)}
						{@const canSelect = canSelectRecentFile(file)}
						<button
							type="button"
							onclick={() => selectRecentFile(file)}
							disabled={!canSelect}
							class={cn(
								'flex items-center gap-2 rounded-md border p-2 text-left transition-colors',
								canSelect
									? 'cursor-pointer hover:border-primary hover:bg-accent'
									: 'cursor-not-allowed opacity-50'
							)}
						>
							{#if isImage(file.mime_type) && file.file_url}
								<img
									src={getImageUrl(file.file_url)}
									alt={file.original_filename}
									class="h-8 w-8 rounded object-cover"
								/>
							{:else}
								<div class="flex h-8 w-8 items-center justify-center rounded bg-muted">
									<FileIcon class="h-4 w-4 text-muted-foreground" />
								</div>
							{/if}
							<div class="min-w-0 flex-1">
								<p class="truncate text-xs font-medium">{file.original_filename}</p>
								<p class="text-xs text-muted-foreground">{formatFileSize(file.file_size)}</p>
							</div>
						</button>
					{/each}
				</div>
			{:else}
				<p class="py-4 text-center text-sm text-muted-foreground">No recent files found</p>
			{/if}
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

	{#if error || uploadError}
		<p class="text-sm text-destructive" role="alert">
			{error || uploadError}
		</p>
	{/if}
</div>
