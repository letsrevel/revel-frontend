<script lang="ts">
	import { enhance, applyAction } from '$app/forms';
	import { page } from '$app/stores';
	import { invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { AlertTriangle, CheckCircle, Loader2, Mail } from '@lucide/svelte';
	import * as m from '$lib/paraglide/messages.js';
	import { authStore } from '$lib/stores/auth.svelte';
	import type { RevelUserSchema } from '$lib/api/generated/types.gen';
	import type { ActionData } from './$types';
	import AuthBandLayout from '$lib/components/auth/AuthBandLayout.svelte';

	interface Props {
		form: ActionData;
	}

	const { form }: Props = $props();

	const token = $derived($page.url.searchParams.get('token') ?? '');
	const success = $derived(form?.success === true);
	const newEmail = $derived(form?.new_email ?? '');
	const errors = $derived((form?.errors ?? {}) as Record<string, string>);

	let isSubmitting = $state(false);

	const formErrorMessage = $derived.by(() => {
		const key = errors.form;
		if (!key) return null;
		if (key === 'expired' || key === 'invalid') return m['confirmEmailChange.error_expired']();
		if (key === 'emailTaken') return m['confirmEmailChange.error_emailTaken']();
		if (key === 'throttled') return m['confirmEmailChange.error_throttled']();
		return m['confirmEmailChange.error_generic']();
	});
</script>

<svelte:head>
	<title>{m['confirmEmailChange.pageTitle']()}</title>
	<meta name="description" content={m['confirmEmailChange.metaDescription']()} />
</svelte:head>

<!-- Colour-block band + floating content (uplift). Each of the three states
     keeps its own chip, h1 and copy — the chip simply moves INTO the band
     above the title (same EmptyState poster-chip recipe, still aria-hidden
     ornament) and the actions float on it. The success state's live region
     moves from the old wrapper div to the band's heading block via the
     layout's `status` prop; it still announces the same h1 + body. Every
     string is the same key, and the form action, token input, enhance handler
     and token-rotation logic are untouched. -->
{#snippet successChip()}
	<span
		aria-hidden="true"
		class="flex h-16 w-16 -rotate-2 items-center justify-center rounded-2xl bg-success text-success-foreground shadow-poster"
	>
		<CheckCircle class="h-8 w-8" />
	</span>
{/snippet}

{#snippet invalidChip()}
	<!-- No poster tint for a broken/invalid link — "warning" (amber/ink,
	     audited pair) is the closest honest match without adopting the full
	     destructive framing reserved for confirm-deletion. -->
	<span
		aria-hidden="true"
		class="flex h-16 w-16 -rotate-2 items-center justify-center rounded-2xl bg-poster-amber text-poster-ink shadow-poster"
	>
		<AlertTriangle class="h-8 w-8" />
	</span>
{/snippet}

{#snippet confirmChip()}
	<span
		aria-hidden="true"
		class="flex h-16 w-16 -rotate-2 items-center justify-center rounded-2xl bg-poster-purple text-poster-white shadow-poster"
	>
		<Mail class="h-8 w-8" />
	</span>
{/snippet}

{#if success}
	<AuthBandLayout
		width="lg"
		status
		chip={successChip}
		title={m['confirmEmailChange.success_heading']()}
		subtitle="{m['confirmEmailChange.success_body']({
			new_email: newEmail
		})} {m['confirmEmailChange.success_signoutNotice']()}"
	>
		<div class="rounded-lg border-2 border-border bg-card p-6 text-center shadow-poster">
			<a
				href={resolve('/(auth)/account/profile', {})}
				class="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
			>
				{m['confirmEmailChange.success_cta']()}
			</a>
		</div>
	</AuthBandLayout>
{:else if !token}
	<AuthBandLayout
		width="lg"
		chip={invalidChip}
		title={m['confirmEmailChange.invalidLink_heading']()}
		subtitle={m['confirmEmailChange.invalidLink_body']()}
	>
		<div class="rounded-lg border-2 border-border bg-card p-6 text-center shadow-poster">
			<a
				href={resolve('/(auth)/account/security', {})}
				class="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
			>
				{m['confirmEmailChange.invalidLink_cta']()}
			</a>
		</div>
	</AuthBandLayout>
{:else}
	<AuthBandLayout
		width="lg"
		chip={confirmChip}
		title={m['confirmEmailChange.confirm_heading']()}
		subtitle={m['confirmEmailChange.confirm_intro']()}
	>
		<!-- Warning box: highlight/20 + border are decorative; title/body stay
		     on foreground/muted-foreground, both already-audited pairs. -->
		<div
			class="rounded-lg border-2 border-highlight/40 bg-highlight/20 p-6 shadow-poster dark:border-highlight/50 dark:bg-highlight/25"
			role="region"
			aria-labelledby="confirmEmailChange_warning_title"
		>
			<div class="flex items-start gap-3">
				<AlertTriangle
					class="mt-0.5 h-5 w-5 flex-shrink-0 text-highlight-foreground dark:text-highlight"
					aria-hidden="true"
				/>
				<div class="flex-1 space-y-2">
					<h2 id="confirmEmailChange_warning_title" class="font-bold text-foreground">
						{m['confirmEmailChange.confirm_warningTitle']()}
					</h2>
					<p class="text-sm text-muted-foreground">
						{m['confirmEmailChange.confirm_warningBody']()}
					</p>
					<ul class="space-y-1 text-sm text-muted-foreground">
						<li class="flex gap-2">
							<span aria-hidden="true">•</span>
							<span>{m['confirmEmailChange.confirm_warningBullet1']()}</span>
						</li>
						<li class="flex gap-2">
							<span aria-hidden="true">•</span>
							<span>{m['confirmEmailChange.confirm_warningBullet2']()}</span>
						</li>
					</ul>
				</div>
			</div>
		</div>

		{#if formErrorMessage}
			<div role="alert" class="rounded-md border border-destructive bg-destructive/10 p-4">
				<p class="text-sm font-medium text-destructive">{formErrorMessage}</p>
				{#if errors.form === 'expired' || errors.form === 'invalid' || errors.form === 'emailTaken'}
					<div class="mt-3">
						<a
							href={resolve('/(auth)/account/security', {})}
							class="text-sm font-medium text-destructive underline-offset-4 hover:underline"
						>
							{m['confirmEmailChange.error_cta']()}
						</a>
					</div>
				{/if}
			</div>
		{/if}

		<form
			method="POST"
			action="?/confirmEmailChange"
			use:enhance={() => {
				if (isSubmitting) return;
				isSubmitting = true;
				return async ({ result }) => {
					isSubmitting = false;
					await applyAction(result);
					if (result.type === 'success') {
						// The backend rotated our token pair. Update the auth store
						// eagerly so the in-memory access token + refresh timer match
						// the new cookies we just wrote. Without this we depend on the
						// layout's auth-sync effect, which is racy — any code touching
						// authStore.accessToken between now and that effect would see
						// the old token.
						const data = result.data as
							{ access_token?: string | null; user?: RevelUserSchema } | undefined;
						if (data?.access_token) {
							authStore.setAccessToken(data.access_token);
						}
						// initialize() is idempotent and would skip refetching while a
						// user object is cached, so push the fresh user object directly.
						if (data?.user) {
							authStore.setUser(data.user);
						}
						// Refresh SSR data (e.g. the profile page's data.user).
						await invalidateAll();
					}
				};
			}}
			class="space-y-4"
		>
			<input type="hidden" name="token" value={token} />

			<div class="flex gap-3">
				<a
					href={resolve('/(public)', {})}
					class="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
				>
					{m['confirmEmailChange.confirm_cancel']()}
				</a>
				<button
					type="submit"
					disabled={isSubmitting}
					class="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
				>
					{#if isSubmitting}
						<Loader2 class="h-4 w-4 animate-spin" aria-hidden="true" />
						<span>{m['confirmEmailChange.confirm_submitting']()}</span>
					{:else}
						<span>{m['confirmEmailChange.confirm_submit']()}</span>
					{/if}
				</button>
			</div>
		</form>
	</AuthBandLayout>
{/if}
