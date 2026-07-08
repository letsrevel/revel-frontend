<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { enhance, applyAction } from '$app/forms';
	import { Mail, Eye, EyeOff, AlertTriangle, CheckCircle, ShieldCheck } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import * as Dialog from '$lib/components/ui/dialog';
	import type { RevelUserSchema } from '$lib/api/generated/types.gen';

	interface EmailChangeFormState {
		emailChange?: {
			new_email?: string;
			failed?: boolean;
		};
		errors?: Record<string, string>;
	}

	interface Props {
		user: RevelUserSchema | null | undefined;
		form: EmailChangeFormState | null | undefined;
	}

	const { user, form }: Props = $props();

	let showForm = $state(false);
	let newEmail = $state('');
	let password = $state('');
	let showPassword = $state(false);
	let isSubmitting = $state(false);
	let cancelDialogOpen = $state(false);

	let changeButtonEl = $state<HTMLButtonElement | null>(null);
	let newEmailInputEl = $state<HTMLInputElement | null>(null);
	let wasFormOpen = false;
	let dismissed = $state(false);

	$effect(() => {
		if (showForm && !wasFormOpen) {
			wasFormOpen = true;
			// Defer to the next microtask so the input is in the DOM.
			queueMicrotask(() => newEmailInputEl?.focus());
		} else if (!showForm && wasFormOpen) {
			wasFormOpen = false;
			queueMicrotask(() => changeButtonEl?.focus());
		}
	});

	const currentEmail = $derived(user?.email ?? '');
	const emailVerified = $derived(user?.email_verified ?? false);

	const submittedEmail = $derived(form?.emailChange?.new_email ?? '');

	let lastSeenEmail = '';
	$effect(() => {
		if (submittedEmail && submittedEmail !== lastSeenEmail) {
			lastSeenEmail = submittedEmail;
			dismissed = false;
		}
	});

	const submissionSucceeded = $derived(
		!!submittedEmail && !form?.emailChange?.failed && !dismissed
	);

	const hasUnsavedInput = $derived(newEmail.length > 0 || password.length > 0);

	// Only treat `form` as ours when the requestEmailChange action ran. Other
	// actions on the same page (2FA setup/verify/disable) also write into the
	// shared `form` prop; without this guard their errors would bleed into the
	// email-change card's error region.
	const isOurActionResult = $derived(form?.emailChange !== undefined);
	const fieldErrorKey = $derived(isOurActionResult ? (form?.errors ?? {}) : {});

	const emailErrorMessage = $derived.by(() => {
		const key = fieldErrorKey.new_email;
		if (!key) return null;
		if (key === 'sameEmail') return m['accountSecurityPage.emailChange_error_sameEmail']();
		if (key === 'duplicate') return m['accountSecurityPage.emailChange_error_duplicate']();
		return key; // fallback: raw zod message
	});

	const passwordErrorMessage = $derived.by(() => {
		const key = fieldErrorKey.password;
		if (!key) return null;
		if (key === 'wrongPassword') return m['accountSecurityPage.emailChange_error_wrongPassword']();
		return key;
	});

	const formErrorMessage = $derived.by(() => {
		const key = fieldErrorKey.form;
		if (!key) return null;
		if (key === 'throttled') return m['accountSecurityPage.emailChange_error_throttled']();
		if (key === 'generic') return m['accountSecurityPage.emailChange_error_generic']();
		return key;
	});

	function resetForm() {
		showForm = false;
		newEmail = '';
		password = '';
		showPassword = false;
		dismissed = true;
	}

	function attemptCancel() {
		if (hasUnsavedInput) {
			cancelDialogOpen = true;
		} else {
			resetForm();
		}
	}

	function confirmDiscard() {
		cancelDialogOpen = false;
		resetForm();
	}

	const submitDisabled = $derived(isSubmitting || newEmail.length === 0 || password.length === 0);
</script>

<div id="email" class="mt-6 rounded-lg border bg-card p-6" style="scroll-margin-top: 5rem;">
	<div class="flex items-start gap-4">
		<div class="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
			<Mail class="h-6 w-6" aria-hidden="true" />
		</div>

		<div class="flex-1">
			<div>
				<h2 class="text-xl font-semibold">{m['accountSecurityPage.emailChange_title']()}</h2>
				<p class="mt-1 text-sm text-muted-foreground">
					{m['accountSecurityPage.emailChange_description']()}
				</p>
			</div>

			{#if !showForm && !submissionSucceeded}
				<div class="mt-4">
					<p class="text-sm">
						<span class="text-muted-foreground"
							>{m['accountSecurityPage.emailChange_currentLabel']()}:</span
						>
						<span class="ml-1 font-medium">{currentEmail}</span>
						{#if emailVerified}
							<span
								class="ml-2 inline-flex items-center gap-1 rounded bg-green-100 px-1.5 py-0.5 text-xs font-medium text-green-800 dark:bg-green-950 dark:text-green-300"
							>
								<ShieldCheck class="h-3 w-3" aria-hidden="true" />
								{m['profile.email_verified']()}
							</span>
						{/if}
					</p>
				</div>

				<div class="mt-6">
					<button
						type="button"
						bind:this={changeButtonEl}
						class="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
						onclick={() => (showForm = true)}
					>
						{m['accountSecurityPage.emailChange_changeButton']()}
					</button>
				</div>
			{/if}

			{#if showForm && !submissionSucceeded}
				<div class="mt-6 rounded-lg border bg-muted/50 p-6">
					<h3 class="font-semibold">{m['accountSecurityPage.emailChange_formTitle']()}</h3>
					<p class="mt-2 text-sm text-muted-foreground">
						{m['accountSecurityPage.emailChange_formDescription']()}
					</p>

					<div
						class="mt-4 flex items-start gap-3 rounded-md border border-amber-200 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950"
					>
						<AlertTriangle
							class="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-700 dark:text-amber-400"
							aria-hidden="true"
						/>
						<p class="text-sm text-amber-900 dark:text-amber-200">
							{m['accountSecurityPage.emailChange_signoutWarning']()}
						</p>
					</div>

					<form
						method="POST"
						action="?/requestEmailChange"
						use:enhance={() => {
							if (isSubmitting) return;
							isSubmitting = true;
							return async ({ result }) => {
								isSubmitting = false;
								await applyAction(result);
								if (result.type === 'failure' && result.data) {
									const errs = (result.data as Record<string, unknown>).errors as
										Record<string, string> | undefined;
									if (errs?.form === 'throttled') {
										toast.error(m['accountSecurityPage.emailChange_error_throttled']());
									}
								}
							};
						}}
						class="mt-4 space-y-4"
					>
						<div class="space-y-2">
							<label for="emailChange_new_email" class="block text-sm font-medium">
								{m['accountSecurityPage.emailChange_newEmailLabel']()}
							</label>
							<input
								id="emailChange_new_email"
								name="new_email"
								type="email"
								autocomplete="email"
								required
								bind:value={newEmail}
								bind:this={newEmailInputEl}
								disabled={isSubmitting}
								placeholder={m['accountSecurityPage.emailChange_newEmailPlaceholder']()}
								aria-invalid={!!emailErrorMessage}
								aria-describedby={emailErrorMessage ? 'emailChange_new_email_error' : undefined}
								class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm transition-colors placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 {emailErrorMessage
									? 'border-destructive'
									: ''}"
							/>
							{#if emailErrorMessage}
								<p id="emailChange_new_email_error" class="text-sm text-destructive" role="alert">
									{emailErrorMessage}
								</p>
							{/if}
						</div>

						<div class="space-y-2">
							<label for="emailChange_password" class="block text-sm font-medium">
								{m['accountSecurityPage.emailChange_passwordLabel']()}
							</label>
							<div class="relative">
								<input
									id="emailChange_password"
									name="password"
									type={showPassword ? 'text' : 'password'}
									autocomplete="current-password"
									required
									bind:value={password}
									disabled={isSubmitting}
									placeholder={m['accountSecurityPage.emailChange_passwordPlaceholder']()}
									aria-invalid={!!passwordErrorMessage}
									aria-describedby={passwordErrorMessage ? 'emailChange_password_error' : undefined}
									class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 pr-10 text-sm transition-colors placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 {passwordErrorMessage
										? 'border-destructive'
										: ''}"
								/>
								<button
									type="button"
									onclick={() => (showPassword = !showPassword)}
									class="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground transition-colors hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
									aria-label={showPassword
										? m['accountSecurityPage.emailChange_hidePassword']()
										: m['accountSecurityPage.emailChange_showPassword']()}
								>
									{#if showPassword}
										<EyeOff class="h-4 w-4" aria-hidden="true" />
									{:else}
										<Eye class="h-4 w-4" aria-hidden="true" />
									{/if}
								</button>
							</div>
							{#if passwordErrorMessage}
								<p id="emailChange_password_error" class="text-sm text-destructive" role="alert">
									{passwordErrorMessage}
								</p>
							{/if}
						</div>

						{#if formErrorMessage}
							<div role="alert" class="rounded-md border border-destructive bg-destructive/10 p-3">
								<p class="text-sm font-medium text-destructive">{formErrorMessage}</p>
							</div>
						{/if}

						<div class="flex gap-3">
							<button
								type="submit"
								disabled={submitDisabled}
								class="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:opacity-50"
							>
								{isSubmitting
									? m['accountSecurityPage.emailChange_submitting']()
									: m['accountSecurityPage.emailChange_submitButton']()}
							</button>
							<button
								type="button"
								onclick={attemptCancel}
								class="rounded-md border px-4 py-2 text-sm font-medium transition-colors hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
							>
								{m['accountSecurityPage.cancel']()}
							</button>
						</div>
					</form>
				</div>
			{/if}

			{#if submissionSucceeded}
				<div class="mt-6 rounded-md border border-green-500 bg-green-50 p-6 dark:bg-green-950">
					<div class="flex items-start gap-3">
						<CheckCircle
							class="mt-0.5 h-5 w-5 flex-shrink-0 text-green-600 dark:text-green-400"
							aria-hidden="true"
						/>
						<div class="flex-1 space-y-2 text-sm">
							<h3 class="font-medium text-green-800 dark:text-green-200">
								{m['accountSecurityPage.emailChange_successTitle']()}
							</h3>
							<p class="text-green-700 dark:text-green-300">
								{m['accountSecurityPage.emailChange_successBody']({ new_email: submittedEmail })}
							</p>
							<p class="text-green-700 dark:text-green-300">
								{m['accountSecurityPage.emailChange_successNotice']({
									current_email: currentEmail
								})}
							</p>
							<p class="text-xs text-green-700 dark:text-green-300">
								{m['accountSecurityPage.emailChange_successExpiry']()}
							</p>
						</div>
					</div>
					<div class="mt-4">
						<button
							type="button"
							onclick={resetForm}
							class="rounded-md border px-4 py-2 text-sm font-medium transition-colors hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
						>
							{m['accountSecurityPage.emailChange_successDone']()}
						</button>
					</div>
				</div>
			{/if}
		</div>
	</div>
</div>

<Dialog.Root bind:open={cancelDialogOpen}>
	<Dialog.Content>
		<Dialog.Header>
			<Dialog.Title>{m['accountSecurityPage.emailChange_cancelDialogTitle']()}</Dialog.Title>
			<Dialog.Description>
				{m['accountSecurityPage.emailChange_cancelDialogDescription']()}
			</Dialog.Description>
		</Dialog.Header>
		<Dialog.Footer>
			<button
				type="button"
				onclick={() => (cancelDialogOpen = false)}
				class="rounded-md border px-4 py-2 text-sm font-medium transition-colors hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
			>
				{m['accountSecurityPage.emailChange_cancelDialogKeepEditing']()}
			</button>
			<button
				type="button"
				onclick={confirmDiscard}
				class="rounded-md bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground transition-colors hover:bg-destructive/90 focus:outline-none focus:ring-2 focus:ring-destructive focus:ring-offset-2"
			>
				{m['accountSecurityPage.emailChange_cancelDialogConfirm']()}
			</button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
