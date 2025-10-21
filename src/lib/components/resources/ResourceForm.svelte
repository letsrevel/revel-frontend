<script lang="ts">
	import type { AdditionalResourceSchema } from '$lib/api/generated/types.gen';
	import { FileText, Link as LinkIcon, AlignLeft } from 'lucide-svelte';
	import { cn } from '$lib/utils/cn';
	import MarkdownEditor from '$lib/components/forms/MarkdownEditor.svelte';
	import ResourceAssignment from './ResourceAssignment.svelte';

	interface Props {
		resource?: AdditionalResourceSchema | null;
		organizationSlug: string;
		onSubmit: (data: FormData) => void;
		isSubmitting?: boolean;
		errors?: Record<string, string>;
	}

	let {
		resource = null,
		organizationSlug,
		onSubmit,
		isSubmitting = false,
		errors = {}
	}: Props = $props();

	// Form state
	let resourceType = $state<'file' | 'link' | 'text'>(
		(resource?.resource_type as 'file' | 'link' | 'text') || 'file'
	);
	let name = $state(resource?.name || '');
	let description = $state(resource?.description || '');
	let visibility = $state(resource?.visibility || 'public');
	let displayOnOrgPage = $state(resource?.display_on_organization_page !== false);

	// Type-specific state
	let file = $state<File | null>(null);
	let link = $state(resource?.link || '');
	let text = $state(resource?.text || '');

	// Event assignment
	let selectedEventIds = $state<string[]>(resource?.event_ids || []);

	// Sync form state when resource prop changes
	$effect(() => {
		// Reset all form fields when resource changes
		resourceType = (resource?.resource_type as 'file' | 'link' | 'text') || 'file';
		name = resource?.name || '';
		description = resource?.description || '';
		visibility = resource?.visibility || 'public';
		displayOnOrgPage = resource?.display_on_organization_page !== false;
		link = resource?.link || '';
		text = resource?.text || '';
		selectedEventIds = resource?.event_ids || [];
		file = null;
		validationErrors = {};
	});

	// Validation
	let validationErrors = $state<Record<string, string>>({});

	function validateForm(): boolean {
		const newErrors: Record<string, string> = {};

		if (!name.trim()) {
			newErrors.name = 'Name is required';
		}

		if (resourceType === 'file' && !file && !resource?.file) {
			newErrors.file = 'Please select a file';
		}

		if (resourceType === 'link') {
			if (!link.trim()) {
				newErrors.link = 'Link URL is required';
			} else if (!isValidUrl(link)) {
				newErrors.link = 'Please enter a valid URL';
			}
		}

		if (resourceType === 'text' && !text.trim()) {
			newErrors.text = 'Content is required';
		}

		validationErrors = newErrors;
		return Object.keys(newErrors).length === 0;
	}

	function isValidUrl(url: string): boolean {
		try {
			new URL(url);
			return true;
		} catch {
			return false;
		}
	}

	function handleFileChange(event: Event) {
		const target = event.target as HTMLInputElement;
		file = target.files?.[0] || null;
	}

	function handleSubmit(event: Event) {
		event.preventDefault();

		if (!validateForm()) {
			return;
		}

		const formData = new FormData();

		// Common fields
		formData.append('resource_type', resourceType);
		formData.append('name', name.trim());
		if (description.trim()) {
			formData.append('description', description.trim());
		}
		formData.append('visibility', visibility);
		formData.append('display_on_organization_page', displayOnOrgPage.toString());

		// Event assignment
		if (selectedEventIds.length > 0) {
			formData.append('event_ids', JSON.stringify(selectedEventIds));
		}

		// Type-specific fields
		if (resourceType === 'file' && file) {
			formData.append('file', file);
		} else if (resourceType === 'link') {
			formData.append('link', link.trim());
		} else if (resourceType === 'text') {
			formData.append('text', text.trim());
		}

		onSubmit(formData);
	}

	function handleTypeChange(newType: 'file' | 'link' | 'text') {
		resourceType = newType;
		validationErrors = {};
	}

	// Merge external and internal errors
	const allErrors = $derived({ ...errors, ...validationErrors });
</script>

<form onsubmit={handleSubmit} class="space-y-6">
	<!-- Resource Type Selection (only for new resources) -->
	{#if !resource}
		<div class="space-y-2">
			<label class="block text-sm font-medium text-gray-900 dark:text-gray-100">
				Resource Type
				<span class="text-destructive" aria-label="required">*</span>
			</label>
			<div class="grid grid-cols-3 gap-3">
				<button
					type="button"
					onclick={() => handleTypeChange('file')}
					class={cn(
						'flex flex-col items-center gap-2 rounded-lg border-2 p-4 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
						resourceType === 'file'
							? 'border-primary bg-primary/5 text-primary'
							: 'border-border hover:border-primary/50'
					)}
					aria-pressed={resourceType === 'file'}
				>
					<FileText class="h-6 w-6" aria-hidden="true" />
					<span class="text-sm font-medium">File</span>
				</button>

				<button
					type="button"
					onclick={() => handleTypeChange('link')}
					class={cn(
						'flex flex-col items-center gap-2 rounded-lg border-2 p-4 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
						resourceType === 'link'
							? 'border-primary bg-primary/5 text-primary'
							: 'border-border hover:border-primary/50'
					)}
					aria-pressed={resourceType === 'link'}
				>
					<LinkIcon class="h-6 w-6" aria-hidden="true" />
					<span class="text-sm font-medium">Link</span>
				</button>

				<button
					type="button"
					onclick={() => handleTypeChange('text')}
					class={cn(
						'flex flex-col items-center gap-2 rounded-lg border-2 p-4 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
						resourceType === 'text'
							? 'border-primary bg-primary/5 text-primary'
							: 'border-border hover:border-primary/50'
					)}
					aria-pressed={resourceType === 'text'}
				>
					<AlignLeft class="h-6 w-6" aria-hidden="true" />
					<span class="text-sm font-medium">Text</span>
				</button>
			</div>
		</div>
	{/if}

	<!-- Name -->
	<div class="space-y-2">
		<label for="name" class="block text-sm font-medium text-gray-900 dark:text-gray-100">
			Name
			<span class="text-destructive" aria-label="required">*</span>
		</label>
		<input
			id="name"
			type="text"
			bind:value={name}
			disabled={isSubmitting}
			class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
			aria-invalid={!!allErrors.name}
			aria-describedby={allErrors.name ? 'name-error' : undefined}
		/>
		{#if allErrors.name}
			<p id="name-error" class="text-sm text-destructive" role="alert">
				{allErrors.name}
			</p>
		{/if}
	</div>

	<!-- Description -->
	<div class="space-y-2">
		<label for="description" class="block text-sm font-medium text-gray-900 dark:text-gray-100">
			Description
		</label>
		<MarkdownEditor
			bind:value={description}
			id="description"
			placeholder="Describe this resource..."
			rows={4}
			disabled={isSubmitting}
		/>
		{#if allErrors.description}
			<p id="description-error" class="text-sm text-destructive" role="alert">
				{allErrors.description}
			</p>
		{/if}
	</div>

	<!-- Type-specific fields -->
	{#if resourceType === 'file'}
		<div class="space-y-2">
			<label for="file" class="block text-sm font-medium text-gray-900 dark:text-gray-100">
				File
				{#if !resource}<span class="text-destructive" aria-label="required">*</span>{/if}
			</label>

			{#if resource?.file}
				<div class="rounded-md bg-muted p-3 text-sm">
					<p class="font-medium">Current file:</p>
					<p class="truncate text-muted-foreground">{resource.file}</p>
					<p class="mt-2 text-xs text-muted-foreground">
						Upload a new file to replace the current one
					</p>
				</div>
			{/if}

			<div class="flex items-center gap-3">
				<input
					bind:this={fileInput}
					id="file"
					type="file"
					onchange={handleFileChange}
					disabled={isSubmitting}
					class="block w-full text-sm text-gray-900 file:mr-4 file:rounded-md file:border-0 file:bg-primary file:px-4 file:py-2 file:text-sm file:font-medium file:text-primary-foreground hover:file:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:text-gray-100"
					aria-invalid={!!allErrors.file}
					aria-describedby={allErrors.file ? 'file-error' : undefined}
				/>
			</div>

			{#if file}
				<p class="text-sm text-muted-foreground">
					Selected: {file.name} ({(file.size / 1024).toFixed(2)} KB)
				</p>
			{/if}

			{#if allErrors.file}
				<p id="file-error" class="text-sm text-destructive" role="alert">
					{allErrors.file}
				</p>
			{/if}
		</div>
	{:else if resourceType === 'link'}
		<div class="space-y-2">
			<label for="link" class="block text-sm font-medium text-gray-900 dark:text-gray-100">
				URL
				<span class="text-destructive" aria-label="required">*</span>
			</label>
			<input
				id="link"
				type="url"
				bind:value={link}
				placeholder="https://example.com"
				disabled={isSubmitting}
				class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
				aria-invalid={!!allErrors.link}
				aria-describedby={allErrors.link ? 'link-error' : undefined}
			/>
			{#if allErrors.link}
				<p id="link-error" class="text-sm text-destructive" role="alert">
					{allErrors.link}
				</p>
			{/if}
		</div>
	{:else if resourceType === 'text'}
		<div class="space-y-2">
			<label for="text" class="block text-sm font-medium text-gray-900 dark:text-gray-100">
				Content
				<span class="text-destructive" aria-label="required">*</span>
			</label>
			<MarkdownEditor
				bind:value={text}
				id="text"
				placeholder="Enter your content here..."
				rows={8}
				disabled={isSubmitting}
			/>
			{#if allErrors.text}
				<p id="text-error" class="text-sm text-destructive" role="alert">
					{allErrors.text}
				</p>
			{/if}
		</div>
	{/if}

	<!-- Visibility -->
	<div class="space-y-2">
		<label for="visibility" class="block text-sm font-medium text-gray-900 dark:text-gray-100">
			Visibility
		</label>
		<select
			id="visibility"
			bind:value={visibility}
			disabled={isSubmitting}
			class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
		>
			<option value="public">Public - Anyone can view</option>
			<option value="members-only">Members Only - Requires membership</option>
			<option value="staff-only">Staff Only - Staff and admins only</option>
			<option value="private">Private - Admins only</option>
		</select>
		<p class="text-xs text-muted-foreground">Controls who can view this resource</p>
	</div>

	<!-- Display on Organization Page -->
	<div class="flex items-start gap-3">
		<input
			id="display-on-org"
			type="checkbox"
			bind:checked={displayOnOrgPage}
			disabled={isSubmitting}
			class="mt-0.5 h-4 w-4 rounded border-input text-primary focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
		/>
		<div class="flex-1">
			<label for="display-on-org" class="text-sm font-medium text-gray-900 dark:text-gray-100">
				Display on organization page
			</label>
			<p class="text-xs text-muted-foreground">
				Show this resource on your public organization profile
			</p>
		</div>
	</div>

	<!-- Event Assignment -->
	<ResourceAssignment
		{organizationSlug}
		{selectedEventIds}
		onSelectionChange={(eventIds) => (selectedEventIds = eventIds)}
		disabled={isSubmitting}
	/>

	<!-- Submit Button -->
	<div class="flex items-center justify-end gap-3">
		<button
			type="submit"
			disabled={isSubmitting}
			class={cn(
				'inline-flex items-center gap-2 rounded-md bg-primary px-6 py-2 font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
				isSubmitting && 'cursor-not-allowed opacity-50'
			)}
		>
			{#if isSubmitting}
				<div
					class="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent"
					aria-hidden="true"
				></div>
				Saving...
			{:else}
				{resource ? 'Update Resource' : 'Create Resource'}
			{/if}
		</button>
	</div>
</form>
