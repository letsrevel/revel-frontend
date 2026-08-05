<script lang="ts">
	import { resolve } from '$app/paths';
	import * as m from '$lib/paraglide/messages.js';
	import { enhance } from '$app/forms';
	import type { ActionData, PageData } from './$types';
	import { Loader2, ArrowLeft, Mail, AlertTriangle } from '@lucide/svelte';
	import { Card, CardContent } from '$lib/components/ui/card';
	import AuthBandLayout from '$lib/components/auth/AuthBandLayout.svelte';
	import { SeoHead } from '$lib/seo';

	interface Props {
		data: PageData;
		form: ActionData;
	}

	const { data, form }: Props = $props();

	// Form state
	let email = $state(form?.email || '');
	let isSubmitting = $state(false);

	// Success state - derive from form
	const success = $derived(form?.success || false);

	// Error handling
	const errors = $derived((form?.errors || {}) as Record<string, string>);
</script>

<SeoHead config={data.seo} />

<!-- Colour-block band + floating card (uplift). Shell only: the action URLs,
     enhance handler, field ids and aria wiring below are untouched. -->
<AuthBandLayout
	kicker={m['passwordResetPage.kicker']()}
	title={success
		? m['passwordResetPage.checkYourEmail']()
		: m['passwordResetPage.resetYourPassword']()}
	subtitle={success
		? m['passwordResetPage.emailSentDescription']()
		: m['passwordResetPage.enterEmailDescription']()}
>
	<Card>
		<CardContent class="space-y-6 p-6 sm:p-8">
			{#if success}
				<!-- Success State: success/10 + border are decorative (no text-contrast
					     requirement); title/body stay on foreground/muted-foreground, both
					     already-audited pairs, so the token swap can't regress contrast. -->
				<div
					role="status"
					class="rounded-md border border-success/40 bg-success/10 p-6 dark:border-success/50 dark:bg-success/15"
				>
					<div class="flex items-start gap-3">
						<Mail class="h-6 w-6 flex-shrink-0 text-success" aria-hidden="true" />
						<div class="flex-1 space-y-3">
							<p class="text-sm font-medium text-foreground">
								{m['passwordResetPage.emailSentTitle']()}
							</p>
							<p class="text-sm text-muted-foreground">
								{m['passwordResetPage.emailSentMessage']()}
							</p>
						</div>
					</div>
				</div>

				<!-- Spam Warning -->
				<div
					class="flex items-start gap-3 rounded-md border border-highlight/30 bg-highlight/20 p-4 dark:border-highlight/40 dark:bg-highlight/25"
				>
					<AlertTriangle
						class="mt-0.5 h-5 w-5 flex-shrink-0 text-highlight-foreground dark:text-highlight"
						aria-hidden="true"
					/>
					<p class="text-sm font-medium text-foreground">
						{m['passwordResetPage.checkSpam']()}
					</p>
				</div>

				<!-- Back to Login -->
				<div class="text-center">
					<a
						href={resolve('/(public)/login', {})}
						class="inline-flex items-center gap-2 text-sm text-primary underline-offset-4 hover:underline"
					>
						<ArrowLeft class="h-4 w-4" aria-hidden="true" />
						{m['passwordResetPage.backToLogin']()}
					</a>
				</div>
			{:else}
				<!-- Error Summary -->
				{#if errors.form}
					<div role="alert" class="rounded-md border border-destructive bg-destructive/10 p-4">
						<p class="text-sm font-medium text-destructive">{errors.form}</p>
					</div>
				{/if}

				<!-- Reset Request Form -->
				<form
					method="POST"
					action="?/resetRequest"
					use:enhance={() => {
						// Prevent duplicate submissions
						if (isSubmitting) return;
						isSubmitting = true;

						return async ({ update }) => {
							isSubmitting = false;
							await update();
						};
					}}
					class="space-y-6"
				>
					<!-- Email Field -->
					<div class="space-y-2">
						<label for="email" class="block text-sm font-medium">
							{m['passwordResetPage.emailLabel']()}
						</label>
						<input
							id="email"
							name="email"
							type="email"
							autocomplete="email"
							required
							bind:value={email}
							aria-invalid={!!errors.email}
							aria-describedby={errors.email ? 'email-error' : undefined}
							disabled={isSubmitting}
							class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm transition-colors placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 {errors.email
								? 'border-destructive'
								: ''}"
							placeholder={m['passwordResetPage.emailPlaceholder']()}
						/>
						{#if errors.email}
							<p id="email-error" class="text-sm text-destructive" role="alert">
								{errors.email}
							</p>
						{/if}
					</div>

					<!-- Submit Button -->
					<button
						type="submit"
						disabled={isSubmitting}
						class="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
					>
						{#if isSubmitting}
							<Loader2 class="h-4 w-4 animate-spin" aria-hidden="true" />
							<span>{m['passwordResetPage.sendingLink']()}</span>
						{:else}
							<span>{m['passwordResetPage.sendLink']()}</span>
						{/if}
					</button>
				</form>

				<!-- Back to Login Link -->
				<div class="text-center">
					<a
						href={resolve('/(public)/login', {})}
						class="inline-flex items-center gap-2 text-sm text-primary underline-offset-4 hover:underline"
					>
						<ArrowLeft class="h-4 w-4" aria-hidden="true" />
						{m['passwordResetPage.backToLogin']()}
					</a>
				</div>
			{/if}
		</CardContent>
	</Card>
</AuthBandLayout>
