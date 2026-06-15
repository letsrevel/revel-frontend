<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
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

	const { open, onClose, onCreate, isCreating = false }: Props = $props();

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
	const isValid = $derived(
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
	<DialogContent class="flex max-h-[90dvh] flex-col sm:max-w-lg">
		<DialogHeader class="shrink-0">
			<DialogTitle>{m['blacklistModal.title']()}</DialogTitle>
			<DialogDescription>
				{m['blacklistModal.description']()}
			</DialogDescription>
		</DialogHeader>

		<form
			onsubmit={(e) => {
				e.preventDefault();
				handleSubmit();
			}}
			class="flex min-h-0 flex-1 flex-col gap-4"
		>
			<div class="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
				<!-- Warning -->
				<div
					class="flex gap-3 rounded-md border border-amber-500/50 bg-amber-50 p-3 dark:bg-amber-950/30"
				>
					<AlertTriangle class="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
					<div class="text-sm">
						<p class="font-medium text-amber-900 dark:text-amber-100">
							{m['blacklistModal.importantHeader']()}
						</p>
						<p class="mt-1 text-amber-800 dark:text-amber-200">
							{m['blacklistModal.identifierMatchInfo']()}
						</p>
						<p class="mt-2 text-amber-800 dark:text-amber-200">
							{m['blacklistModal.gdprPersistInfo']()}
						</p>
					</div>
				</div>

				<!-- Identifiers Section -->
				<div class="space-y-4">
					<p class="text-sm font-medium text-muted-foreground">
						{m['blacklistModal.contactInfoHeader']()}
					</p>

					<div class="space-y-2">
						<Label for="email">{m['blacklistModal.emailLabel']()}</Label>
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
							<Label for="telegram">{m['blacklistModal.telegramLabel']()}</Label>
							<Input
								id="telegram"
								bind:value={telegramUsername}
								placeholder="@username"
								disabled={isCreating}
							/>
						</div>
						<div class="space-y-2">
							<Label for="phone">{m['blacklistModal.phoneLabel']()}</Label>
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
					<p class="text-sm font-medium text-muted-foreground">
						{m['blacklistModal.nameInfoHeader']()}
					</p>

					<div class="grid gap-4 sm:grid-cols-2">
						<div class="space-y-2">
							<Label for="first-name">{m['blacklistModal.firstNameLabel']()}</Label>
							<Input
								id="first-name"
								bind:value={firstName}
								placeholder={m['blacklistModal.firstNamePlaceholder']()}
								disabled={isCreating}
							/>
						</div>
						<div class="space-y-2">
							<Label for="last-name">{m['blacklistModal.lastNameLabel']()}</Label>
							<Input
								id="last-name"
								bind:value={lastName}
								placeholder={m['blacklistModal.lastNamePlaceholder']()}
								disabled={isCreating}
							/>
						</div>
					</div>

					<div class="space-y-2">
						<Label for="preferred-name">{m['blacklistModal.preferredNameLabel']()}</Label>
						<Input
							id="preferred-name"
							bind:value={preferredName}
							placeholder={m['blacklistModal.preferredNamePlaceholder']()}
							disabled={isCreating}
						/>
						<p class="text-xs text-muted-foreground">
							{m['blacklistModal.preferredNameHint']()}
						</p>
					</div>
				</div>

				<!-- Reason Section -->
				<div class="space-y-2">
					<Label for="reason">{m['blacklistModal.reasonLabel']()}</Label>
					<Textarea
						id="reason"
						bind:value={reason}
						placeholder={m['blacklistModal.reasonPlaceholder']()}
						rows={3}
						disabled={isCreating}
					/>
				</div>

				{#if !isValid}
					<p class="text-sm text-muted-foreground">
						{m['blacklistModal.atLeastOneRequiredHint']()}
					</p>
				{/if}
			</div>

			<DialogFooter class="shrink-0">
				<Button
					type="button"
					variant="outline"
					onclick={() => handleOpenChange(false)}
					disabled={isCreating}
				>
					{m['blacklistModal.cancelButton']()}
				</Button>
				<Button type="button" onclick={handleSubmit} disabled={!isValid || isCreating}>
					{#if isCreating}
						<Loader2 class="mr-2 h-4 w-4 animate-spin" />
					{/if}
					{m['blacklistModal.submitButton']()}
				</Button>
			</DialogFooter>
		</form>
	</DialogContent>
</Dialog>
