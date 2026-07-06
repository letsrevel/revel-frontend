<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { AlertCircle, Check, X } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import {
		organizationadmincoreUpdateContactEmail,
		organizationadmincoreGetOrganization
	} from '$lib/api/generated/sdk.gen';
	import type { ContactMethod } from '$lib/api/generated/types.gen';

	interface Props {
		slug: string;
		accessToken: string | null;
		currentEmail: string;
		currentContactMethod?: ContactMethod;
		open: boolean;
		onClose: () => void;
	}

	let {
		slug,
		accessToken,
		currentEmail,
		currentContactMethod = 'none',
		open = $bindable(),
		onClose
	}: Props = $props();

	let newEmail = $state('');
	let isUpdatingEmail = $state(false);
	let emailUpdateError = $state<string | null>(null);
	let emailSent = $state(false);

	// Reset state when modal opens
	$effect(() => {
		if (open) {
			newEmail = currentEmail;
			emailUpdateError = null;
			emailSent = false;
		}
	});

	function close(): void {
		if (!isUpdatingEmail) {
			newEmail = '';
			emailSent = false;
			emailUpdateError = null;
			open = false;
			onClose();
		}
	}

	async function handleEmailUpdate(): Promise<void> {
		if (!accessToken || !newEmail.trim()) return;

		isUpdatingEmail = true;
		emailUpdateError = null;
		emailSent = false;

		try {
			const { data: orgData, error } = await organizationadmincoreUpdateContactEmail({
				headers: {
					Authorization: `Bearer ${accessToken}`
				},
				path: { slug },
				body: { email: newEmail.trim() }
			});

			if (error || !orgData) {
				emailUpdateError =
					typeof error === 'object' && error && 'detail' in error
						? (error as { detail?: string }).detail || m['orgContactEmailModal.failedToUpdate']()
						: m['orgContactEmailModal.failedToUpdate']();
				return;
			}

			// Re-fetch the admin payload to read contact_email_verified, which is not exposed
			// on the public OrganizationRetrieveSchema returned by the update endpoint.
			const adminResponse = await organizationadmincoreGetOrganization({
				headers: { Authorization: `Bearer ${accessToken}` },
				path: { slug }
			});
			const adminOrg = adminResponse.data;
			const isVerified = adminOrg?.contact_email_verified === true;
			const newContactMethod = adminOrg?.contact_method ?? orgData.contact_method;

			const wasContactEnabled = currentContactMethod === 'email' || currentContactMethod === 'form';
			const contactMethodReset = wasContactEnabled && newContactMethod === 'none';

			if (isVerified) {
				toast.success(m['orgContactEmailModal.toast_emailUpdated']());
				close();
				window.location.reload();
			} else {
				emailSent = true;
				toast.success(m['orgContactEmailModal.toast_verificationSent']());
				if (contactMethodReset) {
					toast.info(m['orgContactEmailModal.toast_contactMethodReset']());
				}
			}
		} catch (err) {
			console.error('[EMAIL UPDATE] Error:', err);
			emailUpdateError = m['orgContactEmailModal.unexpectedError']();
		} finally {
			isUpdatingEmail = false;
		}
	}
</script>

{#if open}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
		onclick={(e) => {
			if (e.target === e.currentTarget) {
				close();
			}
		}}
		onkeydown={(e) => {
			if (e.key === 'Escape') {
				close();
			}
		}}
		role="dialog"
		aria-modal="true"
		aria-labelledby="email-modal-title"
		tabindex="-1"
	>
		<div class="w-full max-w-md rounded-lg bg-background p-6 shadow-xl">
			<div class="mb-4 flex items-start justify-between">
				<h3 id="email-modal-title" class="text-lg font-semibold">
					{m['orgContactEmailModal.title']()}
				</h3>
				<button
					type="button"
					onclick={close}
					disabled={isUpdatingEmail}
					class="rounded-md p-1 hover:bg-accent"
					aria-label={m['orgContactEmailModal.close']()}
				>
					<X class="h-5 w-5" aria-hidden="true" />
				</button>
			</div>

			{#if emailSent}
				<!-- Success state -->
				<div class="space-y-4">
					<div class="rounded-md bg-green-50 p-4 dark:bg-green-950">
						<div class="flex gap-3">
							<Check
								class="h-5 w-5 flex-shrink-0 text-green-600 dark:text-green-400"
								aria-hidden="true"
							/>
							<div>
								<h4 class="font-medium text-green-900 dark:text-green-100">
									{m['orgContactEmailModal.verificationSentTitle']()}
								</h4>
								<p class="mt-1 text-sm text-green-800 dark:text-green-200">
									{m['orgContactEmailModal.verificationSentPrefix']()}
									<strong>{newEmail}</strong>.
									{m['orgContactEmailModal.verificationSentSuffix']()}
								</p>
							</div>
						</div>
					</div>
					<div class="flex justify-end gap-2">
						<button
							type="button"
							onclick={handleEmailUpdate}
							disabled={isUpdatingEmail}
							class="rounded-md px-4 py-2 text-sm font-medium text-primary hover:bg-accent"
						>
							{m['orgContactEmailModal.resendEmail']()}
						</button>
						<button
							type="button"
							onclick={close}
							class="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
						>
							{m['orgContactEmailModal.done']()}
						</button>
					</div>
				</div>
			{:else}
				<!-- Input form -->
				<div class="space-y-4">
					<div>
						<label for="new-email" class="block text-sm font-medium">
							{m['orgContactEmailModal.newEmailLabel']()}
						</label>
						<input
							id="new-email"
							type="email"
							bind:value={newEmail}
							disabled={isUpdatingEmail}
							placeholder={m['orgContactEmailModal.emailPlaceholder']()}
							class="mt-1 w-full rounded-md border-2 border-gray-300 bg-white px-3 py-2 text-sm transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800"
						/>
						<p class="mt-1 text-xs text-muted-foreground">
							{m['orgContactEmailModal.helperText']()}
						</p>
					</div>

					{#if emailUpdateError}
						<div class="rounded-md bg-red-50 p-3 dark:bg-red-950">
							<div class="flex gap-2">
								<AlertCircle
									class="h-5 w-5 flex-shrink-0 text-red-600 dark:text-red-400"
									aria-hidden="true"
								/>
								<p class="text-sm text-red-800 dark:text-red-200">
									{emailUpdateError}
								</p>
							</div>
						</div>
					{/if}

					<div class="flex justify-end gap-2">
						<button
							type="button"
							onclick={close}
							disabled={isUpdatingEmail}
							class="rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent"
						>
							{m['orgContactEmailModal.cancel']()}
						</button>
						<button
							type="button"
							onclick={handleEmailUpdate}
							disabled={isUpdatingEmail || !newEmail.trim()}
							class="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
						>
							{#if isUpdatingEmail}
								<div
									class="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
									aria-hidden="true"
								></div>
								{m['orgContactEmailModal.updating']()}
							{:else}
								{m['orgContactEmailModal.updateEmail']()}
							{/if}
						</button>
					</div>
				</div>
			{/if}
		</div>
	</div>
{/if}
