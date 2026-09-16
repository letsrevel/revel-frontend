<script lang="ts">
	import { untrack } from 'svelte';
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import type { ActionData, PageData } from './$types';
	import type { ReferralApplyErrorKey } from './+page.server';
	import { authStore } from '$lib/stores/auth.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Card, CardContent } from '$lib/components/ui/card';
	import { Input } from '$lib/components/ui/input';
	import { Textarea } from '$lib/components/ui/textarea';
	import { Alert, AlertDescription } from '$lib/components/ui/alert';
	import PageHeader from '$lib/components/common/PageHeader.svelte';
	import Sticker from '$lib/components/brand/Sticker.svelte';
	import { REFERRAL_NOTE_MAX_LENGTH } from '$lib/schemas/referral';
	import { CircleCheck, Gift, Loader2 } from '@lucide/svelte';
	import * as m from '$lib/paraglide/messages.js';
	import { SeoHead } from '$lib/seo';

	interface Props {
		data: PageData;
		form: ActionData;
	}
	const { data, form }: Props = $props();

	const errors = $derived(form && 'errors' in form ? form.errors : undefined);
	const submitted = $derived(!!form && 'success' in form && form.success === true);

	/*
	 * Field state is seeded from the action's echoed values so the no-JS path
	 * (and the very first hydration after a failed POST) re-renders what was
	 * typed. It is NEVER re-seeded afterwards: with `use:enhance` the client
	 * state is already the source of truth, and re-seeding on every action
	 * result would stomp on whatever the user has edited since.
	 */
	const initialValues = form && 'values' in form ? form.values : undefined;
	let email = $state(initialValues?.email ?? '');
	let code = $state(initialValues?.code ?? '');
	let note = $state(initialValues?.note ?? '');
	let isSubmitting = $state(false);

	/*
	 * Prefill for a signed-in applicant. This cannot happen server-side:
	 * `locals.user` is decoded from the access token, which carries no email
	 * claim. Runs once, and only into an empty field, so a guest who starts
	 * typing before a late auth bootstrap never has their input replaced.
	 */
	let prefillDone = false;
	$effect(() => {
		const storeEmail = authStore.user?.email;
		if (prefillDone || !storeEmail) return;
		prefillDone = true;
		if (!untrack(() => email)) email = storeEmail;
	});

	/** Already enrolled: the form would be a 202 that quietly does nothing. */
	const isReferrer = $derived(!!authStore.user?.referral_code);

	/*
	 * A referrer who lands here is SSR'd the form (the access token carries no
	 * `referral_code`, so the server cannot know) and then has it replaced the
	 * moment the auth store settles. Without this, focus silently falls to
	 * <body> and nothing is announced — WCAG 4.1.3 / 2.4.3.
	 *
	 * The `document.body` guard is what keeps this from becoming a focus STEAL:
	 * it is true both when nobody has focused anything yet and when the element
	 * that had focus was inside the form we just removed (the browser resets
	 * activeElement to body), and false when the visitor is off in the navbar
	 * or the footer, where yanking focus would be the bug.
	 */
	let alreadyReferrerHeading = $state<HTMLHeadingElement | null>(null);
	$effect(() => {
		if (!isReferrer) return;
		if (document.activeElement && document.activeElement !== document.body) return;
		alreadyReferrerHeading?.focus();
	});

	const noteCounter = $derived(
		m['referralApply.noteCounter']({ used: note.length, max: REFERRAL_NOTE_MAX_LENGTH })
	);

	const ERROR_MESSAGES: Record<ReferralApplyErrorKey, () => string> = {
		email_invalid: () => m['referralApply.errorEmailInvalid'](),
		code_invalid: () => m['referralApply.errorCodeInvalid'](),
		note_required: () => m['referralApply.errorNoteRequired'](),
		note_too_long: () => m['referralApply.errorNoteTooLong'](),
		code_taken: () => m['referralApply.errorCodeTaken'](),
		pending: () => m['referralApply.errorPending'](),
		throttled: () => m['referralApply.errorThrottled'](),
		generic: () => m['referralApply.errorGeneric']()
	};
	function errorText(key: ReferralApplyErrorKey | undefined): string | null {
		return key ? ERROR_MESSAGES[key]() : null;
	}

	const formError = $derived(errorText(errors?.form));
	const emailError = $derived(errorText(errors?.email));
	const codeError = $derived(errorText(errors?.code));
	const noteError = $derived(errorText(errors?.note));

	/*
	 * The success panel REPLACES the form, so without this the focus ring is
	 * left on a button that no longer exists and a screen-reader user hears
	 * nothing at all (WCAG 2.4.3 / 3.2.2).
	 */
	let successHeading = $state<HTMLHeadingElement | null>(null);
	$effect(() => {
		if (submitted) successHeading?.focus();
	});

	const steps = $derived([
		m['referralApply.howStep1'](),
		m['referralApply.howStep2'](),
		m['referralApply.howStep3'](),
		m['referralApply.howStep4']()
	]);
</script>

<SeoHead config={data.seo} />

<div class="container mx-auto max-w-3xl px-4 py-10 sm:py-14">
	<PageHeader
		volume="celebration"
		kicker={m['referralApply.kicker']()}
		title={m['referralApply.title']()}
		subtitle={m['referralApply.subtitle']()}
	>
		{#snippet decoration()}
			<Sticker tint="purple" rotate={-3} class="text-sm">
				<Gift class="mb-0.5 mr-1 inline h-4 w-4" />
			</Sticker>
		{/snippet}
	</PageHeader>

	<section class="mt-8" aria-labelledby="referral-how">
		<h2 id="referral-how" class="text-xl font-extrabold">{m['referralApply.howTitle']()}</h2>
		<ol class="mt-4 space-y-3">
			{#each steps as step, index (step)}
				<li class="flex items-start gap-3">
					<span
						aria-hidden="true"
						class="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-black text-secondary-foreground"
					>
						{index + 1}
					</span>
					<span class="text-sm text-muted-foreground sm:text-base">{step}</span>
				</li>
			{/each}
		</ol>
	</section>

	{#if isReferrer}
		<!-- Enrolled already: the backend answers 202 and does nothing, so send
		     them where their code actually lives instead of letting them apply
		     into the void. Client-side because `referral_code` only exists on the
		     hydrated user, never on the SSR-time JWT. -->
		<Card class="mt-8">
			<CardContent class="space-y-4 p-6">
				<h2
					bind:this={alreadyReferrerHeading}
					tabindex="-1"
					class="text-xl font-extrabold outline-none"
				>
					{m['referralApply.alreadyReferrerTitle']()}
				</h2>
				<p class="text-sm text-muted-foreground">{m['referralApply.alreadyReferrerBody']()}</p>
				<Button href={resolve('/(auth)/account/referral', {})} variant="outline">
					{m['referralApply.alreadyReferrerCta']()}
				</Button>
			</CardContent>
		</Card>
	{:else if submitted}
		<Card class="mt-8">
			<CardContent class="space-y-4 p-6">
				<div class="flex items-start gap-3">
					<CircleCheck class="mt-1 h-6 w-6 shrink-0 text-success" aria-hidden="true" />
					<div class="space-y-2">
						<h2
							bind:this={successHeading}
							tabindex="-1"
							class="text-xl font-extrabold outline-none"
						>
							{m['referralApply.successTitle']()}
						</h2>
						<p class="text-sm text-muted-foreground">{m['referralApply.successBody']()}</p>
					</div>
				</div>
			</CardContent>
		</Card>
	{:else}
		<Card class="mt-8">
			<CardContent class="p-6 sm:p-8">
				<h2 class="text-xl font-extrabold">{m['referralApply.formTitle']()}</h2>

				{#if formError}
					<Alert variant="destructive" class="mt-4">
						<AlertDescription>
							<span class="font-semibold">{m['referralApply.errorTitle']()}</span>
							<span class="mt-1 block">{formError}</span>
						</AlertDescription>
					</Alert>
				{/if}

				<form
					method="POST"
					class="mt-6 space-y-6"
					use:enhance={() => {
						if (isSubmitting) return;
						isSubmitting = true;
						return async ({ update }) => {
							isSubmitting = false;
							// `reset: false` — the inputs are bound to client state that
							// already holds what was typed; a reset would blank a form the
							// user still has to fix.
							await update({ reset: false });
						};
					}}
				>
					<div class="space-y-2">
						<label for="referral-email" class="block text-sm font-medium">
							{m['referralApply.emailLabel']()}
						</label>
						<Input
							id="referral-email"
							name="email"
							type="email"
							autocomplete="email"
							required
							bind:value={email}
							disabled={isSubmitting}
							placeholder={m['referralApply.emailPlaceholder']()}
							aria-invalid={emailError ? 'true' : undefined}
							class={emailError ? 'border-destructive' : undefined}
							aria-describedby={emailError
								? 'referral-email-help referral-email-error'
								: 'referral-email-help'}
						/>
						<p id="referral-email-help" class="text-sm text-muted-foreground">
							{m['referralApply.emailHelp']()}
						</p>
						{#if emailError}
							<p id="referral-email-error" class="text-sm text-destructive" role="alert">
								{emailError}
							</p>
						{/if}
					</div>

					<div class="space-y-2">
						<label for="referral-code" class="block text-sm font-medium">
							{m['referralApply.codeLabel']()}
						</label>
						<!-- Codes keep the case they are typed in (BE #987), so nothing
						     upper-cases the field; the mobile keyboard hints stop iOS
						     auto-capitalising the first character for the user. -->
						<Input
							id="referral-code"
							name="code"
							type="text"
							required
							bind:value={code}
							disabled={isSubmitting}
							placeholder={m['referralApply.codePlaceholder']()}
							autocapitalize="none"
							autocorrect="off"
							spellcheck={false}
							class="font-mono {codeError ? 'border-destructive' : ''}"
							aria-invalid={codeError ? 'true' : undefined}
							aria-describedby={codeError
								? 'referral-code-help referral-code-error'
								: 'referral-code-help'}
						/>
						<p id="referral-code-help" class="text-sm text-muted-foreground">
							{m['referralApply.codeHelp']()}
						</p>
						{#if codeError}
							<p id="referral-code-error" class="text-sm text-destructive" role="alert">
								{codeError}
							</p>
						{/if}
					</div>

					<div class="space-y-2">
						<label for="referral-note" class="block text-sm font-medium">
							{m['referralApply.noteLabel']()}
						</label>
						<Textarea
							id="referral-note"
							name="note"
							required
							rows={5}
							maxlength={REFERRAL_NOTE_MAX_LENGTH}
							bind:value={note}
							disabled={isSubmitting}
							placeholder={m['referralApply.notePlaceholder']()}
							aria-invalid={noteError ? 'true' : undefined}
							class={noteError ? 'border-destructive' : undefined}
							aria-describedby={noteError
								? 'referral-note-help referral-note-counter referral-note-error'
								: 'referral-note-help referral-note-counter'}
						/>
						<div class="flex flex-wrap items-baseline justify-between gap-2">
							<p id="referral-note-help" class="text-sm text-muted-foreground">
								{m['referralApply.noteHelp']()}
							</p>
							<p id="referral-note-counter" class="text-xs text-muted-foreground">
								{noteCounter}
							</p>
						</div>
						{#if noteError}
							<p id="referral-note-error" class="text-sm text-destructive" role="alert">
								{noteError}
							</p>
						{/if}
					</div>

					<Button type="submit" disabled={isSubmitting} class="w-full gap-2 sm:w-auto">
						{#if isSubmitting}
							<Loader2 class="h-4 w-4 animate-spin" aria-hidden="true" />
							{m['referralApply.submitting']()}
						{:else}
							{m['referralApply.submit']()}
						{/if}
					</Button>
				</form>
			</CardContent>
		</Card>
	{/if}
</div>
