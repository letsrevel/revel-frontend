<script lang="ts">
	import { resolve } from '$app/paths';
	import { invalidateAll } from '$app/navigation';
	import { onMount } from 'svelte';
	import { SvelteURLSearchParams } from 'svelte/reactivity';
	import { CheckCircle2, AlertTriangle, X } from '@lucide/svelte';
	import { organizationadmincoreStripeAccountVerify } from '$lib/api/generated/sdk.gen';
	import { Button } from '$lib/components/ui/button';
	import * as m from '$lib/paraglide/messages.js';
	import { authStore } from '$lib/stores/auth.svelte';
	import PageHeader from '$lib/components/common/PageHeader.svelte';
	import Sticker from '$lib/components/brand/Sticker.svelte';
	import SetupActions from '$lib/components/org-setup/SetupActions.svelte';
	import VisibilityStrip from '$lib/components/org-setup/VisibilityStrip.svelte';
	import { buildSetupProgress } from '$lib/utils/org-setup-progress';
	import type { PageData } from './$types';

	interface Props {
		data: PageData;
	}

	const { data }: Props = $props();

	// Layout data is merged into `data`, so it refreshes after invalidateAll().
	const organization = $derived(data.organization);
	const progress = $derived(buildSetupProgress(organization, data.setupCounts));
	const accessToken = $derived(authStore.accessToken ?? '');

	const headline = $derived(
		progress.event === 'none'
			? m['orgSetup.welcome.title']()
			: progress.event === 'draft'
				? m['orgSetup.welcome.titleDraft']()
				: m['orgSetup.welcome.titlePublished']()
	);

	type StripeNotice = 'connected' | 'needsDetails' | 'expired';
	let notice = $state<StripeNotice | null>(null);
	let setupActions: SetupActions | undefined = $state();

	// Stripe sends the owner back here with ?stripe_success=true (or
	// ?stripe_refresh=true when the onboarding link expired). Same client-side
	// handling and raw history API as StripeConnect.svelte on the settings page.
	onMount(() => {
		const params = new SvelteURLSearchParams(window.location.search);
		const success = params.get('stripe_success') === 'true';
		const refresh = params.get('stripe_refresh') === 'true';
		if (!success && !refresh) return;
		params.delete('stripe_success');
		params.delete('stripe_refresh');
		const query = params.toString();
		window.history.replaceState(
			window.history.state,
			'',
			window.location.pathname + (query ? `?${query}` : '')
		);

		if (refresh) {
			notice = 'expired';
			return;
		}
		void (async () => {
			let chargesEnabled: boolean;
			try {
				const res = await organizationadmincoreStripeAccountVerify({
					path: { slug: organization.slug },
					headers: { Authorization: `Bearer ${accessToken}` }
				});
				chargesEnabled = !res.error && !!res.data?.charges_enabled;
			} catch {
				chargesEnabled = false;
			}
			await invalidateAll();
			notice = chargesEnabled ? 'connected' : 'needsDetails';
		})();
	});

	const linkClass =
		'inline-flex min-h-[44px] items-center underline underline-offset-2 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-sm';
</script>

<svelte:head>
	<title>{m['orgSetup.welcome.pageTitle']({ name: organization.name })} | Revel</title>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<!-- Celebration band inside the admin shell (the layout supplies the container,
     sidebar and <main>): a rounded `bg-secondary` panel, an audit-enforced pair
     in both modes, with PageHeader's `onBand` keeping the kicker/subtitle AA on
     it. The body is pulled up with -mt-12 onto an OPAQUE `bg-card` shell
     (pull-up opacity rule), inset from the panel's sides so it overlaps the
     bottom edge inside the rounded corners, never onto translucent blocks. -->
<div class="px-4 md:px-0">
	<section
		class="rounded-lg bg-secondary px-4 pb-20 pt-10 text-center text-secondary-foreground sm:pt-14"
	>
		<div class="mx-auto max-w-3xl">
			<Sticker rotate={-2} class="mb-5 text-base">
				{m['orgSetup.welcome.sticker']({ name: organization.name })}
			</Sticker>
			<PageHeader
				volume="poster"
				onBand
				kicker={m['orgSetup.welcome.kicker']()}
				title={headline}
				subtitle={progress.event === 'none'
					? m['orgSetup.welcome.subtitle']()
					: m['orgSetup.welcome.subtitleNext']()}
				class="text-center sm:flex-col sm:items-center"
			/>
		</div>
	</section>

	<div class="mx-auto -mt-12 max-w-3xl px-3 pb-8 sm:px-6">
		<div class="space-y-4 rounded-2xl border-2 bg-card p-4 shadow-poster md:p-6">
			{#if notice}
				<div
					role="status"
					data-testid="stripe-return-notice"
					class="flex items-start gap-3 rounded-xl border p-4 {notice === 'connected'
						? 'border-success/40 bg-success/10'
						: 'border-highlight/40 bg-highlight/20'}"
				>
					{#if notice === 'connected'}
						<CheckCircle2 class="mt-0.5 h-5 w-5 shrink-0 text-success" aria-hidden="true" />
					{:else}
						<AlertTriangle
							class="mt-0.5 h-5 w-5 shrink-0 text-highlight-foreground dark:text-highlight"
							aria-hidden="true"
						/>
					{/if}
					<div class="min-w-0 flex-1">
						<p class="text-sm font-medium text-foreground">
							{notice === 'connected'
								? m['orgSetup.welcome.stripeConnected']()
								: notice === 'needsDetails'
									? m['orgSetup.welcome.stripeNeedsDetails']()
									: m['orgSetup.welcome.stripeExpired']()}
						</p>
						{#if notice === 'expired'}
							<Button
								type="button"
								size="sm"
								class="mt-3 min-h-[44px]"
								onclick={() => setupActions?.openStripeModal()}
							>
								{m['orgSetup.welcome.stripeContinue']()}
							</Button>
						{/if}
					</div>
					<button
						type="button"
						class="-m-2 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
						aria-label={m['orgSetup.welcome.stripeDismiss']()}
						onclick={() => (notice = null)}
					>
						<X class="h-4 w-4" aria-hidden="true" />
					</button>
				</div>
			{/if}
			<SetupActions
				bind:this={setupActions}
				orgSlug={organization.slug}
				{progress}
				defaultStripeEmail={organization.contact_email ?? ''}
				{accessToken}
				density="full"
			/>
			<VisibilityStrip
				orgSlug={organization.slug}
				visibility={organization.visibility}
				{accessToken}
				density="full"
			/>
		</div>

		<div
			class="mt-6 flex flex-col items-center gap-2 text-center text-sm text-muted-foreground sm:flex-row sm:justify-between sm:text-left"
		>
			<div class="flex flex-wrap items-center justify-center gap-x-2 sm:justify-start">
				<span>{m['orgSetup.welcome.later']()}</span>
				<ul
					class="flex flex-wrap justify-center gap-x-3 gap-y-1 sm:justify-start [&>li+li]:before:mr-3 [&>li+li]:before:content-['·']"
				>
					<li>
						<a
							href={resolve('/(auth)/org/[slug]/admin/settings', { slug: organization.slug })}
							class={linkClass}>{m['orgSetup.welcome.laterLogo']()}</a
						>
					</li>
					<li>
						<a
							href={resolve('/(auth)/org/[slug]/admin/members', { slug: organization.slug })}
							class={linkClass}>{m['orgSetup.welcome.laterTeam']()}</a
						>
					</li>
					<li>
						<a
							href={resolve('/(auth)/org/[slug]/admin/settings', { slug: organization.slug })}
							class={linkClass}>{m['orgSetup.welcome.laterDescription']()}</a
						>
					</li>
				</ul>
			</div>
			<a
				href={resolve('/(auth)/org/[slug]/admin', { slug: organization.slug })}
				class="{linkClass} font-medium text-foreground"
			>
				{m['orgSetup.welcome.skip']()}
			</a>
		</div>
	</div>
</div>
