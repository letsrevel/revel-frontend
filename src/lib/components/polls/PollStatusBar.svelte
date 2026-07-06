<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { Button } from '$lib/components/ui/button';
	import { ExternalLink, Play, StopCircle, RotateCcw } from '@lucide/svelte';
	import PollStatusBadge from './PollStatusBadge.svelte';
	import PollUrlStrip from './PollUrlStrip.svelte';
	import PollReopenDialog from './PollReopenDialog.svelte';
	import { toast } from 'svelte-sonner';
	import { invalidateAll } from '$app/navigation';
	import {
		pollOpenPollAction,
		pollClosePollAction,
		pollReopenPollAction
	} from '$lib/api/generated/sdk.gen';
	import type { PollDetailSchema } from '$lib/api/generated/types.gen';
	import { formatDateTime } from '$lib/utils/date';

	interface Props {
		poll: PollDetailSchema;
		voterUrl: string;
		accessToken: string;
	}
	const { poll, voterUrl, accessToken }: Props = $props();

	let busy = $state(false);
	let reopenOpen = $state(false);

	function authHeaders() {
		return { Authorization: `Bearer ${accessToken}` };
	}

	async function openPoll() {
		busy = true;
		try {
			const r = await pollOpenPollAction({ path: { poll_id: poll.id }, headers: authHeaders() });
			if (r.error) throw new Error(`open poll failed: ${JSON.stringify(r.error)}`);
			await invalidateAll();
		} catch (e) {
			console.error(e);
			toast.error(m['pollStatusBar.lifecycleError']());
		} finally {
			busy = false;
		}
	}

	async function closePoll() {
		busy = true;
		try {
			const r = await pollClosePollAction({ path: { poll_id: poll.id }, headers: authHeaders() });
			if (r.error) throw new Error(`close poll failed: ${JSON.stringify(r.error)}`);
			await invalidateAll();
		} catch (e) {
			console.error(e);
			toast.error(m['pollStatusBar.lifecycleError']());
		} finally {
			busy = false;
		}
	}

	async function reopen(closesAt: string | null, clearClosesAt: boolean) {
		busy = true;
		try {
			const r = await pollReopenPollAction({
				path: { poll_id: poll.id },
				headers: authHeaders(),
				body: { closes_at: closesAt, clear_closes_at: clearClosesAt }
			});
			if (r.error) {
				// Surface the backend's specific message (e.g. "Closing time must
				// be in the future.") instead of a generic lifecycle toast — the
				// reopen endpoint has user-actionable validation that the operator
				// needs to see.
				const detail =
					(r.error as { detail?: string } | undefined)?.detail ?? JSON.stringify(r.error);
				throw new Error(detail);
			}
			reopenOpen = false;
			await invalidateAll();
		} catch (e) {
			console.error(e);
			toast.error(e instanceof Error ? e.message : m['pollStatusBar.lifecycleError']());
		} finally {
			busy = false;
		}
	}
</script>

<div class="mb-6 space-y-3 rounded-lg border bg-card p-4">
	<div class="flex flex-wrap items-center justify-between gap-2">
		<div class="flex flex-wrap items-center gap-2">
			<PollStatusBadge status={poll.status} />
			{#if poll.opened_at}
				<span class="text-xs text-muted-foreground"
					>{m['pollStatusBar.openedAt']({ at: formatDateTime(poll.opened_at) })}</span
				>
			{/if}
			{#if poll.closed_at}
				<span class="text-xs text-muted-foreground"
					>{m['pollStatusBar.closedAt']({ at: formatDateTime(poll.closed_at) })}</span
				>
			{/if}
			{#if poll.status === 'open' && poll.closes_at}
				<span class="text-xs text-muted-foreground"
					>{m['pollStatusBar.closesAt']({ at: formatDateTime(poll.closes_at) })}</span
				>
			{/if}
		</div>
		<div class="flex flex-wrap gap-2">
			{#if poll.status === 'draft'}
				<Button onclick={openPoll} disabled={busy} class="gap-2">
					<Play class="h-4 w-4" />
					{m['pollStatusBar.openButton']()}
				</Button>
			{/if}
			{#if poll.status === 'open'}
				<Button variant="outline" onclick={closePoll} disabled={busy} class="gap-2">
					<StopCircle class="h-4 w-4" />
					{m['pollStatusBar.closeButton']()}
				</Button>
			{/if}
			{#if poll.status === 'closed'}
				<Button variant="outline" onclick={() => (reopenOpen = true)} disabled={busy} class="gap-2">
					<RotateCcw class="h-4 w-4" />
					{m['pollStatusBar.reopenButton']()}
				</Button>
			{/if}
			<Button
				variant="ghost"
				onclick={() => window.open(voterUrl, '_blank', 'noopener')}
				class="gap-2"
			>
				<ExternalLink class="h-4 w-4" />
				{m['pollStatusBar.viewAsVoter']()}
			</Button>
		</div>
	</div>
	{#if poll.status !== 'draft'}
		<PollUrlStrip url={voterUrl} />
	{/if}
</div>

<PollReopenDialog
	bind:open={reopenOpen}
	submitting={busy}
	currentClosesAt={poll.closes_at}
	onCancel={() => (reopenOpen = false)}
	onConfirm={reopen}
/>
