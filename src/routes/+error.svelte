<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { page } from '$app/stores';
	import { Home, ArrowLeft, Lock, Search, ServerCrash, AlertCircle } from 'lucide-svelte';

	// Get error details from page store
	let status = $derived($page.status);
	let message = $derived($page.error?.message || m['errorPage.defaultMessage']());

	// Define error configurations for different status codes
	const errorConfigs = {
		404: {
			title: () => m['errorPage.error404_title'](),
			description: () => m['errorPage.error404_description'](),
			icon: Search,
			iconColor: 'text-blue-600 dark:text-blue-400',
			iconBg: 'bg-blue-50 dark:bg-blue-950',
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
			iconColor: 'text-amber-600 dark:text-amber-400',
			iconBg: 'bg-amber-50 dark:bg-amber-950',
			suggestions: () => [
				m['errorPage.error401_suggestion1'](),
				m['errorPage.error401_suggestion2'](),
				m['errorPage.error401_suggestion3']()
			],
			showBackButton: false,
			showHomeButton: true,
			showLoginButton: true
		},
		403: {
			title: () => m['errorPage.error403_title'](),
			description: () => m['errorPage.error403_description'](),
			icon: Lock,
			iconColor: 'text-red-600 dark:text-red-400',
			iconBg: 'bg-red-50 dark:bg-red-950',
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
			iconColor: 'text-red-600 dark:text-red-400',
			iconBg: 'bg-red-50 dark:bg-red-950',
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
	let config = $derived(
		errorConfigs[status as keyof typeof errorConfigs] || {
			title: () => m['errorPage.errorDefault_title']({ status: status.toString() }),
			description: () => message,
			icon: AlertCircle,
			iconColor: 'text-gray-600 dark:text-gray-400',
			iconBg: 'bg-gray-50 dark:bg-gray-950',
			suggestions: () => [
				m['errorPage.errorDefault_suggestion1'](),
				m['errorPage.errorDefault_suggestion2']()
			],
			showBackButton: true,
			showHomeButton: true
		}
	);

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
		<!-- Error Icon -->
		<div class="mb-8 flex justify-center">
			<div class="inline-flex rounded-full {config.iconBg} p-6">
				<svelte:component
					this={config.icon}
					class="h-16 w-16 {config.iconColor}"
					aria-hidden="true"
				/>
			</div>
		</div>

		<!-- Error Content -->
		<div class="text-center">
			<!-- Status Code -->
			<p class="mb-2 text-sm font-semibold uppercase tracking-wider text-primary">
				{m['errorPage.errorLabel']({ status: status.toString() })}
			</p>

			<!-- Title -->
			<h1 class="mb-4 text-4xl font-bold tracking-tight md:text-5xl">
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
						{#each config.suggestions() as suggestion}
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

				{#if (config as any).showLoginButton}
					<a
						href="/login?redirect={encodeURIComponent($page.url.pathname)}"
						class="inline-flex items-center gap-2 rounded-md border border-input bg-background px-6 py-3 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
					>
						<Lock class="h-4 w-4" aria-hidden="true" />
						{m['errorPage.signIn']()}
					</a>
				{/if}

				{#if config.showHomeButton}
					<a
						href="/"
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
