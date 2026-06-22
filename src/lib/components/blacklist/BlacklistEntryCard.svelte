<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type { BlacklistEntrySchema } from '$lib/api/generated/types.gen';
	import { Button } from '$lib/components/ui/button';
	import { Settings, User, Mail, Phone, MessageCircle, Calendar } from 'lucide-svelte';
	import { formatDistanceToNow } from 'date-fns';

	interface Props {
		entry: BlacklistEntrySchema;
		onManage: (entry: BlacklistEntrySchema) => void;
	}

	const { entry, onManage }: Props = $props();

	// Format created date
	const createdAgo = $derived(
		entry.created_at
			? formatDistanceToNow(new Date(entry.created_at), { addSuffix: true })
			: m['blacklistEntryCard.unknown']()
	);

	// Display name from entry
	const displayName = $derived.by(() => {
		if (entry.user_display_name) return entry.user_display_name;
		if (entry.preferred_name) return entry.preferred_name;
		if (entry.first_name && entry.last_name) return `${entry.first_name} ${entry.last_name}`;
		if (entry.first_name) return entry.first_name;
		if (entry.email) return entry.email;
		if (entry.telegram_username) return `@${entry.telegram_username}`;
		return m['blacklistEntryCard.unknown']();
	});

	// Check if linked to a registered user
	const isLinkedUser = $derived(!!entry.user_id);

	function handleManage() {
		onManage(entry);
	}
</script>

<div
	class="rounded-lg border border-border bg-card p-4 shadow-sm transition-shadow hover:shadow-md"
>
	<div class="flex items-start justify-between gap-4">
		<!-- Entry Info -->
		<div class="min-w-0 flex-1">
			<div class="flex items-center gap-2">
				<h3 class="truncate font-semibold text-foreground">
					{displayName}
				</h3>
				{#if isLinkedUser}
					<span
						class="inline-flex items-center rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-800 dark:bg-purple-900 dark:text-purple-100"
					>
						<User class="mr-1 h-3 w-3" />
						{m['blacklistEntryCard.registeredUser']()}
					</span>
				{/if}
			</div>

			<!-- Contact Details -->
			<div class="mt-2 space-y-1">
				{#if entry.email}
					<div class="flex items-center gap-2 text-sm text-muted-foreground">
						<Mail class="h-3.5 w-3.5 shrink-0" />
						<span class="truncate">{entry.email}</span>
					</div>
				{/if}

				{#if entry.telegram_username}
					<div class="flex items-center gap-2 text-sm text-muted-foreground">
						<MessageCircle class="h-3.5 w-3.5 shrink-0" />
						<span class="truncate">@{entry.telegram_username}</span>
					</div>
				{/if}

				{#if entry.phone_number}
					<div class="flex items-center gap-2 text-sm text-muted-foreground">
						<Phone class="h-3.5 w-3.5 shrink-0" />
						<span>{entry.phone_number}</span>
					</div>
				{/if}
			</div>

			<!-- Reason -->
			{#if entry.reason}
				<div class="mt-3 rounded-md bg-muted/50 p-2">
					<p class="text-sm font-medium text-muted-foreground">
						{m['blacklistEntryCard.reasonLabel']()}
					</p>
					<p class="text-sm text-foreground">{entry.reason}</p>
				</div>
			{/if}

			<!-- Metadata -->
			<div class="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
				<span class="flex items-center gap-1">
					<Calendar class="h-3 w-3" />
					{m['blacklistEntryCard.added']({ date: createdAgo })}
				</span>
				{#if entry.created_by_name}
					<span>{m['blacklistEntryCard.byName']({ name: entry.created_by_name })}</span>
				{/if}
			</div>
		</div>

		<!-- Actions -->
		<div class="flex shrink-0">
			<Button
				variant="outline"
				size="sm"
				onclick={handleManage}
				aria-label={m['blacklistEntryCard.manageAriaLabel']({ name: displayName })}
			>
				<Settings class="h-4 w-4" />
				<span class="sr-only md:not-sr-only md:ml-2">{m['blacklistEntryCard.manage']()}</span>
			</Button>
		</div>
	</div>
</div>
