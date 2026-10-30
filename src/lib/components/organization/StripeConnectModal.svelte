<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { Button } from '$lib/components/ui/button';
	import {
		Dialog,
		DialogContent,
		DialogClose,
		DialogDescription,
		DialogTitle
	} from '$lib/components/ui/dialog';
	import { X, Mail, AlertCircle, Loader2 } from '@lucide/svelte';

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
	let emailInput = $state<HTMLInputElement | null>(null);

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

	function handleOpenChange(next: boolean) {
		// Closing mid-request would hide the outcome.
		if (!next && !isLoading) {
			onCancel();
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !isLoading && email.trim()) {
			e.preventDefault();
			handleConfirm();
		}
	}
</script>

<Dialog open={show} onOpenChange={handleOpenChange}>
	<DialogContent
		class="max-w-md"
		showCloseButton={false}
		escapeKeydownBehavior={isLoading ? 'ignore' : 'close'}
		interactOutsideBehavior={isLoading ? 'ignore' : 'close'}
		onOpenAutoFocus={(e) => {
			e.preventDefault();
			emailInput?.focus();
		}}
	>
		<div>
			<!-- Header -->
			<div class="mb-4 flex items-start justify-between">
				<div class="flex items-center gap-2">
					<div class="rounded-full bg-primary/10 p-2">
						<Mail class="h-5 w-5 text-primary" aria-hidden="true" />
					</div>
					<DialogTitle class="text-lg font-bold">
						{m['stripeConnectModal.title']()}
					</DialogTitle>
				</div>
				<DialogClose
					disabled={isLoading}
					class="-m-2 inline-flex h-11 w-11 items-center justify-center rounded-md transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
					aria-label={m['stripeConnectModal.closeButton']()}
				>
					<X class="h-5 w-5" aria-hidden="true" />
				</DialogClose>
			</div>

			<!-- Description -->
			<DialogDescription class="mb-4 text-sm text-muted-foreground">
				{m['stripeConnectModal.description']()}
			</DialogDescription>

			<!-- Email Input -->
			<div class="mb-4">
				<label for="stripe-email" class="mb-1.5 block text-sm font-medium">
					{m['stripeConnectModal.emailLabel']()}
					<span class="text-destructive" aria-label={m['stripeConnectModal.required']()}>*</span>
				</label>
				<input
					id="stripe-email"
					bind:this={emailInput}
					onkeydown={handleKeydown}
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
				<Button
					variant="outline"
					onclick={() => handleOpenChange(false)}
					disabled={isLoading}
					class="min-w-[80px]"
				>
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
	</DialogContent>
</Dialog>
