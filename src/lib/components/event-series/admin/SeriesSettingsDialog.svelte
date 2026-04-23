<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { createMutation, createQuery, useQueryClient } from '@tanstack/svelte-query';
	import { Dialog, DialogContent, DialogHeader, DialogTitle } from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Textarea } from '$lib/components/ui/textarea';
	import { Badge } from '$lib/components/ui/badge';
	import ImageUploader from '$lib/components/forms/ImageUploader.svelte';
	import { Loader2, Settings as SettingsIcon, Tag as TagIcon, Trash2 } from 'lucide-svelte';
	import { toast } from 'svelte-sonner';
	import {
		eventseriesGetEventSeries,
		eventseriesadminUpdateEventSeries,
		eventseriesadminUploadLogo,
		eventseriesadminUploadCoverArt,
		eventseriesadminDeleteLogo,
		eventseriesadminDeleteCoverArt,
		eventseriesadminAddTags,
		eventseriesadminRemoveTags
	} from '$lib/api/generated/sdk.gen';
	import type {
		EventSeriesRecurrenceDetailSchema,
		EventSeriesRetrieveSchema
	} from '$lib/api/generated/types.gen';
	import { seriesQueryKeys, invalidateSeries } from '$lib/queries/event-series';

	interface Props {
		open: boolean;
		series: EventSeriesRecurrenceDetailSchema;
		organizationSlug: string;
		accessToken: string | null;
		onClose: () => void;
	}

	// eslint-disable-next-line prefer-const -- `open` is bindable so the whole destructure must use `let`.
	let { open = $bindable(), series, organizationSlug, accessToken, onClose }: Props = $props();

	const queryClient = useQueryClient();

	// Form state — seeded from the admin schema we already have. The dialog also
	// fetches the public series on open to surface current logo/cover/tags (which
	// the admin recurrence schema does not expose). See progress log for the
	// deviation note on why we reach for the public GET instead of extending the
	// admin schema.
	let name = $state(series.name);
	let description = $state(series.description ?? '');
	let newTag = $state('');
	let updateError = $state<string | null>(null);
	let addTagError = $state<string | null>(null);

	// Re-sync form fields any time the dialog is re-opened or the server state
	// changes underneath us.
	$effect(() => {
		if (open) {
			name = series.name;
			description = series.description ?? '';
			newTag = '';
			updateError = null;
			addTagError = null;
		}
	});

	// Public series query — only runs while the dialog is open. The admin
	// EventSeriesRecurrenceDetailSchema omits logo/cover/tags, and the public
	// GET is the authoritative source for those fields (see plan §Appendix A).
	const publicSeriesQuery = createQuery<EventSeriesRetrieveSchema>(() => ({
		queryKey: seriesQueryKeys.detail(series.id),
		queryFn: async () => {
			const response = await eventseriesGetEventSeries({
				path: { series_id: series.id },
				headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined
			});
			if (response.error || !response.data) {
				throw new Error('Failed to load series media');
			}
			return response.data;
		},
		enabled: open
	}));

	const publicSeries = $derived(publicSeriesQuery.data);
	const logoUrl = $derived(publicSeries?.logo ?? null);
	const coverArtUrl = $derived(publicSeries?.cover_art ?? null);
	const tags = $derived(publicSeries?.tags ?? []);

	// --- Mutations ---

	const updateDetailsMutation = createMutation(() => ({
		mutationFn: async () => {
			if (!accessToken) throw new Error('Not authenticated');
			const response = await eventseriesadminUpdateEventSeries({
				path: { series_id: series.id },
				body: {
					name: name.trim(),
					description: description.trim() ? description.trim() : null
				},
				headers: { Authorization: `Bearer ${accessToken}` }
			});
			if (response.error) throw new Error(m['eventSeriesEditPage.error_updateFailed']());
			return response.data;
		},
		onSuccess: async () => {
			await invalidateSeries(queryClient, organizationSlug, series.id);
			toast.success(m['recurringEvents.seriesSettings.savedToast']());
			updateError = null;
		},
		onError: (err: Error) => {
			updateError = err.message || m['eventSeriesEditPage.error_updateFailed']();
		}
	}));

	const uploadLogoMutation = createMutation(() => ({
		mutationFn: async (file: File) => {
			if (!accessToken) throw new Error('Not authenticated');
			const response = await eventseriesadminUploadLogo({
				path: { series_id: series.id },
				body: { logo: file },
				headers: { Authorization: `Bearer ${accessToken}` }
			});
			if (response.error) throw new Error(m['eventSeriesEditPage.error_uploadLogoFailed']());
			return response.data;
		},
		onSuccess: async () => {
			await invalidateSeries(queryClient, organizationSlug, series.id);
			toast.success(m['recurringEvents.seriesSettings.savedToast']());
		},
		onError: (err: Error) => {
			toast.error(err.message || m['eventSeriesEditPage.error_uploadLogoFailed']());
		}
	}));

	const deleteLogoMutation = createMutation(() => ({
		mutationFn: async () => {
			if (!accessToken) throw new Error('Not authenticated');
			const response = await eventseriesadminDeleteLogo({
				path: { series_id: series.id },
				headers: { Authorization: `Bearer ${accessToken}` }
			});
			if (response.error) throw new Error(m['eventSeriesEditPage.error_deleteLogoFailed']());
			return response.data;
		},
		onSuccess: async () => {
			await invalidateSeries(queryClient, organizationSlug, series.id);
			toast.success(m['recurringEvents.seriesSettings.savedToast']());
		},
		onError: (err: Error) => {
			toast.error(err.message || m['eventSeriesEditPage.error_deleteLogoFailed']());
		}
	}));

	const uploadCoverMutation = createMutation(() => ({
		mutationFn: async (file: File) => {
			if (!accessToken) throw new Error('Not authenticated');
			const response = await eventseriesadminUploadCoverArt({
				path: { series_id: series.id },
				body: { cover_art: file },
				headers: { Authorization: `Bearer ${accessToken}` }
			});
			if (response.error) throw new Error(m['eventSeriesEditPage.error_uploadCoverFailed']());
			return response.data;
		},
		onSuccess: async () => {
			await invalidateSeries(queryClient, organizationSlug, series.id);
			toast.success(m['recurringEvents.seriesSettings.savedToast']());
		},
		onError: (err: Error) => {
			toast.error(err.message || m['eventSeriesEditPage.error_uploadCoverFailed']());
		}
	}));

	const deleteCoverMutation = createMutation(() => ({
		mutationFn: async () => {
			if (!accessToken) throw new Error('Not authenticated');
			const response = await eventseriesadminDeleteCoverArt({
				path: { series_id: series.id },
				headers: { Authorization: `Bearer ${accessToken}` }
			});
			if (response.error) throw new Error(m['eventSeriesEditPage.error_deleteCoverFailed']());
			return response.data;
		},
		onSuccess: async () => {
			await invalidateSeries(queryClient, organizationSlug, series.id);
			toast.success(m['recurringEvents.seriesSettings.savedToast']());
		},
		onError: (err: Error) => {
			toast.error(err.message || m['eventSeriesEditPage.error_deleteCoverFailed']());
		}
	}));

	const addTagMutation = createMutation(() => ({
		mutationFn: async (tag: string) => {
			if (!accessToken) throw new Error('Not authenticated');
			const response = await eventseriesadminAddTags({
				path: { series_id: series.id },
				body: { tags: [tag] },
				headers: { Authorization: `Bearer ${accessToken}` }
			});
			if (response.error) throw new Error(m['eventSeriesEditPage.error_addTagFailedMessage']());
			return response.data;
		},
		onSuccess: async () => {
			newTag = '';
			addTagError = null;
			await invalidateSeries(queryClient, organizationSlug, series.id);
		},
		onError: (err: Error) => {
			addTagError = err.message || m['eventSeriesEditPage.error_addTagFailedMessage']();
		}
	}));

	const removeTagMutation = createMutation(() => ({
		mutationFn: async (tag: string) => {
			if (!accessToken) throw new Error('Not authenticated');
			const response = await eventseriesadminRemoveTags({
				path: { series_id: series.id },
				body: { tags: [tag] },
				headers: { Authorization: `Bearer ${accessToken}` }
			});
			if (response.error) throw new Error(m['eventSeriesEditPage.error_removeTagFailedMessage']());
			return response.data;
		},
		onSuccess: async () => {
			await invalidateSeries(queryClient, organizationSlug, series.id);
		},
		onError: (err: Error) => {
			toast.error(err.message || m['eventSeriesEditPage.error_removeTagFailedMessage']());
		}
	}));

	// --- Derived state ---

	const hasDetailsChanges = $derived(
		name.trim() !== series.name || (description.trim() || null) !== (series.description ?? null)
	);

	const anyMutationPending = $derived(
		updateDetailsMutation.isPending ||
			uploadLogoMutation.isPending ||
			deleteLogoMutation.isPending ||
			uploadCoverMutation.isPending ||
			deleteCoverMutation.isPending ||
			addTagMutation.isPending ||
			removeTagMutation.isPending
	);

	// --- Handlers ---

	function handleSaveDetails(e: Event): void {
		e.preventDefault();
		if (!name.trim()) {
			updateError = m['eventSeriesEditPage.error_nameRequired']();
			return;
		}
		updateDetailsMutation.mutate();
	}

	function handleLogoSelect(file: File | null): void {
		if (!file) return;
		uploadLogoMutation.mutate(file);
	}

	function handleLogoDelete(): void {
		if (!logoUrl) return;
		deleteLogoMutation.mutate();
	}

	function handleCoverSelect(file: File | null): void {
		if (!file) return;
		uploadCoverMutation.mutate(file);
	}

	function handleCoverDelete(): void {
		if (!coverArtUrl) return;
		deleteCoverMutation.mutate();
	}

	function handleAddTag(): void {
		const trimmed = newTag.trim();
		if (!trimmed) return;
		addTagError = null;
		addTagMutation.mutate(trimmed);
	}

	function handleRemoveTag(tag: string): void {
		removeTagMutation.mutate(tag);
	}

	function handleClose(): void {
		if (anyMutationPending) return;
		onClose();
	}
</script>

<Dialog bind:open onOpenChange={(isOpen) => !isOpen && handleClose()}>
	<DialogContent
		class="max-h-[90vh] max-w-2xl overflow-y-auto"
		data-testid="series-settings-dialog"
	>
		<DialogHeader>
			<DialogTitle class="flex items-center gap-2">
				<SettingsIcon class="h-5 w-5" aria-hidden="true" />
				{m['recurringEvents.seriesSettings.title']()}
			</DialogTitle>
		</DialogHeader>

		<p class="mt-2 text-sm text-muted-foreground">
			{m['recurringEvents.seriesSettings.description']()}
		</p>

		<div class="mt-6 space-y-8">
			<!-- Basic Details -->
			<section class="space-y-4">
				<h3 class="text-sm font-semibold">
					{m['eventSeriesEditPage.basicDetails.title']()}
				</h3>
				<form onsubmit={handleSaveDetails} class="space-y-4">
					<div class="space-y-2">
						<Label for="series-settings-name">
							{m['eventSeriesEditPage.basicDetails.nameLabel']()}
							<span class="text-destructive" aria-hidden="true">*</span>
						</Label>
						<Input
							id="series-settings-name"
							type="text"
							bind:value={name}
							placeholder={m['eventSeriesEditPage.basicDetails.namePlaceholder']()}
							required
							maxlength={150}
							disabled={updateDetailsMutation.isPending}
							data-testid="series-settings-name"
						/>
					</div>

					<div class="space-y-2">
						<Label for="series-settings-description">
							{m['eventSeriesEditPage.basicDetails.descriptionLabel']()}
						</Label>
						<Textarea
							id="series-settings-description"
							bind:value={description}
							placeholder={m['eventSeriesEditPage.basicDetails.descriptionPlaceholder']()}
							rows={4}
							disabled={updateDetailsMutation.isPending}
							data-testid="series-settings-description"
						/>
					</div>

					{#if updateError}
						<div
							class="rounded-md border border-destructive bg-destructive/10 p-3 text-sm text-destructive"
							role="alert"
						>
							{updateError}
						</div>
					{/if}

					<div class="flex justify-end">
						<Button
							type="submit"
							disabled={!hasDetailsChanges || updateDetailsMutation.isPending}
							data-testid="series-settings-save-details"
						>
							{#if updateDetailsMutation.isPending}
								<Loader2 class="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
								{m['eventSeriesEditPage.basicDetails.savingButton']()}
							{:else}
								{m['recurringEvents.seriesSettings.saveButton']()}
							{/if}
						</Button>
					</div>
				</form>
			</section>

			<!-- Logo -->
			<section class="space-y-3 border-t border-border pt-6">
				<div>
					<h3 class="text-sm font-semibold">{m['eventSeriesEditPage.logo.title']()}</h3>
					<p class="mt-1 text-xs text-muted-foreground">
						{m['eventSeriesEditPage.logo.description']()}
					</p>
				</div>
				<ImageUploader
					preview={logoUrl}
					aspectRatio="square"
					label={m['eventSeriesEditPage.logo.title']()}
					disabled={uploadLogoMutation.isPending || deleteLogoMutation.isPending}
					onFileSelect={handleLogoSelect}
				/>
				{#if logoUrl}
					<div class="flex justify-end">
						<Button
							type="button"
							variant="outline"
							size="sm"
							onclick={handleLogoDelete}
							disabled={uploadLogoMutation.isPending || deleteLogoMutation.isPending}
							data-testid="series-settings-delete-logo"
						>
							{#if deleteLogoMutation.isPending}
								<Loader2 class="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
								{m['eventSeriesEditPage.logo.deletingButton']()}
							{:else}
								{m['eventSeriesEditPage.logo.deleteButton']()}
							{/if}
						</Button>
					</div>
				{/if}
			</section>

			<!-- Cover Art -->
			<section class="space-y-3 border-t border-border pt-6">
				<div>
					<h3 class="text-sm font-semibold">{m['eventSeriesEditPage.coverArt.title']()}</h3>
					<p class="mt-1 text-xs text-muted-foreground">
						{m['eventSeriesEditPage.coverArt.description']()}
					</p>
				</div>
				<ImageUploader
					preview={coverArtUrl}
					aspectRatio="wide"
					label={m['eventSeriesEditPage.coverArt.title']()}
					disabled={uploadCoverMutation.isPending || deleteCoverMutation.isPending}
					onFileSelect={handleCoverSelect}
				/>
				{#if coverArtUrl}
					<div class="flex justify-end">
						<Button
							type="button"
							variant="outline"
							size="sm"
							onclick={handleCoverDelete}
							disabled={uploadCoverMutation.isPending || deleteCoverMutation.isPending}
							data-testid="series-settings-delete-cover"
						>
							{#if deleteCoverMutation.isPending}
								<Loader2 class="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
								{m['eventSeriesEditPage.coverArt.deletingButton']()}
							{:else}
								{m['eventSeriesEditPage.coverArt.deleteButton']()}
							{/if}
						</Button>
					</div>
				{/if}
			</section>

			<!-- Tags -->
			<section class="space-y-3 border-t border-border pt-6">
				<div>
					<h3 class="text-sm font-semibold">{m['eventSeriesEditPage.tags.title']()}</h3>
					<p class="mt-1 text-xs text-muted-foreground">
						{m['eventSeriesEditPage.tags.description']()}
					</p>
				</div>

				{#if tags.length > 0}
					<div class="flex flex-wrap gap-2" data-testid="series-settings-tags">
						{#each tags as tag (tag)}
							<Badge variant="secondary" class="gap-2">
								<TagIcon class="h-3 w-3" aria-hidden="true" />
								<span>{tag}</span>
								<button
									type="button"
									onclick={() => handleRemoveTag(tag)}
									disabled={removeTagMutation.isPending}
									class="ml-1 rounded-sm hover:bg-destructive hover:text-destructive-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:opacity-50"
									aria-label={m['eventSeriesEditPage.tags.removeAriaLabel']({ tag })}
								>
									<Trash2 class="h-3 w-3" aria-hidden="true" />
								</button>
							</Badge>
						{/each}
					</div>
				{:else}
					<p class="text-sm text-muted-foreground">
						{m['eventSeriesEditPage.tags.empty']()}
					</p>
				{/if}

				<div class="flex gap-2">
					<Input
						type="text"
						bind:value={newTag}
						placeholder={m['eventSeriesEditPage.tags.placeholder']()}
						disabled={addTagMutation.isPending}
						data-testid="series-settings-tag-input"
						onkeydown={(e: KeyboardEvent) => {
							if (e.key === 'Enter') {
								e.preventDefault();
								handleAddTag();
							}
						}}
					/>
					<Button
						type="button"
						onclick={handleAddTag}
						disabled={!newTag.trim() || addTagMutation.isPending}
						data-testid="series-settings-add-tag"
					>
						{#if addTagMutation.isPending}
							<Loader2 class="h-4 w-4 animate-spin" aria-hidden="true" />
						{:else}
							{m['eventSeriesEditPage.tags.addButton']()}
						{/if}
					</Button>
				</div>

				{#if addTagError}
					<div
						class="rounded-md border border-destructive bg-destructive/10 p-3 text-sm text-destructive"
						role="alert"
					>
						{addTagError}
					</div>
				{/if}
			</section>
		</div>

		<div class="mt-6 flex justify-end gap-2 border-t border-border pt-4">
			<Button
				type="button"
				variant="outline"
				onclick={handleClose}
				disabled={anyMutationPending}
				data-testid="series-settings-close"
			>
				{m['recurringEvents.seriesSettings.cancelButton']()}
			</Button>
		</div>
	</DialogContent>
</Dialog>
