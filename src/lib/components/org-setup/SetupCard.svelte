<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { Check, Circle } from '@lucide/svelte';
	import * as m from '$lib/paraglide/messages.js';
	import { Button } from '$lib/components/ui/button';
	import SetupActions from './SetupActions.svelte';
	import VisibilityStrip from './VisibilityStrip.svelte';
	import { shouldShowSetupCard, type SetupProgress } from '$lib/utils/org-setup-progress';
	import type { Visibility } from '$lib/api/generated/types.gen';

	interface Props {
		orgId: string;
		orgSlug: string;
		progress: SetupProgress;
		visibility: Visibility;
		defaultStripeEmail: string;
		accessToken: string;
		/** Whether the user collapsed the card; bindable so the page can react. */
		hidden?: boolean;
	}

	let {
		orgId,
		orgSlug,
		progress,
		visibility,
		defaultStripeEmail,
		accessToken,
		hidden = $bindable(false)
	}: Props = $props();

	const storageKey = $derived(`revel:org-setup-hidden:${orgId}`);

	// SSR renders the card shown; the stored preference is applied after mount.
	let showButton = $state<HTMLElement | null>(null);
	let hideButton = $state<HTMLElement | null>(null);

	onMount(() => {
		try {
			if (localStorage.getItem(storageKey) === '1') hidden = true;
		} catch {
			// Storage unavailable (private mode): keep the card shown.
		}
	});

	async function setHidden(next: boolean): Promise<void> {
		hidden = next;
		try {
			if (next) localStorage.setItem(storageKey, '1');
			else localStorage.removeItem(storageKey);
		} catch {
			// Preference lasts for this session only.
		}
		// The clicked button unmounts; move focus to its counterpart.
		await tick();
		(next ? showButton : hideButton)?.focus();
	}

	const headline = $derived(
		progress.event === 'none'
			? m['orgSetup.card.headline.start']()
			: progress.event === 'draft'
				? m['orgSetup.card.headline.publish']()
				: progress.stripe !== 'ready'
					? m['orgSetup.card.headline.payments']()
					: m['orgSetup.card.headline.visibility']()
	);

	const steps = $derived([
		{ id: 'created', label: m['orgSetup.steps.created'](), done: true },
		{ id: 'public', label: m['orgSetup.steps.public'](), done: !progress.pageHidden },
		{ id: 'event', label: m['orgSetup.steps.event'](), done: progress.event !== 'none' },
		{
			id: 'published',
			label: m['orgSetup.steps.published'](),
			done: progress.event === 'published'
		},
		{ id: 'stripe', label: m['orgSetup.steps.stripe'](), done: progress.stripe === 'ready' }
	]);
</script>

{#if shouldShowSetupCard(progress)}
	{#if hidden}
		<div
			class="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-card px-4 py-2 text-sm text-muted-foreground"
		>
			<p>{m['orgSetup.card.hidden']()}</p>
			<Button
				bind:ref={showButton}
				variant="ghost"
				size="sm"
				class="min-h-[44px]"
				onclick={() => setHidden(false)}
			>
				{m['orgSetup.card.show']()}
			</Button>
		</div>
	{:else}
		<section
			class="space-y-4 rounded-lg border bg-card p-4 md:p-6"
			aria-labelledby="org-setup-card-title"
			data-testid="org-setup-card"
		>
			<div class="flex flex-wrap items-start justify-between gap-3">
				<div class="min-w-0">
					<p class="text-xs font-extrabold uppercase tracking-[0.12em] text-muted-foreground">
						{m['orgSetup.card.kicker']({ done: progress.doneCount, total: progress.total })}
					</p>
					<h2 id="org-setup-card-title" class="mt-1 text-lg font-bold">{headline}</h2>
				</div>
				<Button
					bind:ref={hideButton}
					variant="ghost"
					size="sm"
					class="min-h-[44px]"
					onclick={() => setHidden(true)}
				>
					{m['orgSetup.card.hide']()}
				</Button>
			</div>

			<div
				role="progressbar"
				aria-label={m['orgSetup.card.progress']()}
				aria-valuenow={progress.doneCount}
				aria-valuemin={0}
				aria-valuemax={progress.total}
				aria-valuetext={m['orgSetup.card.progressValue']({
					done: progress.doneCount,
					total: progress.total
				})}
				class="h-2 overflow-hidden rounded-full bg-muted"
			>
				<div
					class="h-full rounded-full bg-primary transition-[width]"
					style="width: {(progress.doneCount / progress.total) * 100}%"
				></div>
			</div>

			<ul class="flex flex-wrap gap-x-6 gap-y-2 text-sm">
				{#each steps as step (step.id)}
					<li
						class="flex items-center gap-2 whitespace-nowrap py-1 {step.done
							? ''
							: 'text-muted-foreground'}"
					>
						{#if step.done}
							<Check class="h-4 w-4 shrink-0 text-success" aria-hidden="true" />
						{:else}
							<Circle class="h-4 w-4 shrink-0" aria-hidden="true" />
						{/if}
						<span>{step.label}</span>
						<span class="sr-only"
							>, {step.done ? m['orgSetup.steps.done']() : m['orgSetup.steps.toDo']()}</span
						>
					</li>
				{/each}
			</ul>

			<SetupActions {orgSlug} {progress} {defaultStripeEmail} {accessToken} density="compact" />
			<VisibilityStrip {orgSlug} {visibility} {accessToken} density="compact" />
		</section>
	{/if}
{/if}
