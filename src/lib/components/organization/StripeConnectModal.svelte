<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { Button } from '$lib/components/ui/button';
	import { X, Mail, AlertCircle, Loader2 } from 'lucide-svelte';

	interface Props {
		show: boolean;
		initialEmail?: string;
		isLoading?: boolean;
		error?: string | null;
		onConfirm: (email: string) => void;
		onCancel: () => void;
	}

	let {
		show = $bindable(),
		initialEmail = '',
		isLoading = false,
		error = null,
		onConfirm,
		onCancel
	}: Props = $props();

	let email = $state(initialEmail);

	// Sync email with initialEmail when modal opens
	$effect(() => {
		if (show) {
			email = initialEmail;
		}
	});

	function handleConfirm() {
		if (email.trim()) {
			onConfirm(email.trim());
		}
	}

	function handleCancel() {
		if (!isLoading) {
			onCancel();
		}
	}

	function handleBackdropClick(e: MouseEvent) {
		if (e.target === e.currentTarget && !isLoading) {
			handleCancel();
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !isLoading && email.trim()) {
			e.preventDefault();
			handleConfirm();
		} else if (e.key === 'Escape' && !isLoading) {
			e.preventDefault();
			handleCancel();
		}
	}
</script>

{#if show}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
		onclick={handleBackdropClick}
		onkeydown={handleKeydown}
		role="dialog"
		aria-modal="true"
		aria-labelledby="stripe-connect-modal-title"
		aria-describedby="stripe-connect-modal-description"
		tabindex="-1"
	>
		<div class="w-full max-w-md rounded-lg bg-background p-6 shadow-xl">
			<!-- Header -->
			<div class="mb-4 flex items-start justify-between">
				<div class="flex items-center gap-2">
					<div class="rounded-full bg-primary/10 p-2">
						<Mail class="h-5 w-5 text-primary" aria-hidden="true" />
					</div>
					<h3 id="stripe-connect-modal-title" class="text-lg font-semibold">
						{m['stripeConnectModal.title']()}
					</h3>
				</div>
				<button
					type="button"
					onclick={handleCancel}
					disabled={isLoading}
					class="rounded-md p-1 transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
					aria-label={m['stripeConnectModal.closeButton']()}
				>
					<X class="h-5 w-5" aria-hidden="true" />
				</button>
			</div>

			<!-- Description -->
			<p id="stripe-connect-modal-description" class="mb-4 text-sm text-muted-foreground">
				{m['stripeConnectModal.description']()}
			</p>

			<!-- Email Input -->
			<div class="mb-4">
				<label for="stripe-email" class="mb-1.5 block text-sm font-medium">
					{m['stripeConnectModal.emailLabel']()}
					<span class="text-destructive" aria-label="required">*</span>
				</label>
				<input
					id="stripe-email"
					type="email"
					bind:value={email}
					disabled={isLoading}
					placeholder={m['stripeConnectModal.emailPlaceholder']()}
					required
					aria-required="true"
					aria-invalid={!!error}
					aria-describedby={error ? 'stripe-email-error' : 'stripe-email-help'}
					class="w-full rounded-md border-2 border-input bg-background px-3 py-2 text-sm transition-colors placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
				/>
				<p id="stripe-email-help" class="mt-1.5 text-xs text-muted-foreground">
					{m['stripeConnectModal.emailHelp']()}
				</p>
			</div>

			<!-- Error Display -->
			{#if error}
				<div
					id="stripe-email-error"
					class="mb-4 flex items-start gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-destructive"
					role="alert"
				>
					<AlertCircle class="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
					<p class="text-sm">{error}</p>
				</div>
			{/if}

			<!-- Actions -->
			<div class="flex justify-end gap-3">
				<Button variant="outline" onclick={handleCancel} disabled={isLoading} class="min-w-[80px]">
					{m['stripeConnectModal.cancelButton']()}
				</Button>
				<Button onclick={handleConfirm} disabled={isLoading || !email.trim()} class="min-w-[120px]">
					{#if isLoading}
						<Loader2 class="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
						{m['stripeConnectModal.connectingButton']()}
					{:else}
						{m['stripeConnectModal.confirmButton']()}
					{/if}
				</Button>
			</div>

			<!-- Additional Info -->
			<div class="mt-4 rounded-md bg-muted p-3">
				<p class="text-xs text-muted-foreground">
					{m['stripeConnectModal.additionalInfo']()}
				</p>
			</div>
		</div>
	</div>
{/if}
