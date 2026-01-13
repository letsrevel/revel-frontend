<script lang="ts">
	import type { BlacklistEntrySchema } from '$lib/api/generated/types.gen';
	import {
		Dialog,
		DialogContent,
		DialogHeader,
		DialogTitle,
		DialogFooter
	} from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Textarea } from '$lib/components/ui/textarea';
	import { Loader2, Trash2, User, Mail, Phone, MessageCircle, Calendar } from 'lucide-svelte';
	import { formatDistanceToNow } from 'date-fns';

	interface Props {
		entry: BlacklistEntrySchema | null;
		open: boolean;
		onClose: () => void;
		onUpdate: (updates: { reason?: string; first_name?: string; last_name?: string; preferred_name?: string }) => void;
		onDelete: () => void;
		isUpdating?: boolean;
		isDeleting?: boolean;
	}

	let {
		entry,
		open,
		onClose,
		onUpdate,
		onDelete,
		isUpdating = false,
		isDeleting = false
	}: Props = $props();

	// Form state
	let reason = $state(entry?.reason || '');
	let firstName = $state(entry?.first_name || '');
	let lastName = $state(entry?.last_name || '');
	let preferredName = $state(entry?.preferred_name || '');
	let showDeleteConfirm = $state(false);

	// Reset form when entry changes
	$effect(() => {
		if (entry) {
			reason = entry.reason || '';
			firstName = entry.first_name || '';
			lastName = entry.last_name || '';
			preferredName = entry.preferred_name || '';
			showDeleteConfirm = false;
		}
	});

	// Display name
	let displayName = $derived.by(() => {
		if (!entry) return '';
		if (entry.user_display_name) return entry.user_display_name;
		if (entry.preferred_name) return entry.preferred_name;
		if (entry.first_name && entry.last_name) return `${entry.first_name} ${entry.last_name}`;
		if (entry.first_name) return entry.first_name;
		if (entry.email) return entry.email;
		if (entry.telegram_username) return `@${entry.telegram_username}`;
		return 'Unknown';
	});

	// Check if linked to a registered user
	let isLinkedUser = $derived(!!entry?.user_id);

	// Format created date
	let createdAgo = $derived(
		entry?.created_at
			? formatDistanceToNow(new Date(entry.created_at), { addSuffix: true })
			: 'Unknown'
	);

	// Check if there are changes
	let hasChanges = $derived(
		reason !== (entry?.reason || '') ||
			firstName !== (entry?.first_name || '') ||
			lastName !== (entry?.last_name || '') ||
			preferredName !== (entry?.preferred_name || '')
	);

	function handleSave() {
		const updates: { reason?: string; first_name?: string; last_name?: string; preferred_name?: string } = {};

		if (reason !== (entry?.reason || '')) {
			updates.reason = reason || undefined;
		}
		if (firstName !== (entry?.first_name || '')) {
			updates.first_name = firstName || undefined;
		}
		if (lastName !== (entry?.last_name || '')) {
			updates.last_name = lastName || undefined;
		}
		if (preferredName !== (entry?.preferred_name || '')) {
			updates.preferred_name = preferredName || undefined;
		}

		onUpdate(updates);
	}

	function handleDelete() {
		if (!showDeleteConfirm) {
			showDeleteConfirm = true;
		} else {
			onDelete();
		}
	}

	function handleOpenChange(isOpen: boolean) {
		if (!isOpen && !isUpdating && !isDeleting) {
			showDeleteConfirm = false;
			onClose();
		}
	}
</script>

<Dialog {open} onOpenChange={handleOpenChange}>
	<DialogContent class="max-w-lg">
		<DialogHeader>
			<DialogTitle>Blacklist Entry: {displayName}</DialogTitle>
		</DialogHeader>

		{#if entry}
			<div class="space-y-4 py-4">
				<!-- Status Badge -->
				<div class="flex items-center gap-2">
					{#if isLinkedUser}
						<span
							class="inline-flex items-center rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-800 dark:bg-purple-900 dark:text-purple-100"
						>
							<User class="mr-1 h-3 w-3" />
							Registered User
						</span>
					{:else}
						<span
							class="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-800 dark:bg-gray-800 dark:text-gray-100"
						>
							Manual Entry
						</span>
					{/if}
				</div>

				<!-- Contact Details (Read-only) -->
				<div class="rounded-md border border-border bg-muted/30 p-3 space-y-2">
					<p class="text-xs font-medium text-muted-foreground uppercase">Contact Information (Read-only)</p>

					{#if entry.email}
						<div class="flex items-center gap-2 text-sm">
							<Mail class="h-4 w-4 text-muted-foreground" />
							<span>{entry.email}</span>
						</div>
					{/if}

					{#if entry.telegram_username}
						<div class="flex items-center gap-2 text-sm">
							<MessageCircle class="h-4 w-4 text-muted-foreground" />
							<span>@{entry.telegram_username}</span>
						</div>
					{/if}

					{#if entry.phone_number}
						<div class="flex items-center gap-2 text-sm">
							<Phone class="h-4 w-4 text-muted-foreground" />
							<span>{entry.phone_number}</span>
						</div>
					{/if}

					{#if !entry.email && !entry.telegram_username && !entry.phone_number}
						<p class="text-sm text-muted-foreground italic">No contact information</p>
					{/if}
				</div>

				<!-- Editable Fields -->
				{#if !isLinkedUser}
					<div class="grid gap-4 sm:grid-cols-2">
						<div class="space-y-2">
							<Label for="first-name">First Name</Label>
							<Input
								id="first-name"
								bind:value={firstName}
								placeholder="First name"
								disabled={isUpdating || isDeleting}
							/>
						</div>
						<div class="space-y-2">
							<Label for="last-name">Last Name</Label>
							<Input
								id="last-name"
								bind:value={lastName}
								placeholder="Last name"
								disabled={isUpdating || isDeleting}
							/>
						</div>
					</div>

					<div class="space-y-2">
						<Label for="preferred-name">Preferred Name</Label>
						<Input
							id="preferred-name"
							bind:value={preferredName}
							placeholder="Preferred name or nickname"
							disabled={isUpdating || isDeleting}
						/>
					</div>
				{/if}

				<div class="space-y-2">
					<Label for="reason">Reason for Blacklisting</Label>
					<Textarea
						id="reason"
						bind:value={reason}
						placeholder="Explain why this person is blacklisted..."
						rows={3}
						disabled={isUpdating || isDeleting}
					/>
				</div>

				<!-- Metadata -->
				<div class="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
					<span class="flex items-center gap-1">
						<Calendar class="h-3 w-3" />
						Added {createdAgo}
					</span>
					{#if entry.created_by_name}
						<span>by {entry.created_by_name}</span>
					{/if}
				</div>

				<!-- Delete Confirmation -->
				{#if showDeleteConfirm}
					<div class="rounded-md border border-destructive/50 bg-destructive/10 p-3">
						<p class="text-sm font-medium text-destructive">
							Are you sure you want to remove this blacklist entry?
						</p>
						<p class="mt-1 text-xs text-muted-foreground">
							{#if isLinkedUser}
								The user will regain access to this organization.
							{:else}
								This action cannot be undone.
							{/if}
						</p>
					</div>
				{/if}
			</div>

			<DialogFooter class="flex-col gap-2 sm:flex-row sm:justify-between">
				<Button
					variant="destructive"
					onclick={handleDelete}
					disabled={isUpdating || isDeleting}
				>
					{#if isDeleting}
						<Loader2 class="mr-2 h-4 w-4 animate-spin" />
						Removing...
					{:else if showDeleteConfirm}
						<Trash2 class="mr-2 h-4 w-4" />
						Confirm Remove
					{:else}
						<Trash2 class="mr-2 h-4 w-4" />
						Remove from Blacklist
					{/if}
				</Button>

				<div class="flex gap-2">
					<Button
						variant="outline"
						onclick={() => handleOpenChange(false)}
						disabled={isUpdating || isDeleting}
					>
						Cancel
					</Button>
					<Button
						onclick={handleSave}
						disabled={!hasChanges || isUpdating || isDeleting}
					>
						{#if isUpdating}
							<Loader2 class="mr-2 h-4 w-4 animate-spin" />
						{/if}
						Save Changes
					</Button>
				</div>
			</DialogFooter>
		{/if}
	</DialogContent>
</Dialog>
