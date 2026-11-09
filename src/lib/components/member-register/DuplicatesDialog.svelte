<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { GitMerge, Loader2 } from '@lucide/svelte';
	import type { PossibleDuplicateSchema } from '$lib/api/generated/types.gen';
	import {
		Dialog,
		DialogContent,
		DialogDescription,
		DialogHeader,
		DialogTitle
	} from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import EmptyState from '$lib/components/common/EmptyState.svelte';
	import type { DescribedError } from '$lib/member-register/errors';
	import DuplicatesList from './DuplicatesList.svelte';
	import RegisterErrorAlert from './RegisterErrorAlert.svelte';

	interface Props {
		open: boolean;
		pairs: PossibleDuplicateSchema[];
		isPending: boolean;
		error: DescribedError | null;
		onRetry: () => void;
		onMerge: (pair: PossibleDuplicateSchema) => void;
		onClose: () => void;
	}

	const { open, pairs, isPending, error, onRetry, onMerge, onClose }: Props = $props();
</script>

<Dialog {open} onOpenChange={(next) => !next && onClose()}>
	<DialogContent class="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
		<DialogHeader>
			<DialogTitle>{m['memberPeople.attention.duplicatesTitle']()}</DialogTitle>
			<DialogDescription>{m['memberRegister.duplicatesIntro']()}</DialogDescription>
		</DialogHeader>
		{#if isPending}
			<p class="flex items-center gap-2 py-8 text-sm text-muted-foreground" role="status">
				<Loader2 class="h-4 w-4 animate-spin" aria-hidden="true" />
				{m['memberRegister.loading']()}
			</p>
		{:else if error}
			<div class="space-y-3">
				<RegisterErrorAlert {error} />
				<Button variant="outline" onclick={onRetry}>{m['memberRegister.retry']()}</Button>
			</div>
		{:else if pairs.length === 0}
			<EmptyState
				icon={GitMerge}
				title={m['memberRegister.duplicatesEmptyTitle']()}
				body={m['memberRegister.duplicatesEmptyBody']()}
			/>
		{:else}
			<DuplicatesList {pairs} {onMerge} />
		{/if}
	</DialogContent>
</Dialog>
