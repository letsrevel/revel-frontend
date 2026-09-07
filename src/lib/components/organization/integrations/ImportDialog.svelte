<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { untrack } from 'svelte';
	import { createMutation, createQuery, useQueryClient } from '@tanstack/svelte-query';
	import { resolve } from '$app/paths';
	import { AlertCircle, AlertTriangle, Check, Loader2 } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import {
		Dialog,
		DialogContent,
		DialogDescription,
		DialogFooter,
		DialogHeader,
		DialogTitle
	} from '$lib/components/ui/dialog';
	import StatusBadge from '$lib/components/common/StatusBadge.svelte';
	import type { Tone } from '$lib/components/common/tones';
	import type { RemoteEventSummarySchema } from '$lib/api/generated/types.gen';
	import {
		organizationintegrationsImportEvents,
		organizationintegrationsRemoteEvents
	} from '$lib/api/generated/sdk.gen';
	import { PollUntil } from '$lib/queries/poll-until';
	import { formatDate } from '$lib/utils/date';
	import {
		integrationErrorFromResponse,
		isIntegrationErrorInfo,
		silentIntegrationError,
		type IntegrationErrorInfo
	} from '$lib/utils/integration-errors';

	interface Props {
		open: boolean;
		onOpenChange: (open: boolean) => void;
		organizationSlug: string;
		provider: string;
		platform: string;
		/** Paid remote classes import with sales paused until Stripe is connected. */
		stripeConnected: boolean;
	}
	const { open, onOpenChange, organizationSlug, provider, platform, stripeConnected }: Props =
		$props();

	/** The backend caps one import request at this many ids. */
	const MAX_SELECTION = 50;

	type Phase = 'pick' | 'importing' | 'done' | 'timed_out';
	// What the user did; the poll's outcome refines `importing` into the rest.
	let stage = $state<'pick' | 'importing'>('pick');
	let selected = $state<string[]>([]);
	let queued = $state<string[]>([]);
	let skipped = $state<string[]>([]);
	let submitError = $state<IntegrationErrorInfo | null>(null);
	let timedOut = $state(false);

	const queryClient = useQueryClient();
	const listKey = $derived(['org-integration-remote-events', organizationSlug, provider] as const);

	async function fetchRemoteEvents(): Promise<RemoteEventSummarySchema[]> {
		const res = await organizationintegrationsRemoteEvents({
			path: { slug: organizationSlug, provider }
		});
		if (res.error || !res.data) throw integrationErrorFromResponse(res.error, platform);
		return res.data;
	}

	const remote = createQuery(() => ({
		queryKey: listKey,
		queryFn: fetchRemoteEvents,
		enabled: open && stage === 'pick'
	}));
	const loadError = $derived(isIntegrationErrorInfo(remote.error) ? remote.error : null);

	// Import is a 202 with no event ids; the observable signal is the remote list
	// reporting each queued id as `already_linked`. Bounded: 3 s for two minutes.
	const poll = new PollUntil<RemoteEventSummarySchema[]>({
		// Frozen at mount on purpose: the dialog is mounted once per provider card.
		queryKey: untrack(() => [...listKey, 'import']),
		queryFn: fetchRemoteEvents,
		isDone: (events) =>
			queued.every((id) => events.find((e) => e.remote_id === id)?.already_linked),
		enabled: () => stage === 'importing',
		onTimeout: () => {
			timedOut = true;
		}
	});
	const pollQuery = createQuery(() => poll.options());
	const linkedCount = $derived.by(() => {
		void timedOut;
		const events = pollQuery.data ?? [];
		return queued.filter((id) => events.find((e) => e.remote_id === id)?.already_linked).length;
	});
	const phase = $derived.by((): Phase => {
		if (stage === 'pick') return 'pick';
		void timedOut; // re-run when the deadline lapses, not just when data changes
		const p = poll.phase(pollQuery.data);
		return p === 'done' ? 'done' : p === 'timed_out' ? 'timed_out' : 'importing';
	});

	const importMutation = createMutation(() => ({
		mutationFn: async (remote_ids: string[]) => {
			const res = await organizationintegrationsImportEvents({
				path: { slug: organizationSlug, provider },
				body: { remote_ids }
			});
			if (res.error || !res.data) throw silentIntegrationError(res.error, platform);
			return res.data;
		},
		onSuccess: (data) => {
			queued = data.queued;
			skipped = data.skipped;
			timedOut = false;
			poll.reset();
			// With nothing queued the poll's `isDone` is vacuously true: 'done' at once.
			stage = 'importing';
		},
		onError: (err: unknown) => {
			submitError = isIntegrationErrorInfo(err) ? err : integrationErrorFromResponse(err, platform);
		}
	}));

	function toggle(id: string, checked: boolean) {
		if (checked) {
			if (selected.length >= MAX_SELECTION || selected.includes(id)) return;
			selected = [...selected, id];
		} else {
			selected = selected.filter((s) => s !== id);
		}
	}

	function close() {
		// A finished import changes `already_linked`; a reopened picker must not
		// offer the same events again.
		if (stage !== 'pick') void queryClient.invalidateQueries({ queryKey: listKey });
		stage = 'pick';
		selected = [];
		queued = [];
		skipped = [];
		submitError = null;
		onOpenChange(false);
	}

	const STATUS_TONE: Record<RemoteEventSummarySchema['status'], Tone> = {
		draft: 'info',
		live: 'success',
		cancelled: 'neutral'
	};
	function statusLabel(status: RemoteEventSummarySchema['status']): string {
		switch (status) {
			case 'live':
				return m['integrations.import.remoteStatus.live']();
			case 'cancelled':
				return m['integrations.import.remoteStatus.cancelled']();
			default:
				return m['integrations.import.remoteStatus.draft']();
		}
	}

	const submitLabel = $derived(
		selected.length === 0
			? m['integrations.import.submitNone']()
			: selected.length === 1
				? m['integrations.import.submitOne']()
				: m['integrations.import.submit']({ count: selected.length })
	);
	const eventsHref = $derived(
		resolve('/(auth)/org/[slug]/admin/events', { slug: organizationSlug })
	);
</script>

<Dialog {open} onOpenChange={(o) => (o ? onOpenChange(true) : close())}>
	<DialogContent class="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
		<DialogHeader>
			<DialogTitle>{m['integrations.import.title']({ platform })}</DialogTitle>
			<DialogDescription>{m['integrations.import.body']()}</DialogDescription>
		</DialogHeader>

		{#if phase === 'pick'}
			{#if !stripeConnected}
				<div
					class="flex items-start gap-3 rounded-lg border border-highlight/40 bg-highlight/20 p-3"
					role="alert"
				>
					<AlertTriangle
						class="mt-0.5 h-4 w-4 shrink-0 text-highlight-foreground dark:text-highlight"
						aria-hidden="true"
					/>
					<p class="text-sm text-highlight-foreground dark:text-highlight">
						{m['integrations.import.stripeWarning']()}
					</p>
				</div>
			{/if}

			{#if remote.isPending}
				<p class="flex items-center gap-2 text-sm text-muted-foreground" role="status">
					<Loader2 class="h-4 w-4 animate-spin" aria-hidden="true" />
					{m['integrations.import.loading']({ platform })}
				</p>
			{:else if loadError}
				<div
					class="flex items-start gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3"
					role="alert"
				>
					<AlertCircle class="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden="true" />
					<div class="min-w-0 text-sm text-foreground">
						<p>{loadError.message}</p>
						{#if loadError.providerMessage}
							<details class="mt-1 text-xs text-muted-foreground">
								<summary class="cursor-pointer"
									>{m['integrations.card.detailsFromPlatform']({ platform })}</summary
								>
								<p class="mt-1 break-words">{loadError.providerMessage}</p>
							</details>
						{/if}
					</div>
				</div>
			{:else if remote.data && remote.data.length === 0}
				<p class="text-sm text-foreground">{m['integrations.import.empty']({ platform })}</p>
			{:else if remote.data}
				<div class="overflow-x-auto rounded-lg border border-border">
					<table class="w-full text-sm">
						<thead class="bg-muted/50">
							<tr>
								<th class="w-10 px-3 py-2"
									><span class="sr-only">{m['integrations.import.submitNone']()}</span></th
								>
								<th
									class="px-3 py-2 text-left text-xs font-extrabold uppercase tracking-[0.12em] text-muted-foreground"
									>{m['integrations.import.column.event']()}</th
								>
								<th
									class="px-3 py-2 text-left text-xs font-extrabold uppercase tracking-[0.12em] text-muted-foreground"
									>{m['integrations.import.column.date']()}</th
								>
								<th
									class="px-3 py-2 text-left text-xs font-extrabold uppercase tracking-[0.12em] text-muted-foreground"
									>{m['integrations.import.column.status']()}</th
								>
							</tr>
						</thead>
						<tbody>
							{#each remote.data as ev (ev.remote_id)}
								{@const linked = ev.already_linked === true}
								{@const checked = selected.includes(ev.remote_id)}
								<tr class="border-t border-border {linked ? 'text-muted-foreground' : ''}">
									<td class="px-3 py-2">
										<Checkbox
											id={`import-${provider}-${ev.remote_id}`}
											aria-label={m['integrations.import.selectEvent']({ name: ev.name })}
											{checked}
											disabled={linked || (!checked && selected.length >= MAX_SELECTION)}
											onCheckedChange={(v) => toggle(ev.remote_id, v === true)}
										/>
									</td>
									<td class="px-3 py-2">
										<span class="font-medium text-foreground">{ev.name}</span>
										{#if linked}
											<span class="ml-2">
												<StatusBadge
													tone="neutral"
													label={m['integrations.import.alreadyInRevel']()}
													size="sm"
												/>
											</span>
										{/if}
									</td>
									<td class="whitespace-nowrap px-3 py-2">{formatDate(ev.start)}</td>
									<td class="px-3 py-2">
										<StatusBadge
											tone={STATUS_TONE[ev.status]}
											label={statusLabel(ev.status)}
											size="sm"
										/>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
				<p class="text-xs text-muted-foreground" aria-live="polite">
					{m['integrations.import.selected']({ count: selected.length, max: MAX_SELECTION })}
				</p>
			{/if}

			{#if submitError}
				<div
					class="flex items-start gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3"
					role="alert"
				>
					<AlertCircle class="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden="true" />
					<p class="text-sm text-foreground">{submitError.message}</p>
				</div>
			{/if}

			<DialogFooter>
				<Button variant="outline" onclick={close}>{m['integrations.import.close']()}</Button>
				<Button
					disabled={selected.length === 0 || importMutation.isPending}
					onclick={() => importMutation.mutate(selected)}
					class="inline-flex items-center gap-2"
				>
					{#if importMutation.isPending}
						<Loader2 class="h-4 w-4 animate-spin" aria-hidden="true" />
					{/if}
					{submitLabel}
				</Button>
			</DialogFooter>
		{:else if phase === 'importing'}
			<p class="flex items-center gap-2 text-sm text-foreground" role="status">
				<Loader2 class="h-4 w-4 animate-spin" aria-hidden="true" />
				{m['integrations.import.progress']({ done: linkedCount, total: queued.length })}
			</p>
		{:else}
			<div class="space-y-2" role="status">
				{#if phase === 'done'}
					<p class="flex items-center gap-2 text-sm text-foreground">
						<Check class="h-4 w-4 shrink-0 text-success" aria-hidden="true" />
						{queued.length === 1
							? m['integrations.import.doneOne']()
							: m['integrations.import.done']({ count: queued.length })}
					</p>
				{:else}
					<p class="flex items-center gap-2 text-sm text-foreground">
						<AlertTriangle
							class="h-4 w-4 shrink-0 text-highlight-foreground dark:text-highlight"
							aria-hidden="true"
						/>
						{m['integrations.import.timeout']()}
					</p>
				{/if}
				{#if skipped.length > 0}
					<p class="text-sm text-muted-foreground">
						{m['integrations.import.skipped']({ count: skipped.length })}
					</p>
				{/if}
			</div>
			<DialogFooter>
				<Button variant="outline" onclick={close}>{m['integrations.import.close']()}</Button>
				<!-- eslint-disable svelte/no-navigation-without-resolve -- href is a ResolvedPathname produced by resolve() above -->
				<a
					href={eventsHref}
					class="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
				>
					{m['integrations.import.goToEvents']()}
				</a>
				<!-- eslint-enable svelte/no-navigation-without-resolve -->
			</DialogFooter>
		{/if}
	</DialogContent>
</Dialog>
