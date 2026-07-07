<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { cn } from '$lib/utils/cn';
	import { Pencil, Check, X, Link, Loader2 } from '@lucide/svelte';
	import { createMutation } from '@tanstack/svelte-query';
	import { eventadmincoreEditSlug } from '$lib/api/generated/sdk.gen';
	import { authStore } from '$lib/stores/auth.svelte';

	interface Props {
		eventId?: string;
		eventSlug?: string;
		organizationSlug?: string;
		onSlugUpdated?: (newSlug: string) => void;
	}

	const { eventId, eventSlug, organizationSlug, onSlugUpdated }: Props = $props();

	const accessToken = $derived(authStore.accessToken);

	// Slug editing state
	let isEditingSlug = $state(false);
	let editedSlug = $state('');
	let slugError = $state<string | null>(null);

	// Derived current slug (updates when editing is saved)
	let currentSlug = $state(eventSlug || '');

	// Update currentSlug when eventSlug prop changes
	$effect(() => {
		if (eventSlug) {
			currentSlug = eventSlug;
		}
	});

	// Start editing slug
	function startEditingSlug(): void {
		editedSlug = currentSlug;
		slugError = null;
		isEditingSlug = true;
	}

	// Cancel editing slug
	function cancelEditingSlug(): void {
		isEditingSlug = false;
		editedSlug = '';
		slugError = null;
	}

	// Slug update mutation
	const updateSlugMutation = createMutation(() => ({
		mutationFn: async (newSlug: string) => {
			if (!accessToken || !eventId) throw new Error(m['essentialsStep.error_notAuthenticated']());

			const response = await eventadmincoreEditSlug({
				path: { event_id: eventId },
				body: { slug: newSlug },
				headers: {
					Authorization: `Bearer ${accessToken}`
				}
			});

			if (response.error) {
				const errorDetail =
					typeof response.error === 'object' &&
					response.error !== null &&
					'detail' in response.error
						? (response.error.detail as string)
						: m['essentialsStep.error_slugUpdateFailed']();
				throw new Error(errorDetail);
			}

			if (!response.data) {
				throw new Error(m['essentialsStep.error_slugUpdateFailed']());
			}

			return response.data;
		},
		onSuccess: (data) => {
			currentSlug = data.slug;
			isEditingSlug = false;
			editedSlug = '';
			slugError = null;
			onSlugUpdated?.(data.slug);
		},
		onError: (error: Error) => {
			// Check for slug collision error
			if (error.message.includes('already exists')) {
				slugError = m['essentialsStep.error_slugExists']();
			} else {
				slugError = error.message;
			}
		}
	}));

	// Save slug
	function saveSlug(): void {
		slugError = null;

		// Validate slug format
		const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
		if (!editedSlug.trim()) {
			slugError = m['essentialsStep.error_slugRequired']();
			return;
		}

		if (!slugPattern.test(editedSlug.trim())) {
			slugError = m['essentialsStep.error_slugFormat']();
			return;
		}

		// No change
		if (editedSlug.trim() === currentSlug) {
			isEditingSlug = false;
			return;
		}

		updateSlugMutation.mutate(editedSlug.trim());
	}

	// Generate event URL preview
	const eventUrlPreview = $derived.by(() => {
		if (!organizationSlug) return '';
		const slug = isEditingSlug ? editedSlug : currentSlug;
		return `/events/${organizationSlug}/${slug || 'your-event-slug'}`;
	});
</script>

<!-- Event Slug (only in edit mode) -->
<div class="space-y-2">
	<label for="event-slug" class="block text-sm font-medium">
		<span class="flex items-center gap-2">
			<Link class="h-4 w-4" aria-hidden="true" />
			{m['essentialsStep.slugLabel']()}
		</span>
	</label>

	{#if isEditingSlug}
		<!-- Editing mode -->
		<div class="flex gap-2">
			<input
				id="event-slug"
				type="text"
				bind:value={editedSlug}
				placeholder={m['essentialsStep.slugPlaceholder']()}
				disabled={updateSlugMutation.isPending}
				aria-invalid={!!slugError}
				aria-describedby={slugError ? 'event-slug-error' : 'event-slug-hint'}
				class={cn(
					'flex h-10 flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm transition-colors placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
					slugError && 'border-destructive'
				)}
			/>
			<button
				type="button"
				onclick={saveSlug}
				disabled={updateSlugMutation.isPending}
				class="inline-flex items-center justify-center rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
				aria-label={m['essentialsStep.saveSlug']()}
			>
				{#if updateSlugMutation.isPending}
					<Loader2 class="h-4 w-4 animate-spin" aria-hidden="true" />
				{:else}
					<Check class="h-4 w-4" aria-hidden="true" />
				{/if}
			</button>
			<button
				type="button"
				onclick={cancelEditingSlug}
				disabled={updateSlugMutation.isPending}
				class="inline-flex items-center justify-center rounded-md border border-input bg-background px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
				aria-label={m['essentialsStep.cancelSlugEdit']()}
			>
				<X class="h-4 w-4" aria-hidden="true" />
			</button>
		</div>
	{:else}
		<!-- Read-only mode -->
		<div class="flex gap-2">
			<div
				class="flex h-10 flex-1 items-center rounded-md border border-input bg-muted/50 px-3 py-2 text-sm text-muted-foreground"
			>
				{currentSlug || m['essentialsStep.noSlug']()}
			</div>
			<button
				type="button"
				onclick={startEditingSlug}
				class="inline-flex items-center justify-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
				aria-label={m['essentialsStep.editSlug']()}
			>
				<Pencil class="h-4 w-4" aria-hidden="true" />
				{m['essentialsStep.edit']()}
			</button>
		</div>
	{/if}

	{#if slugError}
		<p id="event-slug-error" class="text-sm text-destructive" role="alert">
			{slugError}
		</p>
	{/if}

	<!-- URL Preview -->
	<p id="event-slug-hint" class="text-xs text-muted-foreground">
		{m['essentialsStep.urlPreview']()}
		<code class="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
			{eventUrlPreview}
		</code>
	</p>
</div>
