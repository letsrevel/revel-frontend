<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { Mail, Send, Check } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { createMutation } from '@tanstack/svelte-query';
	import { Button } from '$lib/components/ui/button';
	import * as Dialog from '$lib/components/ui/dialog';
	import { authStore } from '$lib/stores/auth.svelte';
	import { organizationContactOrganization } from '$lib/api/generated/sdk.gen';
	import type { ContactMethod } from '$lib/api/generated/types.gen';
	import { extractErrorMessage } from '$lib/utils/errors';

	interface Props {
		organizationSlug: string;
		organizationName: string;
		contactMethod: ContactMethod;
		contactEmail?: string | null;
		isAuthenticated: boolean;
		variant?: 'primary' | 'outline';
		class?: string;
	}

	const {
		organizationSlug,
		organizationName,
		contactMethod,
		contactEmail = null,
		isAuthenticated,
		variant = 'outline',
		class: className = ''
	}: Props = $props();

	const accessToken = $derived(authStore.accessToken);

	let showDialog = $state(false);
	let subject = $state('');
	let message = $state('');
	let submitted = $state(false);

	const buttonClasses = $derived(
		variant === 'primary'
			? `inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${className}`
			: `inline-flex items-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${className}`
	);

	const contactMutation = createMutation(() => ({
		mutationFn: async () => {
			if (!accessToken) {
				throw new Error(m['orgContactButton.errors_loginRequired']());
			}

			const response = await organizationContactOrganization({
				path: { slug: organizationSlug },
				body: {
					subject: subject.trim() || undefined,
					message: message.trim()
				},
				headers: {
					Authorization: `Bearer ${accessToken}`
				}
			});

			if (response.error) {
				throw new Error(
					extractErrorMessage(response.error, m['orgContactButton.errors_genericFailure']())
				);
			}

			return response.data;
		},
		onSuccess: () => {
			submitted = true;
			toast.success(m['orgContactButton.toast_messageSent']());
		}
	}));

	function handleOpenChange(open: boolean) {
		if (open && !isAuthenticated) {
			window.location.href = `/login?redirect=${encodeURIComponent(window.location.pathname)}`;
			return;
		}
		showDialog = open;
		if (!open) {
			subject = '';
			message = '';
			submitted = false;
		}
	}

	function handleSubmit(e: Event) {
		e.preventDefault();
		if (!message.trim() || message.trim().length > 2000) return;
		contactMutation.mutate();
	}
</script>

{#if contactMethod === 'email' && contactEmail}
	<a
		href="mailto:{contactEmail}"
		class={buttonClasses}
		aria-label={m['orgContactButton.emailAriaLabel']({ organizationName })}
	>
		<Mail class="h-4 w-4" aria-hidden="true" />
		{m['orgContactButton.contactOrganizer']()}
	</a>
{:else if contactMethod === 'form'}
	<Dialog.Root open={showDialog} onOpenChange={handleOpenChange}>
		<Dialog.Trigger class={buttonClasses}>
			<Mail class="h-4 w-4" aria-hidden="true" />
			{m['orgContactButton.contactOrganizer']()}
		</Dialog.Trigger>

		<Dialog.Content class="sm:max-w-[500px]">
			{#if submitted}
				<div class="py-8 text-center">
					<div
						class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900"
					>
						<Check class="h-8 w-8 text-green-600 dark:text-green-300" aria-hidden="true" />
					</div>
					<Dialog.Title class="text-xl font-semibold">
						{m['orgContactButton.successTitle']()}
					</Dialog.Title>
					<Dialog.Description class="mt-2">
						{m['orgContactButton.successDesc']({ organizationName })}
					</Dialog.Description>
					<div class="mt-6 flex justify-center">
						<Button type="button" onclick={() => handleOpenChange(false)}>
							{m['orgContactButton.close']()}
						</Button>
					</div>
				</div>
			{:else}
				<Dialog.Header>
					<Dialog.Title>
						{m['orgContactButton.dialogTitle']({ organizationName })}
					</Dialog.Title>
					<Dialog.Description>
						{m['orgContactButton.dialogDesc']({ organizationName })}
					</Dialog.Description>
				</Dialog.Header>

				<form onsubmit={handleSubmit} class="space-y-4">
					<div>
						<label for="contact-subject" class="block text-sm font-medium">
							{m['orgContactButton.subjectLabel']()}
							<span class="text-muted-foreground">{m['orgContactButton.subjectOptional']()}</span>
						</label>
						<input
							id="contact-subject"
							type="text"
							bind:value={subject}
							maxlength="200"
							disabled={contactMutation.isPending}
							placeholder={m['orgContactButton.subjectPlaceholder']()}
							class="mt-1 w-full rounded-md border-2 border-gray-300 bg-white px-3 py-2 text-sm transition-colors placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
						/>
					</div>

					<div>
						<label for="contact-message" class="block text-sm font-medium">
							{m['orgContactButton.messageLabel']()}
						</label>
						<textarea
							id="contact-message"
							bind:value={message}
							rows="5"
							maxlength="2000"
							required
							disabled={contactMutation.isPending}
							placeholder={m['orgContactButton.messagePlaceholder']()}
							class="mt-1 w-full rounded-md border-2 border-gray-300 bg-white px-3 py-2 text-sm transition-colors placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
						></textarea>
						<p class="mt-1 text-xs text-muted-foreground">
							{message.length}/2000 {m['orgContactButton.characters']()}
						</p>
					</div>

					{#if contactMutation.isError}
						<div
							class="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-100"
							role="alert"
						>
							{contactMutation.error?.message || m['orgContactButton.errors_genericFailure']()}
						</div>
					{/if}

					<Dialog.Footer>
						<Button
							type="button"
							variant="outline"
							onclick={() => handleOpenChange(false)}
							disabled={contactMutation.isPending}
						>
							{m['orgContactButton.cancel']()}
						</Button>
						<Button
							type="submit"
							disabled={contactMutation.isPending ||
								!message.trim() ||
								message.trim().length > 2000}
						>
							{#if contactMutation.isPending}
								<div
									class="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent"
									aria-hidden="true"
								></div>
								{m['orgContactButton.sending']()}
							{:else}
								<Send class="mr-2 h-4 w-4" aria-hidden="true" />
								{m['orgContactButton.send']()}
							{/if}
						</Button>
					</Dialog.Footer>
				</form>
			{/if}
		</Dialog.Content>
	</Dialog.Root>
{/if}
