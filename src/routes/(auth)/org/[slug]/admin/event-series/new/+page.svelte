<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import type { PageData } from './$types';
	import { authStore } from '$lib/stores/auth.svelte';
	import { ArrowLeft, Loader2 } from 'lucide-svelte';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Textarea } from '$lib/components/ui/textarea';
	import { organizationadmincoreCreateEventSeries } from '$lib/api/generated';

	let { data }: { data: PageData } = $props();

	const organization = $derived($page.data.organization);
	const accessToken = $derived(authStore.accessToken);

	// Form state
	let name = $state('');
	let description = $state('');
	let isSubmitting = $state(false);
	let error = $state<string | null>(null);

	/**
	 * Navigate back to series list
	 */
	function goBack(): void {
		goto(`/org/${organization.slug}/admin/event-series`);
	}

	/**
	 * Handle form submission
	 */
	async function handleSubmit(e: Event) {
		e.preventDefault();

		if (!accessToken) {
			error = m['eventSeriesNewPage.error_notLoggedIn']();
			return;
		}

		if (!name.trim()) {
			error = m['eventSeriesNewPage.error_nameRequired']();
			return;
		}

		isSubmitting = true;
		error = null;

		try {
			const response = await organizationadmincoreCreateEventSeries({
				path: { slug: organization.slug },
				body: {
					name: name.trim(),
					description: description.trim() || undefined
				},
				headers: { Authorization: `Bearer ${accessToken}` }
			});

			if (response.error) {
				const errorDetail =
					typeof response.error === 'object' &&
					response.error !== null &&
					'detail' in response.error
						? (response.error.detail as string)
						: m['eventSeriesNewPage.error_createFailed']();
				throw new Error(errorDetail);
			}

			if (!response.data) {
				throw new Error(m['eventSeriesNewPage.error_createFailed']());
			}

			// Navigate to the edit page for the newly created series
			goto(`/org/${organization.slug}/admin/event-series/${response.data.id}/edit`);
		} catch (err) {
			console.error('Failed to create series:', err);
			error = err instanceof Error ? err.message : m['eventSeriesNewPage.error_createFailed']();
		} finally {
			isSubmitting = false;
		}
	}
</script>

<svelte:head>
	<title>{m['eventSeriesNewPage.pageTitle']()} - {organization.name} Admin | Revel</title>
	<meta
		name="description"
		content={m['eventSeriesNewPage.pageDescription']({ organizationName: organization.name })}
	/>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<div class="space-y-6">
	<!-- Header with Back Button -->
	<div class="flex items-center gap-4">
		<button
			type="button"
			onclick={goBack}
			class="rounded-md p-2 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
			aria-label={m['eventSeriesNewPage.backAriaLabel']()}
		>
			<ArrowLeft class="h-5 w-5" aria-hidden="true" />
		</button>
		<div class="flex-1">
			<h1 class="text-2xl font-bold tracking-tight md:text-3xl">
				{m['eventSeriesNewPage.title']()}
			</h1>
			<p class="mt-1 text-sm text-muted-foreground">
				{m['eventSeriesNewPage.subtitle']({ organizationName: organization.name })}
			</p>
		</div>
	</div>

	<!-- Form -->
	<form onsubmit={handleSubmit} class="space-y-6">
		<div class="rounded-lg border border-border bg-card p-6 shadow-sm">
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
						placeholder={m['eventSeriesNewPage.namePlaceholder']()}
						required
						maxlength={150}
						disabled={isSubmitting}
					/>
					<p class="text-xs text-muted-foreground">
						{m['eventSeriesNewPage.nameHelp']()}
					</p>
				</div>

				<!-- Description Field -->
				<div class="space-y-2">
					<Label for="description">{m['eventSeriesNewPage.descriptionLabel']()}</Label>
					<Textarea
						id="description"
						bind:value={description}
						placeholder={m['eventSeriesNewPage.descriptionPlaceholder']()}
						rows={4}
						disabled={isSubmitting}
					/>
					<p class="text-xs text-muted-foreground">
						{m['eventSeriesNewPage.descriptionHelp']()}
					</p>
				</div>
			</div>
		</div>

		<!-- Error Message -->
		{#if error}
			<div class="rounded-lg border border-destructive bg-destructive/10 p-4">
				<p class="text-sm font-medium text-destructive">{error}</p>
			</div>
		{/if}

		<!-- Form Actions -->
		<div class="flex items-center justify-end gap-3">
			<Button type="button" variant="outline" onclick={goBack} disabled={isSubmitting}>
				{m['eventSeriesNewPage.cancelButton']()}
			</Button>
			<Button type="submit" disabled={isSubmitting || !name.trim()}>
				{#if isSubmitting}
					<Loader2 class="h-4 w-4 animate-spin" aria-hidden="true" />
					{m['eventSeriesNewPage.creatingButton']()}
				{:else}
					{m['eventSeriesNewPage.createButton']()}
				{/if}
			</Button>
		</div>
	</form>
</div>

<style>
	/* Ensure consistent focus states for accessibility */
	:global(button:focus-visible) {
		outline: 2px solid hsl(var(--ring));
		outline-offset: 2px;
	}
</style>
