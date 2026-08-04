<script lang="ts">
	import { resolve } from '$app/paths';
	import * as m from '$lib/paraglide/messages.js';
	import { page } from '$app/stores';
	import {
		Home,
		ArrowLeft,
		Lock,
		Search,
		ServerCrash,
		AlertCircle,
		LinkIcon
	} from '@lucide/svelte';
	import ToneTile from '$lib/components/common/ToneTile.svelte';
	import Sticker from '$lib/components/brand/Sticker.svelte';
	import type { Tone } from '$lib/components/common/tones';
	import PageHeader from '$lib/components/common/PageHeader.svelte';

	// Get error details from page store
	const status = $derived($page.status);
	const message = $derived($page.error?.message || m['errorPage.defaultMessage']());

	// Define error configurations for different status codes. `tone` drives
	// the ToneTile icon chip below — semantic, not decorative: info (404,
	// benign miss), warning (401, needs auth), neutral (410, gone), danger
	// (403/500, access/server failure). 403 and 500 share a tone (as the old
	// red/red pairing did) but stay visually distinct via icon + copy, never
	// color alone.
	const errorConfigs: Record<
		number,
		{
			title: () => string;
			description: () => string;
			icon: typeof Search;
			tone: Tone;
			suggestions: () => string[];
			showBackButton: boolean;
			showHomeButton: boolean;
			showLoginButton?: boolean;
		}
	> = {
		404: {
			title: () => m['errorPage.error404_title'](),
			description: () => m['errorPage.error404_description'](),
			icon: Search,
			tone: 'info',
			suggestions: () => [
				m['errorPage.error404_suggestion1'](),
				m['errorPage.error404_suggestion2'](),
				m['errorPage.error404_suggestion3']()
			],
			showBackButton: true,
			showHomeButton: true
		},
		401: {
			title: () => m['errorPage.error401_title'](),
			description: () => m['errorPage.error401_description'](),
			icon: Lock,
			tone: 'warning',
			suggestions: () => [
				m['errorPage.error401_suggestion1'](),
				m['errorPage.error401_suggestion2'](),
				m['errorPage.error401_suggestion3']()
			],
			showBackButton: false,
			showHomeButton: true,
			showLoginButton: true
		},
		410: {
			title: () => m['errorPage.error410_title'](),
			description: () => m['errorPage.error410_description'](),
			icon: LinkIcon,
			tone: 'neutral',
			suggestions: () => [
				m['errorPage.error410_suggestion1'](),
				m['errorPage.error410_suggestion2'](),
				m['errorPage.error410_suggestion3']()
			],
			showBackButton: true,
			showHomeButton: true
		},
		403: {
			title: () => m['errorPage.error403_title'](),
			description: () => m['errorPage.error403_description'](),
			icon: Lock,
			tone: 'danger',
			suggestions: () => [
				m['errorPage.error403_suggestion1'](),
				m['errorPage.error403_suggestion2'](),
				m['errorPage.error403_suggestion3']()
			],
			showBackButton: true,
			showHomeButton: true
		},
		500: {
			title: () => m['errorPage.error500_title'](),
			description: () => m['errorPage.error500_description'](),
			icon: ServerCrash,
			tone: 'danger',
			suggestions: () => [
				m['errorPage.error500_suggestion1'](),
				m['errorPage.error500_suggestion2'](),
				m['errorPage.error500_suggestion3']()
			],
			showBackButton: true,
			showHomeButton: true
		}
	};

	// Get config for current status or default
	const config = $derived(
		errorConfigs[status] || {
			title: () => m['errorPage.errorDefault_title']({ status: status.toString() }),
			description: () => message,
			icon: AlertCircle,
			tone: 'neutral' as Tone,
			suggestions: () => [
				m['errorPage.errorDefault_suggestion1'](),
				m['errorPage.errorDefault_suggestion2']()
			],
			showBackButton: true,
			showHomeButton: true
		}
	);

	const ErrorIcon = $derived(config.icon);

	function goBack() {
		window.history.back();
	}
</script>

<svelte:head>
	<title>{config.title()} - Revel</title>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<!-- Poster ribbon + floating card (uplift, spec §9). The page was a column of
     centred type on bare background; it now opens on a full-strength
     `bg-secondary` colour block — an audit-enforced pair in BOTH modes
     (9.01:1 light / 8.17:1 dark for its own foreground), so the ribbon is a
     real poster panel that still respects the light/dark axis. The kicker and
     description inherit the band's foreground through PageHeader's `onBand`
     affordance; its default `text-primary` kicker measures 4.12:1 there,
     below AA for 14px extrabold.

     The status Sticker is the band's ornament: a white poster sticker whose
     purple-on-white pair is audited and mode-inert by the imagery rule.
     The ToneTile deliberately did NOT move onto the band — its soft `/10`
     tints and their icon ratios are computed against `bg-card`/page surfaces
     (see ToneTile's table), so it stays inside the floating card where those
     numbers hold. Both remain decorative art, not a second announcement: the
     h1 is the accessible heading and the status code is separately in the
     errorPage.errorLabel copy. -->
<div class="min-h-screen bg-background">
	<section class="bg-secondary text-secondary-foreground">
		<div class="container mx-auto max-w-2xl px-4 pb-20 pt-12 text-center sm:pt-16">
			<div class="mb-6 flex justify-center">
				<span aria-hidden="true">
					<Sticker tint="purple" rotate={-3} class="text-4xl sm:text-5xl">{status}</Sticker>
				</span>
			</div>
			<PageHeader
				volume="poster"
				onBand
				kicker={m['errorPage.errorLabel']({ status: status.toString() })}
				title={config.title()}
				subtitle={config.description()}
				class="text-center sm:flex-col sm:items-center"
			/>
		</div>
	</section>

	<div class="container mx-auto -mt-12 max-w-2xl space-y-6 px-4 pb-16">
		<div class="rounded-lg border-2 border-border bg-card p-6 shadow-poster sm:p-8">
			<div class="flex justify-center">
				<ToneTile tone={config.tone} icon={ErrorIcon} size="lg" />
			</div>

			<!-- Suggestions -->
			{#if config.suggestions && config.suggestions().length > 0}
				<h2 class="mt-6 text-sm font-extrabold uppercase tracking-[0.12em] text-muted-foreground">
					{m['errorPage.whatYouCanDo']()}
				</h2>
				<ul class="mt-4 space-y-2 text-left text-sm">
					{#each config.suggestions() as suggestion, i (i)}
						<li class="flex items-start gap-2">
							<span class="mt-1 text-primary" aria-hidden="true">•</span>
							<span>{suggestion}</span>
						</li>
					{/each}
				</ul>
			{/if}

			<!-- Action Buttons -->
			<div class="mt-8 flex flex-wrap items-center justify-center gap-3">
				{#if config.showBackButton}
					<button
						type="button"
						onclick={goBack}
						class="inline-flex items-center gap-2 rounded-md border border-input bg-background px-6 py-3 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
					>
						<ArrowLeft class="h-4 w-4" aria-hidden="true" />
						{m['errorPage.goBack']()}
					</button>
				{/if}

				{#if config.showLoginButton}
					<!-- eslint-disable svelte/no-navigation-without-resolve -- resolve() validates the path; the appended query/fragment cannot be expressed through resolve() -->
					<a
						href={`${resolve('/(public)/login', {})}?redirect=${encodeURIComponent($page.url.pathname)}`}
						class="inline-flex items-center gap-2 rounded-md border border-input bg-background px-6 py-3 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
					>
						<Lock class="h-4 w-4" aria-hidden="true" />
						{m['errorPage.signIn']()}
					</a>
					<!-- eslint-enable svelte/no-navigation-without-resolve -->
				{/if}

				{#if config.showHomeButton}
					<a
						href={resolve('/(public)', {})}
						class="inline-flex items-center gap-2 rounded-md bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
					>
						<Home class="h-4 w-4" aria-hidden="true" />
						{m['errorPage.backToHome']()}
					</a>
				{/if}
			</div>
		</div>

		<!-- Debug Info (only in development) -->
		{#if import.meta.env.DEV && message}
			<div class="rounded-lg border-2 border-muted bg-muted/50 p-4 text-left">
				<h3 class="mb-2 text-sm font-semibold text-muted-foreground">
					{m['errorPage.debugInfo']()}
				</h3>
				<pre class="overflow-x-auto text-xs text-muted-foreground">{message}</pre>
			</div>
		{/if}
	</div>
</div>
