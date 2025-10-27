<script lang="ts">
	import { page } from '$app/stores';
	import type { PageData } from './$types';
	import { authStore } from '$lib/stores/auth.svelte';
	import { ArrowLeft, Loader2, Tag as TagIcon, Trash2 } from 'lucide-svelte';
	import { goto, invalidateAll } from '$app/navigation';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Textarea } from '$lib/components/ui/textarea';
	import { Badge } from '$lib/components/ui/badge';
	import ImageUploader from '$lib/components/forms/ImageUploader.svelte';
	import SeriesQuestionnaireAssignmentModal from '$lib/components/event-series/admin/SeriesQuestionnaireAssignmentModal.svelte';
	import SeriesResourceAssignmentModal from '$lib/components/event-series/admin/SeriesResourceAssignmentModal.svelte';
	import {
		eventseriesadminUpdateEventSeries,
		eventseriesadminUploadLogo,
		eventseriesadminUploadCoverArt,
		eventseriesadminDeleteLogo,
		eventseriesadminDeleteCoverArt,
		eventseriesadminAddTags,
		eventseriesadminRemoveTags
	} from '$lib/api/generated';

	let { data }: { data: PageData } = $props();

	const organization = $derived($page.data.organization);
	const accessToken = $derived(authStore.accessToken);

	// Modal states
	let showQuestionnaireModal = $state(false);
	let showResourceModal = $state(false);

	// Form state
	let name = $state(data.series.name);
	let description = $state(data.series.description || '');
	let isUpdating = $state(false);
	let updateError = $state<string | null>(null);

	// Tag state
	let newTag = $state('');
	let isAddingTag = $state(false);
	let isDeletingTag = $state<Record<string, boolean>>({});

	// Image upload states - TODO: implement image upload/delete functionality
	// @ts-expect-error - Will be used when image upload is implemented
	let isUploadingLogo = $state(false);
	// @ts-expect-error - Will be used when image upload is implemented
	let isUploadingCover = $state(false);
	// @ts-expect-error - Will be used when image upload is implemented
	let isDeletingLogo = $state(false);
	// @ts-expect-error - Will be used when image upload is implemented
	let isDeletingCover = $state(false);

	/**
	 * Navigate back to series list
	 */
	function goBack(): void {
		goto(`/org/${organization.slug}/admin/event-series`);
	}

	/**
	 * Handle series details update
	 */
	async function updateSeriesDetails() {
		if (!accessToken) return;

		if (!name.trim()) {
			updateError = 'Series name is required';
			return;
		}

		isUpdating = true;
		updateError = null;

		try {
			const response = await eventseriesadminUpdateEventSeries({
				path: { series_id: data.series.id },
				body: {
					name: name.trim(),
					description: description.trim() || undefined
				},
				headers: { Authorization: `Bearer ${accessToken}` }
			});

			if (response.error) {
				throw new Error('Failed to update series');
			}

			await invalidateAll();
		} catch (err) {
			console.error('Failed to update series:', err);
			updateError = err instanceof Error ? err.message : 'Failed to update series';
		} finally {
			isUpdating = false;
		}
	}

	/**
	 * Handle logo upload
	 * TODO: Wire this up to ImageUploader component
	 */
	// @ts-expect-error - Will be used when image upload UI is implemented
	async function handleLogoUpload(file: File) {
		if (!accessToken) return;

		isUploadingLogo = true;

		try {
			const response = await eventseriesadminUploadLogo({
				path: { series_id: data.series.id },
				body: { logo: file },
				headers: { Authorization: `Bearer ${accessToken}` }
			});

			if (response.error) {
				throw new Error('Failed to upload logo');
			}

			await invalidateAll();
		} catch (err) {
			console.error('Failed to upload logo:', err);
			alert('Failed to upload logo. Please try again.');
		} finally {
			isUploadingLogo = false;
		}
	}

	/**
	 * Handle cover art upload
	 * TODO: Wire this up to ImageUploader component
	 */
	// @ts-expect-error - Will be used when image upload UI is implemented
	async function handleCoverUpload(file: File) {
		if (!accessToken) return;

		isUploadingCover = true;

		try {
			const response = await eventseriesadminUploadCoverArt({
				path: { series_id: data.series.id },
				body: { cover_art: file },
				headers: { Authorization: `Bearer ${accessToken}` }
			});

			if (response.error) {
				throw new Error('Failed to upload cover art');
			}

			await invalidateAll();
		} catch (err) {
			console.error('Failed to upload cover art:', err);
			alert('Failed to upload cover art. Please try again.');
		} finally {
			isUploadingCover = false;
		}
	}

	/**
	 * Delete logo
	 * TODO: Wire this up to ImageUploader component
	 */
	// @ts-expect-error - Will be used when image upload UI is implemented
	async function deleteLogo() {
		if (!accessToken || !confirm('Are you sure you want to delete the logo?')) return;

		isDeletingLogo = true;

		try {
			const response = await eventseriesadminDeleteLogo({
				path: { series_id: data.series.id },
				headers: { Authorization: `Bearer ${accessToken}` }
			});

			if (response.error) {
				throw new Error('Failed to delete logo');
			}

			await invalidateAll();
		} catch (err) {
			console.error('Failed to delete logo:', err);
			alert('Failed to delete logo. Please try again.');
		} finally {
			isDeletingLogo = false;
		}
	}

	/**
	 * Delete cover art
	 * TODO: Wire this up to ImageUploader component
	 */
	// @ts-expect-error - Will be used when image upload UI is implemented
	async function deleteCoverArt() {
		if (!accessToken || !confirm('Are you sure you want to delete the cover art?')) return;

		isDeletingCover = true;

		try {
			const response = await eventseriesadminDeleteCoverArt({
				path: { series_id: data.series.id },
				headers: { Authorization: `Bearer ${accessToken}` }
			});

			if (response.error) {
				throw new Error('Failed to delete cover art');
			}

			await invalidateAll();
		} catch (err) {
			console.error('Failed to delete cover art:', err);
			alert('Failed to delete cover art. Please try again.');
		} finally {
			isDeletingCover = false;
		}
	}

	/**
	 * Add new tag
	 */
	async function addTag() {
		if (!accessToken || !newTag.trim()) return;

		isAddingTag = true;

		try {
			const response = await eventseriesadminAddTags({
				path: { series_id: data.series.id },
				body: { tags: [newTag.trim()] },
				headers: { Authorization: `Bearer ${accessToken}` }
			});

			if (response.error) {
				throw new Error('Failed to add tag');
			}

			newTag = '';
			await invalidateAll();
		} catch (err) {
			console.error('Failed to add tag:', err);
			alert('Failed to add tag. Please try again.');
		} finally {
			isAddingTag = false;
		}
	}

	/**
	 * Remove tag
	 */
	async function removeTag(tag: string) {
		if (!accessToken) return;

		isDeletingTag[tag] = true;

		try {
			const response = await eventseriesadminRemoveTags({
				path: { series_id: data.series.id },
				body: { tags: [tag] },
				headers: { Authorization: `Bearer ${accessToken}` }
			});

			if (response.error) {
				throw new Error('Failed to remove tag');
			}

			await invalidateAll();
		} catch (err) {
			console.error('Failed to remove tag:', err);
			alert('Failed to remove tag. Please try again.');
		} finally {
			isDeletingTag[tag] = false;
		}
	}

	// Check if basic details have changed
	const hasChanges = $derived(
		name.trim() !== data.series.name ||
			(description.trim() || '') !== (data.series.description || '')
	);
</script>

<svelte:head>
	<title>Edit {data.series.name} - {organization.name} Admin | Revel</title>
	<meta name="description" content="Edit event series {data.series.name}" />
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<div class="space-y-6">
	<!-- Header with Back Button -->
	<div class="flex items-center gap-4">
		<button
			type="button"
			onclick={goBack}
			class="rounded-md p-2 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
			aria-label="Go back to series list"
		>
			<ArrowLeft class="h-5 w-5" aria-hidden="true" />
		</button>
		<div class="flex-1">
			<h1 class="text-2xl font-bold tracking-tight md:text-3xl">Edit Event Series</h1>
			<p class="mt-1 text-sm text-muted-foreground">{data.series.name}</p>
		</div>
	</div>

	<!-- Basic Details -->
	<div class="rounded-lg border border-border bg-card p-6 shadow-sm">
		<h2 class="mb-4 text-lg font-semibold">Basic Details</h2>

		<div class="space-y-4">
			<!-- Name Field -->
			<div class="space-y-2">
				<Label for="name">
					Series Name <span class="text-destructive">*</span>
				</Label>
				<Input
					id="name"
					type="text"
					bind:value={name}
					placeholder="e.g., Monthly Community Gatherings"
					required
					maxlength={150}
					disabled={isUpdating}
				/>
			</div>

			<!-- Description Field -->
			<div class="space-y-2">
				<Label for="description">Description</Label>
				<Textarea
					id="description"
					bind:value={description}
					placeholder="Describe what this event series is about..."
					rows={4}
					disabled={isUpdating}
				/>
			</div>

			<!-- Error Message -->
			{#if updateError}
				<div class="rounded-lg border border-destructive bg-destructive/10 p-3">
					<p class="text-sm font-medium text-destructive">{updateError}</p>
				</div>
			{/if}

			<!-- Save Button -->
			<div class="flex justify-end">
				<Button onclick={updateSeriesDetails} disabled={!hasChanges || isUpdating}>
					{#if isUpdating}
						<Loader2 class="h-4 w-4 animate-spin" aria-hidden="true" />
						Saving...
					{:else}
						Save Changes
					{/if}
				</Button>
			</div>
		</div>
	</div>

	<!-- Logo -->
	<div class="rounded-lg border border-border bg-card p-6 shadow-sm">
		<h2 class="mb-4 text-lg font-semibold">Logo</h2>
		<ImageUploader
			preview={data.series.logo}
			aspectRatio="square"
			label="Series Logo"
		/>
		<p class="mt-2 text-sm text-muted-foreground">Logo management coming soon</p>
	</div>

	<!-- Cover Art -->
	<div class="rounded-lg border border-border bg-card p-6 shadow-sm">
		<h2 class="mb-4 text-lg font-semibold">Cover Art</h2>
		<ImageUploader
			preview={data.series.cover_art}
			aspectRatio="wide"
			label="Series Cover Art"
		/>
		<p class="mt-2 text-sm text-muted-foreground">Cover art management coming soon</p>
	</div>

	<!-- Tags -->
	<div class="rounded-lg border border-border bg-card p-6 shadow-sm">
		<h2 class="mb-4 text-lg font-semibold">Tags</h2>

		<!-- Current Tags -->
		{#if data.series.tags && data.series.tags.length > 0}
			<div class="mb-4 flex flex-wrap gap-2">
				{#each data.series.tags as tag}
					<Badge variant="secondary" class="gap-2">
						<TagIcon class="h-3 w-3" aria-hidden="true" />
						{tag}
						<button
							type="button"
							onclick={() => removeTag(tag)}
							disabled={isDeletingTag[tag]}
							class="ml-1 rounded-sm hover:bg-destructive hover:text-destructive-foreground"
							aria-label={`Remove tag ${tag}`}
						>
							<Trash2 class="h-3 w-3" aria-hidden="true" />
						</button>
					</Badge>
				{/each}
			</div>
		{:else}
			<p class="mb-4 text-sm text-muted-foreground">No tags yet</p>
		{/if}

		<!-- Add Tag Form -->
		<div class="flex gap-2">
			<Input
				type="text"
				bind:value={newTag}
				placeholder="Add a tag..."
				disabled={isAddingTag}
				onkeydown={(e) => {
					if (e.key === 'Enter') {
						e.preventDefault();
						addTag();
					}
				}}
			/>
			<Button onclick={addTag} disabled={!newTag.trim() || isAddingTag}>
				{#if isAddingTag}
					<Loader2 class="h-4 w-4 animate-spin" aria-hidden="true" />
				{:else}
					Add Tag
				{/if}
			</Button>
		</div>
	</div>

	<!-- Questionnaires Section -->
	<div class="rounded-lg border border-border bg-card p-6 shadow-sm">
		<div class="flex items-start justify-between gap-4">
			<div>
				<h2 class="text-lg font-semibold">Questionnaires</h2>
				<p class="mt-1 text-sm text-muted-foreground">
					Manage questionnaires that apply to all events in this series
				</p>
			</div>
			<Button onclick={() => (showQuestionnaireModal = true)}>Manage Questionnaires</Button>
		</div>
	</div>

	<!-- Resources Section -->
	<div class="rounded-lg border border-border bg-card p-6 shadow-sm">
		<div class="flex items-start justify-between gap-4">
			<div>
				<h2 class="text-lg font-semibold">Resources</h2>
				<p class="mt-1 text-sm text-muted-foreground">
					Manage resources that are available for all events in this series
				</p>
			</div>
			<Button onclick={() => (showResourceModal = true)}>Manage Resources</Button>
		</div>
	</div>
</div>

<!-- Questionnaire Assignment Modal -->
{#if showQuestionnaireModal && accessToken}
	<SeriesQuestionnaireAssignmentModal
		bind:open={showQuestionnaireModal}
		series={data.series}
		organizationId={organization.id}
		{accessToken}
		onClose={() => (showQuestionnaireModal = false)}
	/>
{/if}

<!-- Resource Assignment Modal -->
{#if showResourceModal && accessToken}
	<SeriesResourceAssignmentModal
		bind:open={showResourceModal}
		series={data.series}
		organizationSlug={organization.slug}
		{accessToken}
		onClose={() => (showResourceModal = false)}
	/>
{/if}

<style>
	/* Ensure consistent focus states for accessibility */
	:global(button:focus-visible) {
		outline: 2px solid hsl(var(--ring));
		outline-offset: 2px;
	}
</style>
