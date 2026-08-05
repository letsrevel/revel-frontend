<script lang="ts">
	import { resolve } from '$app/paths';
	import * as m from '$lib/paraglide/messages.js';
	import { page } from '$app/stores';
	import { Mail, Loader2, AlertTriangle } from '@lucide/svelte';
	import { accountResendVerificationEmail } from '$lib/api/generated/sdk.gen';
	import AuthBandLayout from '$lib/components/auth/AuthBandLayout.svelte';

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

<!-- Colour-block band + floating card (uplift). The mail chip moves INTO the
     band above the title (same EmptyState poster-chip recipe, still
     aria-hidden ornament); everything that follows floats on it. Copy, the
     resend handler and all live-region roles are unchanged. -->
{#snippet mailChip()}
	<span
		aria-hidden="true"
		class="flex h-16 w-16 -rotate-2 items-center justify-center rounded-2xl bg-poster-purple text-poster-white shadow-poster"
	>
		<Mail class="h-8 w-8" />
	</span>
{/snippet}

<AuthBandLayout
	chip={mailChip}
	title={m['checkEmailPage.checkYourEmail']()}
	subtitle={m['checkEmailPage.verificationLink']()}
>
	<div class="space-y-6 rounded-lg border-2 border-border bg-card p-6 text-center shadow-poster">
		{#if email}
			<p class="font-bold">{email}</p>
		{/if}

		<!-- Instructions -->
		<p class="text-sm text-muted-foreground">{m['checkEmailPage.clickLink']()}</p>

		<!-- Spam Warning: highlight/20 + border are decorative; body text stays on
		     the default foreground token (already-audited pair). -->
		<div
			class="flex items-start gap-3 rounded-md border border-highlight/30 bg-highlight/20 p-4 text-left dark:border-highlight/40 dark:bg-highlight/25"
		>
			<AlertTriangle
				class="mt-0.5 h-5 w-5 flex-shrink-0 text-highlight-foreground dark:text-highlight"
				aria-hidden="true"
			/>
			<p class="text-sm font-medium text-foreground">
				{m['checkEmailPage.checkSpam']()}
			</p>
		</div>

		<!-- Resend Section -->
		<div class="space-y-3 border-t-2 pt-6">
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
	</div>

	<!-- Back to Login -->
	<div class="text-center text-sm">
		<a
			href={resolve('/(public)/login', {})}
			class="text-primary underline-offset-4 hover:underline"
		>
			{m['checkEmailPage.backToLogin']()}
		</a>
	</div>
</AuthBandLayout>
