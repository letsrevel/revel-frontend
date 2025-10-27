<script lang="ts">
	import { page } from '$app/stores';
	import { Home, ArrowLeft, Lock, Search, ServerCrash, AlertCircle } from 'lucide-svelte';

	// Get error details from page store
	let status = $derived($page.status);
	let message = $derived($page.error?.message || 'An error occurred');

	// Define error configurations for different status codes
	const errorConfigs = {
		404: {
			title: 'Page Not Found',
			description: "Sorry, we couldn't find the page you're looking for.",
			icon: Search,
			iconColor: 'text-blue-600 dark:text-blue-400',
			iconBg: 'bg-blue-50 dark:bg-blue-950',
			suggestions: [
				'Check the URL for typos',
				'The page may have been moved or deleted',
				'Try searching from the home page'
			],
			showBackButton: true,
			showHomeButton: true
		},
		401: {
			title: 'Authentication Required',
			description: 'You need to sign in to access this page.',
			icon: Lock,
			iconColor: 'text-amber-600 dark:text-amber-400',
			iconBg: 'bg-amber-50 dark:bg-amber-950',
			suggestions: [
				'Sign in to your account',
				"Create an account if you don't have one",
				'Check if you have permission to access this resource'
			],
			showBackButton: false,
			showHomeButton: true,
			showLoginButton: true
		},
		403: {
			title: 'Access Denied',
			description: "You don't have permission to access this resource.",
			icon: Lock,
			iconColor: 'text-red-600 dark:text-red-400',
			iconBg: 'bg-red-50 dark:bg-red-950',
			suggestions: [
				'Contact the organization owner for access',
				'Verify you have the correct role or permissions',
				'You may need to be invited to this organization'
			],
			showBackButton: true,
			showHomeButton: true
		},
		500: {
			title: 'Server Error',
			description: 'Something went wrong on our end. Please try again later.',
			icon: ServerCrash,
			iconColor: 'text-red-600 dark:text-red-400',
			iconBg: 'bg-red-50 dark:bg-red-950',
			suggestions: [
				'Try refreshing the page',
				'Clear your browser cache',
				'Contact support if the problem persists'
			],
			showBackButton: true,
			showHomeButton: true
		}
	};

	// Get config for current status or default
	let config = $derived(
		errorConfigs[status as keyof typeof errorConfigs] || {
			title: `Error ${status}`,
			description: message,
			icon: AlertCircle,
			iconColor: 'text-gray-600 dark:text-gray-400',
			iconBg: 'bg-gray-50 dark:bg-gray-950',
			suggestions: ['Try going back to the previous page', 'Return to the home page'],
			showBackButton: true,
			showHomeButton: true
		}
	);

	function goBack() {
		window.history.back();
	}
</script>

<svelte:head>
	<title>{config.title} - Revel</title>
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
				Error {status}
			</p>

			<!-- Title -->
			<h1 class="mb-4 text-4xl font-bold tracking-tight md:text-5xl">
				{config.title}
			</h1>

			<!-- Description -->
			<p class="mb-8 text-lg text-muted-foreground">
				{config.description}
			</p>

			<!-- Suggestions -->
			{#if config.suggestions && config.suggestions.length > 0}
				<div class="mb-8 rounded-lg border bg-card p-6 text-left">
					<h2 class="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
						What you can do:
					</h2>
					<ul class="space-y-2 text-sm">
						{#each config.suggestions as suggestion}
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
						Go Back
					</button>
				{/if}

				{#if config.showLoginButton}
					<a
						href="/login?redirect={encodeURIComponent($page.url.pathname)}"
						class="inline-flex items-center gap-2 rounded-md border border-input bg-background px-6 py-3 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
					>
						<Lock class="h-4 w-4" aria-hidden="true" />
						Sign In
					</a>
				{/if}

				{#if config.showHomeButton}
					<a
						href="/"
						class="inline-flex items-center gap-2 rounded-md bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
					>
						<Home class="h-4 w-4" aria-hidden="true" />
						Back to Home
					</a>
				{/if}
			</div>

			<!-- Debug Info (only in development) -->
			{#if import.meta.env.DEV && message}
				<div class="mt-8 rounded-lg border border-muted bg-muted/50 p-4 text-left">
					<h3 class="mb-2 text-sm font-semibold text-muted-foreground">Debug Info:</h3>
					<pre class="overflow-x-auto text-xs text-muted-foreground">{message}</pre>
				</div>
			{/if}
		</div>
	</div>
</div>
