<script lang="ts">
	import { page } from '$app/stores';
	import { Mail, Loader2 } from 'lucide-svelte';
	import { accountResendVerificationEmailF37Edb18 } from '$lib/api/generated/sdk.gen';

	let email = $derived($page.url.searchParams.get('email') || '');
	let isResending = $state(false);
	let resendSuccess = $state(false);
	let resendError = $state('');

	async function handleResend() {
		if (!email || isResending) return;

		isResending = true;
		resendError = '';
		resendSuccess = false;

		try {
			const response = await accountResendVerificationEmailF37Edb18();

			if (response.error) {
				const error = response.error as any;
				resendError = error?.detail || error?.message || 'Failed to resend verification email';
			} else {
				resendSuccess = true;
			}
		} catch (error) {
			resendError = 'An unexpected error occurred. Please try again.';
		} finally {
			isResending = false;
		}
	}
</script>

<svelte:head>
	<title>Check Your Email - Revel</title>
	<meta name="description" content="Verify your email to complete registration" />
</svelte:head>

<div class="container mx-auto flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-8">
	<div class="w-full max-w-md space-y-8 text-center">
		<!-- Icon -->
		<div class="flex justify-center">
			<div class="rounded-full bg-primary/10 p-6">
				<Mail class="h-12 w-12 text-primary" aria-hidden="true" />
			</div>
		</div>

		<!-- Header -->
		<div class="space-y-2">
			<h1 class="text-3xl font-bold tracking-tight">Check your email</h1>
			<p class="text-muted-foreground">We've sent a verification link to:</p>
			{#if email}
				<p class="font-medium">{email}</p>
			{/if}
		</div>

		<!-- Instructions -->
		<div class="space-y-4 text-sm text-muted-foreground">
			<p>Click the link in the email to verify your account and complete registration.</p>
			<p>If you don't see the email, check your spam folder.</p>
		</div>

		<!-- Resend Section -->
		<div class="space-y-3 border-t pt-6">
			<p class="text-sm text-muted-foreground">Didn't receive the email?</p>

			{#if resendSuccess}
				<div
					role="status"
					class="rounded-md border border-green-500 bg-green-500/10 p-3 text-sm text-green-700 dark:text-green-400"
				>
					Verification email sent! Check your inbox.
				</div>
			{/if}

			{#if resendError}
				<div
					role="alert"
					class="rounded-md border border-destructive bg-destructive/10 p-3 text-sm text-destructive"
				>
					{resendError}
				</div>
			{/if}

			<button
				type="button"
				onclick={handleResend}
				disabled={isResending || !email}
				class="inline-flex items-center justify-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
			>
				{#if isResending}
					<Loader2 class="h-4 w-4 animate-spin" aria-hidden="true" />
					<span>Sending...</span>
				{:else}
					<span>Resend verification email</span>
				{/if}
			</button>
		</div>

		<!-- Back to Login -->
		<div class="text-sm">
			<a href="/login" class="text-primary underline-offset-4 hover:underline"> Back to login </a>
		</div>
	</div>
</div>
