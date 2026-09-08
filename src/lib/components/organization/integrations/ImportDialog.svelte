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
	import type { ImportJobSchema, RemoteEventSummarySchema } from '$lib/api/generated/types.gen';
	import {
		organizationintegrationsImportEvents,
		organizationintegrationsImportJobs,
		organizationintegrationsRemoteEvents
	} from '$lib/api/generated/sdk.gen';
	import { PollUntil } from '$lib/queries/poll-until';
	import { formatDate } from '$lib/utils/date';
	import {
		integrationErrorFromResponse,
		integrationErrorMessage,
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
	/** The jobs the 202 queued, as returned; the poll refreshes their status. */
	let initialJobs = $state<ImportJobSchema[]>([]);
	let jobIds = $state<string[]>([]);
	/** Remote event names by remote id — the jobs only carry ids. */
	let names = $state<Record<string, string>>({});
	let skipped = $state<string[]>([]);
	let submitError = $state<IntegrationErrorInfo | null>(null);
	let timedOut = $state(false);
	let invalidatedRound = $state(false);

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
		enabled: open && stage === 'pick',
		// A failure here is terminal for this dialog (access revoked, provider
		// gone); retrying only repeats the 409 and delays the message.
		retry: false
	}));
	// A rejection thrown before the queryFn's own conversion (a network failure
	// inside the SDK call) still needs a rendered error, not a blank panel.
	const loadError = $derived(
		remote.error
			? isIntegrationErrorInfo(remote.error)
				? remote.error
				: integrationErrorFromResponse(remote.error, platform)
			: null
	);

	async function fetchImportJobs(): Promise<ImportJobSchema[]> {
		const res = await organizationintegrationsImportJobs({
			path: { slug: organizationSlug, provider },
			query: { ids: jobIds }
		});
		if (res.error || !res.data) throw integrationErrorFromResponse(res.error, platform);
		return res.data;
	}

	function isSettled(job: ImportJobSchema | undefined): boolean {
		return job?.status === 'done' || job?.status === 'failed';
	}

	// The 202 returns job rows; the poll watches them settle in Revel's own
	// database (no platform call per tick). Bounded: 3 s for two minutes.
	const poll = new PollUntil<ImportJobSchema[]>({
		// Frozen at mount on purpose: the dialog is mounted once per provider card.
		queryKey: untrack(() => ['org-integration-import-jobs', organizationSlug, provider]),
		queryFn: fetchImportJobs,
		isDone: (jobs) => jobIds.every((id) => isSettled(jobs.find((j) => j.id === id))),
		// The endpoint 422s on an empty ids list; with no jobs there is nothing to poll.
		enabled: () => stage === 'importing' && jobIds.length > 0,
		onTimeout: () => {
			timedOut = true;
		}
	});
	const pollQuery = createQuery(() => poll.options());
	/** Each queued job at its freshest known state, in submission order. */
	const jobRows = $derived.by((): ImportJobSchema[] => {
		const latest = pollQuery.data ?? [];
		return jobIds.flatMap((id) => {
			const job = latest.find((j) => j.id === id) ?? initialJobs.find((j) => j.id === id);
			return job ? [job] : [];
		});
	});
	const settledCount = $derived(jobRows.filter((j) => j.status !== 'queued').length);
	const doneCount = $derived(jobRows.filter((j) => j.status === 'done').length);
	const failedCount = $derived(jobRows.filter((j) => j.status === 'failed').length);
	const phase = $derived.by((): Phase => {
		if (stage === 'pick') return 'pick';
		// Everything selected was already linked: nothing was queued, done at once.
		if (jobIds.length === 0) return 'done';
		void timedOut; // re-run when the deadline lapses, not just when data changes
		const p = poll.phase(pollQuery.data);
		return p === 'done' ? 'done' : p === 'timed_out' ? 'timed_out' : 'importing';
	});

	// The poll settling means the drafts exist (or failed): refresh the picker's
	// `already_linked` flags and any cached event lists, so the new drafts show
	// up without a manual reload even when the user navigates without closing.
	$effect(() => {
		if (phase === 'done' && stage === 'importing' && jobIds.length > 0 && !invalidatedRound) {
			invalidatedRound = true;
			void queryClient.invalidateQueries({ queryKey: listKey });
			void queryClient.invalidateQueries({ queryKey: ['events'] });
		}
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
			initialJobs = data.jobs;
			jobIds = data.jobs.map((j) => j.id);
			skipped = data.skipped;
			const byId: Record<string, string> = {};
			for (const ev of remote.data ?? []) byId[ev.remote_id] = ev.name;
			names = byId;
			timedOut = false;
			invalidatedRound = false;
			poll.reset();
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
		// offer the same events again. (A settled poll already invalidated; this
		// covers closing mid-import or after a timeout.)
		if (stage !== 'pick') {
			void queryClient.invalidateQueries({ queryKey: listKey });
			// Drafts that landed before a timeout or early close still deserve
			// fresh event lists, even though the poll never settled.
			if (doneCount > 0) void queryClient.invalidateQueries({ queryKey: ['events'] });
		}
		stage = 'pick';
		selected = [];
		initialJobs = [];
		jobIds = [];
		names = {};
		skipped = [];
		submitError = null;
		onOpenChange(false);
	}

	function jobName(job: ImportJobSchema): string {
		return names[job.remote_id] ?? job.remote_id;
	}

	function failureMessage(job: ImportJobSchema): string {
		return (
			integrationErrorMessage(job.error_code, platform) ??
			(job.error_message || m['integrations.error.generic']({ platform }))
		);
	}

	function draftHref(eventId: string): string {
		return resolve('/(auth)/org/[slug]/admin/events/[event_id]/edit', {
			slug: organizationSlug,
			event_id: eventId
		});
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
				{m['integrations.import.progress']({ done: settledCount, total: jobIds.length })}
			</p>
		{:else}
			<div class="space-y-2" role="status">
				{#if phase === 'done'}
					{#if doneCount > 0}
						<p class="flex items-center gap-2 text-sm text-foreground">
							<Check class="h-4 w-4 shrink-0 text-success" aria-hidden="true" />
							{doneCount === 1
								? m['integrations.import.doneOne']()
								: m['integrations.import.done']({ count: doneCount })}
						</p>
					{/if}
				{:else}
					<p class="flex items-center gap-2 text-sm text-foreground">
						<AlertTriangle
							class="h-4 w-4 shrink-0 text-highlight-foreground dark:text-highlight"
							aria-hidden="true"
						/>
						{m['integrations.import.timeout']()}
					</p>
				{/if}
				{#if failedCount > 0}
					<p class="flex items-center gap-2 text-sm text-foreground">
						<AlertCircle class="h-4 w-4 shrink-0 text-destructive" aria-hidden="true" />
						{failedCount === 1
							? m['integrations.import.failedOne']()
							: m['integrations.import.failed']({ count: failedCount })}
					</p>
				{/if}
				{#if skipped.length > 0}
					<p class="text-sm text-muted-foreground">
						{m['integrations.import.skipped']({ count: skipped.length })}
					</p>
				{/if}
			</div>
			{#if jobRows.length > 0}
				<ul class="space-y-2">
					{#each jobRows as row (row.id)}
						<li class="flex items-start gap-2 text-sm">
							{#if row.status === 'done'}
								<Check class="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden="true" />
								<div class="min-w-0">
									<p class="text-foreground">
										<span class="font-medium">{jobName(row)}</span>
										<span class="text-muted-foreground"
											>· {m['integrations.import.job.done']()}</span
										>
									</p>
									{#if row.event_id}
										<!-- eslint-disable svelte/no-navigation-without-resolve -- href is a ResolvedPathname produced by resolve() in draftHref -->
										<a
											href={draftHref(row.event_id)}
											class="text-primary underline underline-offset-2"
											aria-label={m['integrations.import.job.openDraftFor']({ name: jobName(row) })}
										>
											{m['integrations.import.job.openDraft']()}
										</a>
										<!-- eslint-enable svelte/no-navigation-without-resolve -->
									{/if}
								</div>
							{:else if row.status === 'failed'}
								<AlertCircle class="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden="true" />
								<div class="min-w-0">
									<p class="text-foreground">
										<span class="font-medium">{jobName(row)}</span>
										<span class="text-muted-foreground">· {failureMessage(row)}</span>
									</p>
									{#if row.provider_message}
										<details class="mt-1 text-xs text-muted-foreground">
											<summary class="cursor-pointer"
												>{m['integrations.card.detailsFromPlatform']({ platform })}</summary
											>
											<p class="mt-1 break-words">{row.provider_message}</p>
										</details>
									{/if}
								</div>
							{:else}
								<Loader2 class="mt-0.5 h-4 w-4 shrink-0 animate-spin" aria-hidden="true" />
								<p class="text-foreground">
									<span class="font-medium">{jobName(row)}</span>
									<span class="text-muted-foreground"
										>· {m['integrations.import.job.pending']()}</span
									>
								</p>
							{/if}
						</li>
					{/each}
				</ul>
			{/if}
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
