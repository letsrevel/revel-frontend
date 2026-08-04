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

<div class="flex min-h-screen items-center justify-center bg-background px-4 py-16">
	<div class="w-full max-w-2xl">
		<!-- Error Icon + status-code Sticker: the flagship personality moment.
		     The Sticker is decorative (aria-hidden) — the status code is already
		     part of the accessible text below via errorPage.errorLabel. -->
		<div class="mb-8 flex flex-col items-center gap-4">
			<ToneTile tone={config.tone} icon={ErrorIcon} size="lg" label={config.title()} />
			<span aria-hidden="true">
				<Sticker tint="purple" rotate={-3} class="text-2xl">{status}</Sticker>
			</span>
		</div>

		<!-- Error Content -->
		<div class="text-center">
			<!-- Status Code -->
			<p class="mb-2 text-sm font-extrabold uppercase tracking-[0.12em] text-primary">
				{m['errorPage.errorLabel']({ status: status.toString() })}
			</p>

			<!-- Title -->
			<h1 class="mb-4 text-3xl font-black leading-[1.12] sm:text-4xl">
				{config.title()}
			</h1>

			<!-- Description -->
			<p class="mb-8 text-lg text-muted-foreground">
				{config.description()}
			</p>

			<!-- Suggestions -->
			{#if config.suggestions && config.suggestions().length > 0}
				<div class="mb-8 rounded-lg border bg-card p-6 text-left">
					<h2 class="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
						{m['errorPage.whatYouCanDo']()}
					</h2>
					<ul class="space-y-2 text-sm">
						{#each config.suggestions() as suggestion, i (i)}
							<li class="flex items-start gap-2">
								<span class="mt-1 text-primary" aria-hidden="true">•</span>
								<span>{suggestion}</span>
							</li>
						{/each}
					</ul>
				</div>
			{/if}

			<!-- Action Buttons -->
			<div class="flex flex-wrap items-center justify-center gap-3">
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

			<!-- Debug Info (only in development) -->
			{#if import.meta.env.DEV && message}
				<div class="mt-8 rounded-lg border border-muted bg-muted/50 p-4 text-left">
					<h3 class="mb-2 text-sm font-semibold text-muted-foreground">
						{m['errorPage.debugInfo']()}
					</h3>
					<pre class="overflow-x-auto text-xs text-muted-foreground">{message}</pre>
				</div>
			{/if}
		</div>
	</div>
</div>
