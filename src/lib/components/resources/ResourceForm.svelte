<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type { AdditionalResourceSchema } from '$lib/api/generated/types.gen';
	import { FileText, Link as LinkIcon, AlignLeft } from '@lucide/svelte';
	import { cn } from '$lib/utils/cn';
	import MarkdownEditor from '$lib/components/forms/MarkdownEditor.svelte';
	import ResourceAssignment from './ResourceAssignment.svelte';

	interface Props {
		resource?: AdditionalResourceSchema | null;
		organizationSlug: string;
		organizationId: string;
		onSubmit: (data: FormData) => void;
		isSubmitting?: boolean;
		errors?: Record<string, string>;
	}

	const {
		resource = null,
		organizationSlug,
		organizationId,
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
	let fileInput = $state<HTMLInputElement | undefined>(undefined);

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
			newErrors.name = m['resourceForm.nameRequired']();
		}

		if (resourceType === 'file' && !file && !resource?.file_url) {
			newErrors.file = m['resourceForm.fileRequired']();
		}

		if (resourceType === 'link') {
			if (!link.trim()) {
				newErrors.link = m['resourceForm.linkRequired']();
			} else if (!isValidUrl(link)) {
				newErrors.link = m['resourceForm.invalidUrl']();
			}
		}

		if (resourceType === 'text' && !text.trim()) {
			newErrors.text = m['resourceForm.contentRequired']();
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
			<span
				id="resource-type-label"
				class="block text-sm font-medium text-gray-900 dark:text-gray-100"
			>
				{m['resourceForm.resourceType']()}
				<span class="text-destructive" aria-label={m['resourceForm.required']()}>*</span>
			</span>
			<div class="grid grid-cols-3 gap-3" role="group" aria-labelledby="resource-type-label">
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
					<span class="text-sm font-medium">{m['resourceForm.file']()}</span>
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
					<span class="text-sm font-medium">{m['resourceForm.link']()}</span>
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
					<span class="text-sm font-medium">{m['resourceForm.text']()}</span>
				</button>
			</div>
		</div>
	{/if}

	<!-- Name -->
	<div class="space-y-2">
		<label for="name" class="block text-sm font-medium text-gray-900 dark:text-gray-100">
			{m['resourceForm.name']()}
			<span class="text-destructive" aria-label={m['resourceForm.required']()}>*</span>
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
			{m['resourceForm.description']()}
		</label>
		<MarkdownEditor
			bind:value={description}
			id="description"
			placeholder={m['resourceForm.descriptionPlaceholder']()}
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
				{m['resourceForm.file']()}
				{#if !resource}<span class="text-destructive" aria-label={m['resourceForm.required']()}
						>*</span
					>{/if}
			</label>

			{#if resource?.file_url}
				<div class="rounded-md bg-muted p-3 text-sm">
					<p class="font-medium">{m['resourceForm.currentFile']()}</p>
					<p class="truncate text-muted-foreground">{resource.file_url}</p>
					<p class="mt-2 text-xs text-muted-foreground">
						{m['resourceForm.replaceFileHint']()}
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
					{m['resourceForm.selectedFile']({
						name: file.name,
						size: (file.size / 1024).toFixed(2)
					})}
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
				{m['resourceForm.url']()}
				<span class="text-destructive" aria-label={m['resourceForm.required']()}>*</span>
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
				{m['resourceForm.content']()}
				<span class="text-destructive" aria-label={m['resourceForm.required']()}>*</span>
			</label>
			<MarkdownEditor
				bind:value={text}
				id="text"
				placeholder={m['resourceForm.contentPlaceholder']()}
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
			{m['resourceForm.visibility']()}
		</label>
		<select
			id="visibility"
			bind:value={visibility}
			disabled={isSubmitting}
			class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
		>
			<option value="public">{m['resourceForm.public']()}</option>
			<option value="members-only">{m['resourceForm.membersOnly']()}</option>
			<option value="staff-only">{m['resourceForm.staffOnly']()}</option>
			<option value="attendees-only">{m['resourceForm.attendeesOnly']()}</option>
			<option value="private">{m['resourceForm.privateInvitedAttendees']()}</option>
		</select>
		<p class="text-xs text-muted-foreground">
			{visibility === 'private'
				? m['resourceForm.privateVisibilityHelp']()
				: visibility === 'attendees-only'
					? m['resourceForm.attendeesOnlyHelp']()
					: m['resourceForm.controlsVisibility']()}
		</p>
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
				{m['resourceForm.displayOnOrgPage']()}
			</label>
			<p class="text-xs text-muted-foreground">
				{m['resourceForm.displayOnOrgPageHelp']()}
			</p>
		</div>
	</div>

	<!-- Event Assignment -->
	<ResourceAssignment
		{organizationId}
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
				{m['resourceForm.saving']()}
			{:else}
				{resource ? m['resourceForm.updateResource']() : m['resourceForm.createResource']()}
			{/if}
		</button>
	</div>
</form>
