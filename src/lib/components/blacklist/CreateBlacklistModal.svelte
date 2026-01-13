<script lang="ts">
	import type { BlacklistCreateSchema } from '$lib/api/generated/types.gen';
	import {
		Dialog,
		DialogContent,
		DialogHeader,
		DialogTitle,
		DialogDescription,
		DialogFooter
	} from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Textarea } from '$lib/components/ui/textarea';
	import { Loader2, AlertTriangle } from 'lucide-svelte';

	interface Props {
		open: boolean;
		onClose: () => void;
		onCreate: (data: BlacklistCreateSchema) => void;
		isCreating?: boolean;
	}

	let { open, onClose, onCreate, isCreating = false }: Props = $props();

	// Form state
	let email = $state('');
	let telegramUsername = $state('');
	let phoneNumber = $state('');
	let firstName = $state('');
	let lastName = $state('');
	let preferredName = $state('');
	let reason = $state('');

	// Reset form when modal closes
	$effect(() => {
		if (!open) {
			email = '';
			telegramUsername = '';
			phoneNumber = '';
			firstName = '';
			lastName = '';
			preferredName = '';
			reason = '';
		}
	});

	// Validate that at least one identifier or name is provided
	let isValid = $derived(
		!!(
			email.trim() ||
			telegramUsername.trim() ||
			phoneNumber.trim() ||
			firstName.trim() ||
			lastName.trim() ||
			preferredName.trim()
		)
	);

	function handleSubmit() {
		const data: BlacklistCreateSchema = {
			reason: reason.trim() || ''
		};

		if (email.trim()) data.email = email.trim();
		if (telegramUsername.trim()) data.telegram_username = telegramUsername.trim().replace(/^@/, '');
		if (phoneNumber.trim()) data.phone_number = phoneNumber.trim();
		if (firstName.trim()) data.first_name = firstName.trim();
		if (lastName.trim()) data.last_name = lastName.trim();
		if (preferredName.trim()) data.preferred_name = preferredName.trim();

		onCreate(data);
	}

	function handleOpenChange(isOpen: boolean) {
		if (!isOpen && !isCreating) {
			onClose();
		}
	}
</script>

<Dialog {open} onOpenChange={handleOpenChange}>
	<DialogContent class="max-w-lg">
		<DialogHeader>
			<DialogTitle>Add to Blacklist</DialogTitle>
			<DialogDescription>
				Add a person to the organization's blacklist. They will be blocked from accessing any events.
			</DialogDescription>
		</DialogHeader>

		<form onsubmit={(e) => { e.preventDefault(); handleSubmit(); }} class="space-y-4 py-4">
			<!-- Warning -->
			<div class="flex gap-3 rounded-md border border-amber-500/50 bg-amber-50 p-3 dark:bg-amber-950/30">
				<AlertTriangle class="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
				<div class="text-sm">
					<p class="font-medium text-amber-900 dark:text-amber-100">Important</p>
					<p class="mt-1 text-amber-800 dark:text-amber-200">
						If the provided identifiers (email, telegram, phone) match an existing registered user,
						the entry will automatically be linked to them.
					</p>
				</div>
			</div>

			<!-- Identifiers Section -->
			<div class="space-y-4">
				<p class="text-sm font-medium text-muted-foreground">Contact Information</p>

				<div class="space-y-2">
					<Label for="email">Email Address</Label>
					<Input
						id="email"
						type="email"
						bind:value={email}
						placeholder="email@example.com"
						disabled={isCreating}
					/>
				</div>

				<div class="grid gap-4 sm:grid-cols-2">
					<div class="space-y-2">
						<Label for="telegram">Telegram Username</Label>
						<Input
							id="telegram"
							bind:value={telegramUsername}
							placeholder="@username"
							disabled={isCreating}
						/>
					</div>
					<div class="space-y-2">
						<Label for="phone">Phone Number</Label>
						<Input
							id="phone"
							type="tel"
							bind:value={phoneNumber}
							placeholder="+1234567890"
							disabled={isCreating}
						/>
					</div>
				</div>
			</div>

			<!-- Name Section -->
			<div class="space-y-4">
				<p class="text-sm font-medium text-muted-foreground">Name Information</p>

				<div class="grid gap-4 sm:grid-cols-2">
					<div class="space-y-2">
						<Label for="first-name">First Name</Label>
						<Input
							id="first-name"
							bind:value={firstName}
							placeholder="First name"
							disabled={isCreating}
						/>
					</div>
					<div class="space-y-2">
						<Label for="last-name">Last Name</Label>
						<Input
							id="last-name"
							bind:value={lastName}
							placeholder="Last name"
							disabled={isCreating}
						/>
					</div>
				</div>

				<div class="space-y-2">
					<Label for="preferred-name">Preferred Name / Alias</Label>
					<Input
						id="preferred-name"
						bind:value={preferredName}
						placeholder="Known as..."
						disabled={isCreating}
					/>
					<p class="text-xs text-muted-foreground">
						If this person goes by a different name or alias, enter it here. This helps with fuzzy matching.
					</p>
				</div>
			</div>

			<!-- Reason Section -->
			<div class="space-y-2">
				<Label for="reason">Reason for Blacklisting</Label>
				<Textarea
					id="reason"
					bind:value={reason}
					placeholder="Explain why this person should be blacklisted..."
					rows={3}
					disabled={isCreating}
				/>
			</div>

			{#if !isValid}
				<p class="text-sm text-muted-foreground">
					Please provide at least one identifier (email, telegram, phone) or name.
				</p>
			{/if}
		</form>

		<DialogFooter>
			<Button variant="outline" onclick={() => handleOpenChange(false)} disabled={isCreating}>
				Cancel
			</Button>
			<Button onclick={handleSubmit} disabled={!isValid || isCreating}>
				{#if isCreating}
					<Loader2 class="mr-2 h-4 w-4 animate-spin" />
				{/if}
				Add to Blacklist
			</Button>
		</DialogFooter>
	</DialogContent>
</Dialog>
