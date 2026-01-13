<script lang="ts">
	import type { WhitelistEntrySchema } from '$lib/api/generated/types.gen';
	import { Button } from '$lib/components/ui/button';
	import { Trash2, Mail, Calendar, ShieldCheck, AlertCircle } from 'lucide-svelte';
	import { formatDistanceToNow } from 'date-fns';

	interface Props {
		entry: WhitelistEntrySchema;
		onRemove: (entry: WhitelistEntrySchema) => void;
		isRemoving?: boolean;
	}

	let { entry, onRemove, isRemoving = false }: Props = $props();

	// Format created date
	let createdAgo = $derived(
		entry.created_at
			? formatDistanceToNow(new Date(entry.created_at), { addSuffix: true })
			: 'Unknown'
	);

	function handleRemove() {
		onRemove(entry);
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
					{entry.user_display_name}
				</h3>
				<span class="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900 dark:text-green-100">
					<ShieldCheck class="h-3 w-3" />
					Verified
				</span>
			</div>

			<!-- Email -->
			<div class="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
				<Mail class="h-3.5 w-3.5 shrink-0" />
				<span class="truncate">{entry.user_email}</span>
			</div>

			<!-- Matched blacklist entries info -->
			<div class="mt-2">
				<span class="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-950 dark:text-amber-200">
					<AlertCircle class="h-3 w-3" />
					Cleared despite matching {entry.matched_entries_count} blacklist {entry.matched_entries_count === 1 ? 'entry' : 'entries'}
				</span>
			</div>

			<!-- Metadata -->
			<div class="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
				<span class="flex items-center gap-1">
					<Calendar class="h-3 w-3" />
					Whitelisted {createdAgo}
				</span>
				{#if entry.approved_by_name}
					<span>by {entry.approved_by_name}</span>
				{/if}
			</div>
		</div>

		<!-- Actions -->
		<div class="flex shrink-0">
			<Button
				variant="outline"
				size="sm"
				onclick={handleRemove}
				disabled={isRemoving}
				class="text-destructive hover:bg-destructive hover:text-destructive-foreground"
				aria-label="Remove {entry.user_display_name} from whitelist"
			>
				<Trash2 class="h-4 w-4" />
				<span class="sr-only md:not-sr-only md:ml-1">Remove</span>
			</Button>
		</div>
	</div>
</div>
