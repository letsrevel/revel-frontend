<script lang="ts">
	import { resolve } from '$app/paths';
	import * as m from '$lib/paraglide/messages.js';
	import { page } from '$app/stores';
	import { Mail, Loader2 } from '@lucide/svelte';
	import { accountResendVerificationEmail } from '$lib/api/generated/sdk.gen';
	import EmptyState from '$lib/components/common/EmptyState.svelte';

	const email = $derived($page.url.searchParams.get('email') || '');
	let isResending = $state(false);
	let resendSuccess = $state(false);
	let resendError = $state('');

	/** Read a string property off an unknown error payload, if present. */
	function stringField(error: unknown, key: 'detail' | 'message'): string | undefined {
		if (typeof error !== 'object' || error === null) return undefined;
		if (key === 'detail' && 'detail' in error && typeof error.detail === 'string') {
			return error.detail;
		}
		if (key === 'message' && 'message' in error && typeof error.message === 'string') {
			return error.message;
		}
		return undefined;
	}

	async function handleResend() {
		if (!email || isResending) return;

		isResending = true;
		resendError = '';
		resendSuccess = false;

		try {
			const response = await accountResendVerificationEmail({
				body: {
					email
				}
			});

			if (response.error) {
				resendError =
					stringField(response.error, 'detail') ||
					stringField(response.error, 'message') ||
					'Failed to resend verification email';
			} else {
				resendSuccess = true;
			}
		} catch {
			resendError = 'An unexpected error occurred. Please try again.';
		} finally {
			isResending = false;
		}
	}
</script>

<svelte:head>
	<title>{m['checkEmailPage.title']()}</title>
	<meta name="description" content="Verify your email to complete registration" />
</svelte:head>

<div class="container mx-auto flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-8">
	<div class="w-full max-w-md space-y-8 text-center">
		<div>
			<!-- level=2: this EmptyState is the page's only heading. -->
			<EmptyState
				icon={Mail}
				title={m['checkEmailPage.checkYourEmail']()}
				body={m['checkEmailPage.verificationLink']()}
				level={2}
				class="border-none bg-transparent p-0 shadow-none"
			/>
			{#if email}
				<p class="mt-1.5 font-medium">{email}</p>
			{/if}
		</div>

		<!-- Instructions -->
		<div class="space-y-4 text-sm text-muted-foreground">
			<p>{m['checkEmailPage.clickLink']()}</p>
		</div>

		<!-- Spam Warning: highlight/10 + border are decorative; body text stays on
		     the default foreground token (already-audited pair). -->
		<div
			class="rounded-md border border-highlight/30 bg-highlight/10 p-4 text-left dark:border-highlight/40 dark:bg-highlight/15"
		>
			<p class="text-sm font-medium text-foreground">
				{m['checkEmailPage.checkSpam']()}
			</p>
		</div>

		<!-- Resend Section -->
		<div class="space-y-3 border-t pt-6">
			<p class="text-sm text-muted-foreground">{m['checkEmailPage.didNotReceive']()}</p>

			{#if resendSuccess}
				<div
					role="status"
					class="space-y-2 rounded-md border border-success/40 bg-success/10 p-3 text-sm text-foreground dark:border-success/50 dark:bg-success/15"
				>
					<p>{m['checkEmailPage.resendSuccess']()}</p>
					<p class="text-muted-foreground">{m['checkEmailPage.checkSpam']()}</p>
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
					<span>{m['checkEmailPage.sending']()}</span>
				{:else}
					<span>{m['checkEmailPage.resend']()}</span>
				{/if}
			</button>
		</div>

		<!-- Back to Login -->
		<div class="text-sm">
			<a
				href={resolve('/(public)/login', {})}
				class="text-primary underline-offset-4 hover:underline"
			>
				{m['checkEmailPage.backToLogin']()}
			</a>
		</div>
	</div>
</div>
