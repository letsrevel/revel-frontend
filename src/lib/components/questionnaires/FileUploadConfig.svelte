<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { Label } from '$lib/components/ui/label';
	import { Input } from '$lib/components/ui/input';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import { Select, SelectContent, SelectItem, SelectTrigger } from '$lib/components/ui/select';

	// File type categories for file upload questions
	const FILE_TYPE_CATEGORIES = [
		{
			id: 'images',
			label: 'Images (JPEG, PNG, GIF, WebP)',
			mimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
		},
		{
			id: 'audio',
			label: 'Audio (MP3, WAV, OGG, M4A)',
			// video/webm included because browser MediaRecorder produces video/webm container
			// even for audio-only recordings (libmagic detects WebM container as video/webm)
			// audio/mp4 covers .m4a files (AAC audio in MP4 container)
			mimeTypes: [
				'audio/mpeg',
				'audio/wav',
				'audio/ogg',
				'audio/webm',
				'audio/aac',
				'audio/mp4',
				'video/webm'
			]
		},
		{ id: 'documents', label: 'Documents (PDF)', mimeTypes: ['application/pdf'] },
		{
			id: 'spreadsheets',
			label: 'Spreadsheets (Excel)',
			mimeTypes: [
				'application/vnd.ms-excel',
				'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
			]
		},
		{ id: 'text', label: 'Text Files (TXT, CSV)', mimeTypes: ['text/plain', 'text/csv'] },
		{ id: 'archives', label: 'Archives (ZIP)', mimeTypes: ['application/zip'] }
	];

	// File size options (in bytes)
	const FILE_SIZE_OPTIONS = [
		{ value: 1048576, label: '1 MB' },
		{ value: 5242880, label: '5 MB' },
		{ value: 10485760, label: '10 MB' },
		{ value: 26214400, label: '25 MB' }
	];

	interface Props {
		questionId: string;
		allowedMimeTypes: string[];
		maxFileSize: number;
		maxFiles: number;
		onUpdate: (updates: {
			allowedMimeTypes?: string[];
			maxFileSize?: number;
			maxFiles?: number;
		}) => void;
	}

	const { questionId, allowedMimeTypes, maxFileSize, maxFiles, onUpdate }: Props = $props();
</script>

<div class="space-y-4">
	<!-- Allowed File Types -->
	<div class="space-y-2">
		<Label>{m['questionEditor.allowedFileTypes']?.() || 'Allowed File Types'}</Label>
		<div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
			{#each FILE_TYPE_CATEGORIES as category (category.id)}
				{@const isSelected = category.mimeTypes.every((mime) => allowedMimeTypes?.includes(mime))}
				<div class="flex items-center space-x-2">
					<Checkbox
						id="filetype-{questionId}-{category.id}"
						checked={isSelected}
						onCheckedChange={(checked) => {
							let newMimeTypes = [...(allowedMimeTypes || [])];
							if (checked) {
								// Add all mime types from this category
								category.mimeTypes.forEach((mime) => {
									if (!newMimeTypes.includes(mime)) {
										newMimeTypes.push(mime);
									}
								});
							} else {
								// Remove all mime types from this category
								newMimeTypes = newMimeTypes.filter((mime) => !category.mimeTypes.includes(mime));
							}
							onUpdate({ allowedMimeTypes: newMimeTypes });
						}}
					/>
					<Label
						for="filetype-{questionId}-{category.id}"
						class="text-sm font-normal leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
					>
						{category.label}
					</Label>
				</div>
			{/each}
		</div>
		{#if (allowedMimeTypes?.length || 0) === 0}
			<p class="text-xs text-destructive">Please select at least one file type</p>
		{/if}
	</div>

	<div class="grid gap-4 sm:grid-cols-2">
		<!-- Max File Size -->
		<div class="space-y-2">
			<Label for="maxsize-{questionId}"
				>{m['questionEditor.maxFileSize']?.() || 'Maximum File Size'}</Label
			>
			<Select
				type="single"
				value={String(maxFileSize || 5242880)}
				onValueChange={(value) => {
					if (value) {
						onUpdate({ maxFileSize: parseInt(value) });
					}
				}}
			>
				<SelectTrigger id="maxsize-{questionId}" class="w-full">
					{FILE_SIZE_OPTIONS.find((o) => o.value === (maxFileSize || 5242880))?.label || '5 MB'}
				</SelectTrigger>
				<SelectContent>
					{#each FILE_SIZE_OPTIONS as option (option.value)}
						<SelectItem value={String(option.value)}>
							{option.label}
						</SelectItem>
					{/each}
				</SelectContent>
			</Select>
		</div>

		<!-- Max Number of Files -->
		<div class="space-y-2">
			<Label for="maxfiles-{questionId}"
				>{m['questionEditor.maxFiles']?.() || 'Maximum Number of Files'}</Label
			>
			<Input
				id="maxfiles-{questionId}"
				type="number"
				value={maxFiles || 1}
				oninput={(e) => {
					const val = parseInt(e.currentTarget.value) || 1;
					onUpdate({ maxFiles: Math.max(1, Math.min(10, val)) });
				}}
				min={1}
				max={10}
			/>
			<p class="text-xs text-muted-foreground">1-10 files allowed</p>
		</div>
	</div>
</div>
