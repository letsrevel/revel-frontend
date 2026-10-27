<script lang="ts">
	import { resolve } from '$app/paths';
	import { invalidateAll } from '$app/navigation';
	import { createMutation } from '@tanstack/svelte-query';
	import { CheckCircle2, EyeOff } from '@lucide/svelte';
	import * as m from '$lib/paraglide/messages.js';
	import { Button } from '$lib/components/ui/button';
	import { organizationadmincoreUpdateOrganization } from '$lib/api/generated/sdk.gen';
	import type { Visibility } from '$lib/api/generated/types.gen';

	interface Props {
		orgSlug: string;
		visibility: Visibility;
		accessToken: string;
		density?: 'full' | 'compact';
	}

	const { orgSlug, visibility, accessToken, density = 'full' }: Props = $props();

	// Mirrors the backend's hidden set; members-only/unlisted are deliberate choices.
	const HIDDEN: ReadonlySet<Visibility> = new Set<Visibility>(['private', 'staff-only']);

	/** Set only after a successful flip in this session; holds the value to undo to. */
	let flippedFrom = $state<Visibility | null>(null);
	let errorMessage = $state<string | null>(null);

	const publicPath = $derived(resolve('/(public)/org/[slug]', { slug: orgSlug }));
	const publicUrl = $derived(
		(typeof window === 'undefined' ? '' : window.location.origin) + publicPath
	);

	const update = createMutation(() => ({
		mutationFn: async (next: Visibility) => {
			// Body carries `visibility` ONLY: the backend applies exclude_unset.
			const res = await organizationadmincoreUpdateOrganization({
				path: { slug: orgSlug },
				headers: { Authorization: `Bearer ${accessToken}` },
				body: { visibility: next }
			});
			if (res.error) throw new Error(m['orgSetup.visibility.error']());
			return next;
		}
	}));

	async function makePublic(): Promise<void> {
		errorMessage = null;
		const previous = visibility;
		try {
			await update.mutateAsync('public');
		} catch {
			errorMessage = m['orgSetup.visibility.error']();
			return;
		}
		flippedFrom = previous;
		await invalidateAll();
	}

	async function undo(): Promise<void> {
		const target = flippedFrom;
		if (!target) return;
		errorMessage = null;
		try {
			await update.mutateAsync(target);
		} catch {
			errorMessage = m['orgSetup.visibility.error']();
			return;
		}
		flippedFrom = null;
		await invalidateAll();
	}

	const hidden = $derived(HIDDEN.has(visibility));
	const compact = $derived(density === 'compact');
</script>

{#if flippedFrom !== null}
	<div
		role="status"
		class="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-success bg-card p-4"
	>
		<p class="flex items-center gap-2 text-sm font-semibold">
			<CheckCircle2 class="h-5 w-5 shrink-0 text-success" aria-hidden="true" />
			<span class="break-all">
				{m['orgSetup.visibility.done']({ url: publicUrl })}
			</span>
		</p>
		<Button
			type="button"
			variant="outline"
			class="min-h-[44px]"
			disabled={update.isPending}
			onclick={undo}
		>
			{m['orgSetup.visibility.undo']()}
		</Button>
	</div>
	{#if errorMessage}
		<p role="alert" class="mt-2 text-sm text-destructive">{errorMessage}</p>
	{/if}
{:else if hidden}
	<div
		class="flex flex-col gap-3 rounded-xl border-2 border-highlight bg-card p-4 sm:flex-row sm:items-center sm:justify-between"
	>
		<div class="flex items-start gap-3">
			<span
				class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-highlight text-highlight-foreground"
				aria-hidden="true"
			>
				<EyeOff class="h-5 w-5" />
			</span>
			<div>
				<h3 class="font-bold">{m['orgSetup.visibility.title']()}</h3>
				{#if !compact}
					<p class="mt-1 text-sm text-muted-foreground">{m['orgSetup.visibility.body']()}</p>
				{/if}
			</div>
		</div>
		<Button
			type="button"
			class="min-h-[44px] shrink-0"
			disabled={update.isPending}
			onclick={makePublic}
		>
			{m['orgSetup.visibility.cta']()}
		</Button>
	</div>
	{#if errorMessage}
		<p role="alert" class="mt-2 text-sm text-destructive">{errorMessage}</p>
	{/if}
{/if}
