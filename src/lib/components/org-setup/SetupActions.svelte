<script lang="ts">
	import { resolve } from '$app/paths';
	import { browser } from '$app/environment';
	import { createMutation } from '@tanstack/svelte-query';
	import { CalendarPlus, CheckCircle2, CreditCard, Clock, Sparkles } from '@lucide/svelte';
	import * as m from '$lib/paraglide/messages.js';
	import { Button } from '$lib/components/ui/button';
	import ToneTile from '$lib/components/common/ToneTile.svelte';
	import StripeConnectModal from '$lib/components/organization/StripeConnectModal.svelte';
	import { requestStripeOnboardingLink } from '$lib/components/organization/stripe-connect';
	import type { SetupProgress } from '$lib/utils/org-setup-progress';

	interface Props {
		orgSlug: string;
		progress: SetupProgress;
		defaultStripeEmail: string;
		accessToken: string;
		density?: 'full' | 'compact';
	}

	const { orgSlug, progress, defaultStripeEmail, accessToken, density = 'full' }: Props = $props();

	const full = $derived(density === 'full');

	const newEventHref = $derived(resolve('/(auth)/org/[slug]/admin/events/new', { slug: orgSlug }));
	const draftEditHref = $derived(
		progress.latestDraft
			? resolve('/(auth)/org/[slug]/admin/events/[event_id]/edit', {
					slug: orgSlug,
					event_id: progress.latestDraft.id
				})
			: newEventHref
	);

	const billingHref = $derived(resolve('/(auth)/org/[slug]/admin/billing', { slug: orgSlug }));
	const needsBilling = $derived(progress.stripe === 'needs-billing');

	let showModal = $state(false);
	let modalError = $state<string | null>(null);

	const connect = createMutation(() => ({
		mutationFn: (email: string) => requestStripeOnboardingLink(orgSlug, email, accessToken),
		onSuccess: (url: string) => {
			window.location.href = url;
		},
		onError: (error: Error) => {
			modalError = error.message;
		}
	}));

	function openModal(): void {
		modalError = null;
		showModal = true;
	}

	function closeModal(): void {
		showModal = false;
		modalError = null;
	}

	function confirm(email: string): void {
		modalError = null;
		connect.mutate(email);
	}
</script>

<div class="grid gap-4 md:grid-cols-2">
	<!-- Event box -->
	<section
		class="relative flex flex-col gap-3 rounded-2xl bg-card p-5 {progress.event === 'published'
			? 'border border-success'
			: 'border-2 border-primary'}"
		aria-labelledby="setup-event-title"
	>
		{#if full && progress.event === 'none'}
			<span
				class="absolute -top-3 left-4 rounded-full bg-primary px-3 py-0.5 text-xs font-extrabold uppercase tracking-[0.12em] text-primary-foreground"
			>
				{m['orgSetup.event.startHere']()}
			</span>
		{/if}
		<div class="flex items-start gap-3">
			<ToneTile
				tone={progress.event === 'published' ? 'success' : 'brand'}
				icon={progress.event === 'published' ? CheckCircle2 : CalendarPlus}
			/>
			<div class="min-w-0">
				<h3 id="setup-event-title" class="font-bold">
					{#if progress.event === 'published'}
						{m['orgSetup.event.doneTitle']()}
					{:else if progress.event === 'draft' && progress.latestDraft}
						{m['orgSetup.event.publishTitle']({ name: progress.latestDraft.name })}
					{:else}
						{m['orgSetup.event.title']()}
					{/if}
				</h3>
				{#if progress.event === 'none'}
					<p class="mt-1 text-sm text-muted-foreground">{m['orgSetup.event.body']()}</p>
				{:else if progress.event === 'draft'}
					<p class="mt-1 text-sm text-muted-foreground">{m['orgSetup.event.publishBody']()}</p>
				{/if}
			</div>
		</div>

		{#if progress.event !== 'published'}
			{#if full && progress.event === 'none'}
				<ul class="space-y-1 text-sm text-muted-foreground">
					<li class="flex items-center gap-2">
						<Sparkles class="h-4 w-4 shrink-0" aria-hidden="true" />
						{m['orgSetup.event.freeWorks']()}
					</li>
					<li class="flex items-center gap-2">
						<Clock class="h-4 w-4 shrink-0" aria-hidden="true" />
						{m['orgSetup.event.duration']()}
					</li>
				</ul>
			{/if}
			<Button
				href={progress.event === 'draft' ? draftEditHref : newEventHref}
				class="mt-auto min-h-[44px]"
			>
				{progress.event === 'draft' ? m['orgSetup.event.publishCta']() : m['orgSetup.event.cta']()}
			</Button>
		{/if}
	</section>

	<!-- Stripe box -->
	<section
		class="flex flex-col gap-3 rounded-2xl border bg-card p-5 {progress.stripe === 'ready'
			? 'border-success'
			: 'border-border'}"
		aria-labelledby="setup-stripe-title"
	>
		<div class="flex items-start gap-3">
			<ToneTile
				tone={progress.stripe === 'ready' ? 'success' : 'info'}
				icon={progress.stripe === 'ready' ? CheckCircle2 : CreditCard}
			/>
			<div class="min-w-0">
				<h3 id="setup-stripe-title" class="font-bold">
					{needsBilling ? m['orgSetup.stripe.billingTitle']() : m['orgSetup.stripe.title']()}
				</h3>
				<p class="mt-1 text-sm text-muted-foreground">
					{#if progress.stripe === 'ready'}
						{m['orgSetup.stripe.done']()}
					{:else if needsBilling}
						{m['orgSetup.stripe.billingBody']()}
					{:else}
						{m['orgSetup.stripe.body']()}
					{/if}
				</p>
			</div>
		</div>

		{#if needsBilling}
			<Button href={billingHref} variant="outline" class="mt-auto min-h-[44px]">
				{m['orgSetup.stripe.billingCta']()}
			</Button>
		{:else if progress.stripe !== 'ready'}
			{#if full}
				<p class="flex items-center gap-2 text-sm text-muted-foreground">
					<Clock class="h-4 w-4 shrink-0" aria-hidden="true" />
					{m['orgSetup.stripe.duration']()}
				</p>
			{/if}
			<Button
				type="button"
				variant="outline"
				class="mt-auto min-h-[44px]"
				onclick={openModal}
				disabled={!browser}
			>
				{progress.stripe === 'incomplete'
					? m['orgSetup.stripe.finishCta']()
					: m['orgSetup.stripe.cta']()}
			</Button>
		{/if}
	</section>
</div>

<StripeConnectModal
	bind:show={showModal}
	initialEmail={defaultStripeEmail}
	isLoading={connect.isPending}
	error={modalError}
	onConfirm={confirm}
	onCancel={closeModal}
/>
