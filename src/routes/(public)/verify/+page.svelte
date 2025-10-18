<script lang="ts">
	import type { PageData } from './$types';
	import { CheckCircle, XCircle } from 'lucide-svelte';

	interface Props {
		data: PageData;
	}

	let { data }: Props = $props();
</script>

<svelte:head>
	<title>{data.success ? 'Email Verified' : 'Verification Failed'} - Revel</title>
	<meta name="description" content="Email verification result" />
</svelte:head>

<div class="container mx-auto flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-8">
	<div class="w-full max-w-md space-y-8 text-center">
		<!-- Icon -->
		<div class="flex justify-center">
			{#if data.success}
				<div class="rounded-full bg-green-500/10 p-6">
					<CheckCircle class="h-12 w-12 text-green-600 dark:text-green-400" aria-hidden="true" />
				</div>
			{:else}
				<div class="rounded-full bg-destructive/10 p-6">
					<XCircle class="h-12 w-12 text-destructive" aria-hidden="true" />
				</div>
			{/if}
		</div>

		<!-- Message -->
		<div class="space-y-2">
			{#if data.success}
				<h1 class="text-3xl font-bold tracking-tight">Email verified!</h1>
				<p class="text-muted-foreground">
					Your account has been successfully verified. Redirecting you to the dashboard...
				</p>
			{:else}
				<h1 class="text-3xl font-bold tracking-tight">Verification failed</h1>
				<p class="text-muted-foreground">
					{data.error || 'We could not verify your email address.'}
				</p>
			{/if}
		</div>

		<!-- Actions -->
		{#if !data.success}
			<div class="space-y-3 border-t pt-6">
				<p class="text-sm text-muted-foreground">
					The verification link may have expired or is invalid.
				</p>
				<div class="flex flex-col gap-3 sm:flex-row sm:justify-center">
					<a
						href="/register"
						class="inline-flex h-10 items-center justify-center rounded-md bg-primary px-6 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
					>
						Create new account
					</a>
					<a
						href="/login"
						class="inline-flex h-10 items-center justify-center rounded-md border border-input bg-background px-6 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
					>
						Back to login
					</a>
				</div>
			</div>
		{/if}
	</div>
</div>
