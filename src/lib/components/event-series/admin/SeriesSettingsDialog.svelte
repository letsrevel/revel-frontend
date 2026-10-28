<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { createMutation, createQuery, useQueryClient } from '@tanstack/svelte-query';
	import { Dialog, DialogContent, DialogHeader, DialogTitle } from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import ImageUploader from '$lib/components/forms/ImageUploader.svelte';
	import MarkdownEditor from '$lib/components/forms/MarkdownEditor.svelte';
	import DetailsStepTagsInput from '$lib/components/events/admin/DetailsStepTagsInput.svelte';
	import { COVER_ASPECT_RATIO, LOGO_ASPECT_RATIO } from '$lib/utils/image-crop';
	import { getImageUrl } from '$lib/utils/url';
	import { Loader2, Settings as SettingsIcon } from '@lucide/svelte';
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

	let { open = $bindable(), series, organizationSlug, accessToken, onClose }: Props = $props();

	const queryClient = useQueryClient();

	// Neutral defaults — the open effect below seeds from `series`. Keeps
	// Svelte's static analyser from flagging the prop capture as
	// `state_referenced_locally` (the prop is stable across the component's
	// life but the analyser doesn't know that).
	let name = $state('');
	let description = $state('');
	// Tag draft + autocomplete state, bound into the shared event tag input.
	let tagInput = $state('');
	let tagSuggestions = $state<string[]>([]);
	let showSuggestions = $state(false);
	let selectedSuggestionIndex = $state(-1);
	let updateError = $state<string | null>(null);
	let addTagError = $state<string | null>(null);

	// Re-sync form fields any time the dialog is re-opened or the server state
	// changes underneath us. Also handles the initial seed on first open.
	$effect(() => {
		if (open) {
			name = series.name;
			description = series.description ?? '';
			tagInput = '';
			tagSuggestions = [];
			showSuggestions = false;
			selectedSuggestionIndex = -1;
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
	// Media fields are backend-relative paths; resolve them like every other preview.
	const logoUrl = $derived(getImageUrl(publicSeries?.logo) ?? null);
	const coverArtUrl = $derived(getImageUrl(publicSeries?.cover_art) ?? null);
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

	// The shared tag input reports the full next list; series tags are
	// persisted one add/remove call at a time, so diff against server state.
	function handleTagsUpdate({ tags: next }: { tags: string[] }): void {
		for (const tag of next.filter((t) => !tags.includes(t))) {
			addTagError = null;
			addTagMutation.mutate(tag);
		}
		for (const tag of tags.filter((t) => !next.includes(t))) {
			removeTagMutation.mutate(tag);
		}
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

					<MarkdownEditor
						bind:value={description}
						id="series-settings-description"
						label={m['eventSeriesEditPage.basicDetails.descriptionLabel']()}
						placeholder={m['eventSeriesEditPage.basicDetails.descriptionPlaceholder']()}
						rows={8}
						disabled={updateDetailsMutation.isPending}
					/>

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
					crop
					cropAspectRatio={LOGO_ASPECT_RATIO}
					cropShape="rect"
					cropOutputFormat="image/png"
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
					crop
					cropAspectRatio={COVER_ASPECT_RATIO}
					cropShape="rect"
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
				<DetailsStepTagsInput
					{tags}
					bind:tagInput
					bind:tagSuggestions
					bind:showSuggestions
					bind:selectedSuggestionIndex
					onUpdate={handleTagsUpdate}
				/>
				<p class="text-xs text-muted-foreground">
					{m['eventSeriesEditPage.tags.description']()}
				</p>

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
