<script lang="ts">
	import { enhance, applyAction } from '$app/forms';
	import { page } from '$app/stores';
	import { invalidateAll } from '$app/navigation';
	import { AlertTriangle, CheckCircle, Loader2, Mail } from 'lucide-svelte';
	import * as m from '$lib/paraglide/messages.js';
	import { authStore } from '$lib/stores/auth.svelte';
	import type { RevelUserSchema } from '$lib/api/generated/types.gen';
	import type { ActionData } from './$types';

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

<div class="container mx-auto flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-8">
	<div class="w-full max-w-md space-y-8">
		{#if success}
			<div class="text-center">
				<div
					class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-950"
				>
					<CheckCircle class="h-8 w-8 text-green-600 dark:text-green-400" aria-hidden="true" />
				</div>
				<h1 class="text-3xl font-bold tracking-tight">
					{m['confirmEmailChange.success_heading']()}
				</h1>
			</div>

			<div
				role="status"
				class="space-y-3 rounded-md border border-green-500 bg-green-50 p-6 dark:bg-green-950"
			>
				<p class="text-sm font-medium text-green-800 dark:text-green-200">
					{m['confirmEmailChange.success_body']({ new_email: newEmail })}
				</p>
				<p class="text-sm text-green-700 dark:text-green-300">
					{m['confirmEmailChange.success_signoutNotice']()}
				</p>
			</div>

			<div class="text-center">
				<a
					href="/account/profile"
					class="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
				>
					{m['confirmEmailChange.success_cta']()}
				</a>
			</div>
		{:else if !token}
			<div class="text-center">
				<div
					class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10"
				>
					<AlertTriangle class="h-8 w-8 text-destructive" aria-hidden="true" />
				</div>
				<h1 class="text-3xl font-bold tracking-tight">
					{m['confirmEmailChange.invalidLink_heading']()}
				</h1>
				<p class="mt-2 text-muted-foreground">{m['confirmEmailChange.invalidLink_body']()}</p>
			</div>

			<div class="text-center">
				<a
					href="/account/security"
					class="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
				>
					{m['confirmEmailChange.invalidLink_cta']()}
				</a>
			</div>
		{:else}
			<div class="text-center">
				<div
					class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10"
				>
					<Mail class="h-8 w-8 text-primary" aria-hidden="true" />
				</div>
				<h1 class="text-3xl font-bold tracking-tight">
					{m['confirmEmailChange.confirm_heading']()}
				</h1>
				<p class="mt-2 text-muted-foreground">{m['confirmEmailChange.confirm_intro']()}</p>
			</div>

			<div
				class="rounded-md border border-amber-200 bg-amber-50 p-6 dark:border-amber-900 dark:bg-amber-950"
				role="region"
				aria-labelledby="confirmEmailChange_warning_title"
			>
				<div class="flex items-start gap-3">
					<AlertTriangle
						class="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-700 dark:text-amber-400"
						aria-hidden="true"
					/>
					<div class="flex-1 space-y-2">
						<h2
							id="confirmEmailChange_warning_title"
							class="font-semibold text-amber-900 dark:text-amber-200"
						>
							{m['confirmEmailChange.confirm_warningTitle']()}
						</h2>
						<p class="text-sm text-amber-800 dark:text-amber-200">
							{m['confirmEmailChange.confirm_warningBody']()}
						</p>
						<ul class="space-y-1 text-sm text-amber-800 dark:text-amber-200">
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
								href="/account/security"
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
							// Push the new user object into the auth store directly — initialize()
							// is idempotent and would skip refetching, leaving the cached email
							// stale in the header and profile until a full reload.
							const updatedUser = (result.data as { user?: RevelUserSchema } | undefined)?.user;
							if (updatedUser) {
								authStore.setUser(updatedUser);
							}
							// Ensure SSR data (e.g. the profile page's data.user) is refreshed too.
							await invalidateAll();
						}
					};
				}}
				class="space-y-4"
			>
				<input type="hidden" name="token" value={token} />

				<div class="flex gap-3">
					<a
						href="/"
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
		{/if}
	</div>
</div>
