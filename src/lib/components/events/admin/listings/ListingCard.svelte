<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { createMutation } from '@tanstack/svelte-query';
	import { browser } from '$app/environment';
	import { resolve } from '$app/paths';
	import { Button } from '$lib/components/ui/button';
	import { Card } from '$lib/components/ui/card';
	import {
		AlertCircle,
		AlertTriangle,
		Check,
		ExternalLink,
		FileText,
		Loader2,
		Megaphone,
		RefreshCw,
		Upload
	} from '@lucide/svelte';
	import ConfirmDialog from '$lib/components/common/ConfirmDialog.svelte';
	import SectionHeader from '$lib/components/common/SectionHeader.svelte';
	import StatusBadge from '$lib/components/common/StatusBadge.svelte';
	import type { Tone } from '$lib/components/common/tones';
	import type { EventDetailSchema, EventListingSchema } from '$lib/api/generated/types.gen';
	import {
		eventintegrationsPublish,
		eventintegrationsPush,
		eventintegrationsUpdate
	} from '$lib/api/generated/sdk.gen';
	import { formatDateTime } from '$lib/utils/date';
	import {
		integrationErrorFromResponse,
		integrationErrorMessage,
		isIntegrationErrorInfo,
		silentIntegrationError,
		type IntegrationErrorInfo
	} from '$lib/utils/integration-errors';
	import SyncReport from './SyncReport.svelte';
	import {
		autoSyncChoice,
		autoSyncPayload,
		listingView,
		pushBlockers,
		type AutoSyncChoice
	} from './listing-view';

	interface Props {
		organizationSlug: string;
		eventId: string;
		listing: EventListingSchema;
		/** The saved event: the eligibility pre-check mirrors what the backend will evaluate. */
		event: Pick<EventDetailSchema, 'event_type' | 'end' | 'requires_ticket'>;
		isOwner: boolean;
		/** The list has been pending for over ten minutes; say so instead of spinning silently. */
		pendingSlow: boolean;
		/** The tab re-fetches the listings after any change. */
		onChanged: () => void;
	}
	const { organizationSlug, eventId, listing, event, isOwner, pendingSlow, onChanged }: Props =
		$props();

	const platform = $derived(listing.display_name);
	const link = $derived(listing.link ?? null);
	const view = $derived(listingView(listing));
	const blockers = $derived(view.kind === 'unlisted' ? pushBlockers(event) : []);
	const headingId = $derived(`listing-${listing.provider}`);
	const integrationsHref = $derived(
		resolve('/(auth)/org/[slug]/admin/integrations', { slug: organizationSlug })
	);

	let actionError = $state<IntegrationErrorInfo | null>(null);
	let showPublish = $state(false);
	// Optimistic mirror of the select (writable derived); the server value wins
	// on the next re-fetch, and a failed PATCH snaps it back.
	let autoSync = $derived<AutoSyncChoice>(link ? autoSyncChoice(link) : 'inherit');

	function toInfo(err: unknown): IntegrationErrorInfo {
		return isIntegrationErrorInfo(err) ? err : integrationErrorFromResponse(err, platform);
	}

	// 202: the link is `pending` from here on; the tab polls until it settles.
	const push = createMutation(() => ({
		mutationFn: async () => {
			const res = await eventintegrationsPush({
				path: { event_id: eventId, provider: listing.provider }
			});
			if (res.error || !res.data) throw silentIntegrationError(res.error, platform);
			return res.data;
		},
		onSuccess: () => onChanged(),
		onError: (err: unknown) => {
			actionError = toInfo(err);
		}
	}));

	// Synchronous on the backend: the platform's own refusal comes back here.
	const publish = createMutation(() => ({
		mutationFn: async () => {
			const res = await eventintegrationsPublish({
				path: { event_id: eventId, provider: listing.provider }
			});
			if (res.error || !res.data) throw silentIntegrationError(res.error, platform);
			return res.data;
		},
		onSuccess: () => {
			showPublish = false;
			onChanged();
		},
		onError: (err: unknown) => {
			showPublish = false;
			actionError = toInfo(err);
		}
	}));

	const update = createMutation(() => ({
		mutationFn: async (choice: AutoSyncChoice) => {
			const res = await eventintegrationsUpdate({
				path: { event_id: eventId, provider: listing.provider },
				body: { auto_sync: autoSyncPayload(choice) }
			});
			if (res.error || !res.data) throw silentIntegrationError(res.error, platform);
			return res.data;
		},
		onSuccess: () => onChanged(),
		onError: (err: unknown) => {
			actionError = toInfo(err);
			autoSync = link ? autoSyncChoice(link) : 'inherit';
		}
	}));

	function startPush() {
		actionError = null;
		push.mutate();
	}

	function onAutoSyncChange(event: Event) {
		const value = (event.currentTarget as HTMLSelectElement).value;
		if (value !== 'inherit' && value !== 'on' && value !== 'off') return;
		autoSync = value;
		actionError = null;
		update.mutate(value);
	}

	const CARD_TONE_CLASSES: Record<Tone, string> = {
		brand: 'border-primary/40 bg-primary/10',
		info: 'border-info/40 bg-info/10',
		success: 'border-success/40 bg-success/10',
		warning: 'border-highlight/40 bg-highlight/20',
		danger: 'border-destructive/40 bg-destructive/10',
		neutral: 'border-border bg-muted'
	};
	const ICON_CHIP_CLASSES: Record<Tone, string> = {
		brand: 'bg-primary text-primary-foreground',
		info: 'bg-info text-info-foreground',
		success: 'bg-success text-success-foreground',
		warning: 'bg-highlight text-highlight-foreground',
		danger: 'bg-destructive text-destructive-foreground',
		neutral: 'bg-muted text-muted-foreground'
	};

	const badge = $derived.by((): { tone: Tone; label: string } | null => {
		switch (view.kind) {
			case 'draft':
				return { tone: 'info', label: m['listings.status.draft']({ platform }) };
			case 'live':
				return { tone: 'success', label: m['listings.status.live']({ platform }) };
			case 'cancelled':
				return { tone: 'neutral', label: m['listings.status.cancelled']({ platform }) };
			case 'failed':
				return { tone: 'danger', label: m['listings.status.failed']() };
			case 'broken':
				return { tone: 'warning', label: m['listings.status.broken']({ platform }) };
			default:
				return null;
		}
	});

	const title = $derived.by((): string => {
		switch (view.kind) {
			case 'not-connected':
				return isOwner
					? m['listings.notConnected.owner']({ platform })
					: m['listings.notConnected.staff']({ platform });
			case 'access-lost':
				return isOwner
					? m['listings.accessLost.owner']({ platform })
					: m['listings.accessLost.staff']({ platform });
			case 'unlisted':
				return m['listings.unlisted.title']({ platform });
			case 'pending':
				return m['listings.sending']({ platform });
			case 'broken':
				return m['listings.status.broken']({ platform });
			case 'failed':
				return m['listings.status.failed']();
			default:
				return badge?.label ?? platform;
		}
	});

	const body = $derived.by((): string => {
		switch (view.kind) {
			case 'unlisted':
				return blockers.length > 0
					? m['listings.unlisted.blocked']({ platform })
					: m['listings.unlisted.help']();
			case 'pending':
				return pendingSlow ? m['listings.sendingSlow']() : '';
			case 'broken':
				return integrationErrorMessage('remote_event_missing', platform) ?? '';
			default:
				return '';
		}
	});

	const timeline = $derived.by((): string[] => {
		if (!link) return [];
		const lines: string[] = [];
		if (link.last_pushed_at) {
			lines.push(m['listings.lastUpdated']({ date: formatDateTime(link.last_pushed_at) }));
		}
		if (link.origin === 'imported' && link.last_pulled_at) {
			lines.push(m['listings.importedOn']({ platform, date: formatDateTime(link.last_pulled_at) }));
		}
		return lines;
	});

	const pushLabel = $derived.by((): string => {
		switch (view.kind) {
			case 'unlisted':
				return m['listings.action.createDraft']({ platform });
			case 'failed':
				return m['listings.action.tryAgain']();
			case 'broken':
				return m['listings.action.createAgain']();
			default:
				return m['listings.action.update']();
		}
	});

	const autoSyncLabel = $derived.by((): Record<AutoSyncChoice, string> => ({
		inherit: m['listings.autoSync.inherit'](),
		on: m['listings.autoSync.on'](),
		off: m['listings.autoSync.off']()
	}));
	// Without an override, `effective_auto_sync` IS the organization default,
	// so the inherit option can say "currently on/off". With one set, the link
	// cannot reveal the default (effective equals the override), so it stays
	// plain until the override is cleared and the tab re-fetches.
	const inheritLabel = $derived.by((): string => {
		if (!link || link.auto_sync !== null) return autoSyncLabel.inherit;
		return link.effective_auto_sync
			? m['listings.autoSync.inheritOn']()
			: m['listings.autoSync.inheritOff']();
	});
</script>

<section
	class="space-y-4 rounded-lg border border-border bg-card p-6 shadow-sm"
	aria-labelledby={headingId}
>
	<div class="flex flex-wrap items-center gap-2">
		<Megaphone class="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
		<SectionHeader title={platform} id={headingId} class="min-w-0 flex-1" />
		{#if badge}
			<StatusBadge tone={badge.tone} label={badge.label} size="sm" />
		{/if}
	</div>

	<Card class="border-2 p-4 {CARD_TONE_CLASSES[view.tone]}">
		<div class="flex items-start gap-3">
			<div class="shrink-0 rounded-full p-2 {ICON_CHIP_CLASSES[view.tone]}">
				{#if view.kind === 'pending'}
					<Loader2 class="h-5 w-5 animate-spin" aria-hidden="true" />
				{:else if view.kind === 'live'}
					<Check class="h-5 w-5" aria-hidden="true" />
				{:else if view.kind === 'failed' || view.kind === 'access-lost'}
					<AlertCircle class="h-5 w-5" aria-hidden="true" />
				{:else if view.kind === 'broken'}
					<AlertTriangle class="h-5 w-5" aria-hidden="true" />
				{:else}
					<FileText class="h-5 w-5" aria-hidden="true" />
				{/if}
			</div>
			<div class="min-w-0 flex-1 space-y-3">
				<div>
					<h3 class="font-bold text-foreground">{title}</h3>
					{#if body}
						<p class="mt-1 text-sm text-muted-foreground">{body}</p>
					{/if}
					{#if view.kind === 'unlisted' && blockers.length > 0}
						<ul class="mt-2 list-inside list-disc space-y-1 text-sm text-foreground">
							{#each blockers as code (code)}
								<li>{integrationErrorMessage(code, platform)}</li>
							{/each}
						</ul>
					{/if}
					{#if (view.kind === 'not-connected' || view.kind === 'access-lost') && isOwner}
						<!-- eslint-disable svelte/no-navigation-without-resolve -- href is a ResolvedPathname produced by resolve() above -->
						<a
							href={integrationsHref}
							class="mt-2 inline-block text-sm font-medium text-primary underline-offset-4 hover:underline"
						>
							{view.kind === 'not-connected'
								? m['listings.notConnected.ownerAction']()
								: m['listings.accessLost.ownerAction']()}
						</a>
						<!-- eslint-enable svelte/no-navigation-without-resolve -->
					{/if}
					{#each timeline as line (line)}
						<p class="mt-1 text-xs text-muted-foreground">{line}</p>
					{/each}
				</div>

				{#if view.canSetAutoSync && link}
					<div class="max-w-sm space-y-1">
						<label for={`${headingId}-auto-sync`} class="text-sm font-medium text-foreground"
							>{m['listings.autoSync.label']()}</label
						>
						<!-- Native select, as the tier form uses: three fixed choices, no search. -->
						<select
							id={`${headingId}-auto-sync`}
							value={autoSync}
							onchange={onAutoSyncChange}
							disabled={!browser || update.isPending}
							class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm transition-colors focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
						>
							<option value="inherit">{inheritLabel}</option>
							<option value="on">{autoSyncLabel.on}</option>
							<option value="off">{autoSyncLabel.off}</option>
						</select>
					</div>
				{/if}
			</div>
		</div>
	</Card>

	{#if actionError}
		<div
			class="flex items-start gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3"
			role="alert"
		>
			<AlertCircle class="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden="true" />
			<div class="min-w-0 text-sm text-foreground">
				<p>{actionError.message}</p>
				{#if actionError.providerMessage}
					<details class="mt-1 text-xs text-muted-foreground">
						<summary class="cursor-pointer"
							>{m['listings.report.detailsFromPlatform']({ platform })}</summary
						>
						<p class="mt-1 break-words">{actionError.providerMessage}</p>
					</details>
				{/if}
			</div>
		</div>
	{/if}

	{#if link && link.sync_report.length > 0 && view.kind !== 'pending'}
		<SyncReport report={link.sync_report} {platform} idPrefix={headingId} />
	{/if}

	{#if view.canPush || view.canPublish || view.canView}
		<div class="flex flex-wrap items-center gap-3">
			{#if view.canPublish}
				<Button
					onclick={() => (showPublish = true)}
					disabled={!browser || publish.isPending || push.isPending}
					class="inline-flex items-center gap-2"
				>
					<Upload class="h-4 w-4" aria-hidden="true" />
					{m['listings.action.publish']({ platform })}
				</Button>
			{/if}
			{#if view.canPush}
				<Button
					variant={view.canPublish ? 'outline' : 'default'}
					onclick={startPush}
					disabled={!browser || push.isPending || blockers.length > 0}
					class="inline-flex items-center gap-2"
				>
					{#if push.isPending}
						<Loader2 class="h-4 w-4 animate-spin" aria-hidden="true" />
					{:else}
						<RefreshCw class="h-4 w-4" aria-hidden="true" />
					{/if}
					{pushLabel}
				</Button>
			{/if}
			{#if view.canView && link}
				<a
					href={link.remote_url}
					target="_blank"
					rel="noopener noreferrer"
					class="inline-flex items-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
				>
					<ExternalLink class="h-4 w-4" aria-hidden="true" />
					{m['listings.action.view']({ platform })}
				</a>
			{/if}
		</div>
	{/if}
</section>

<ConfirmDialog
	isOpen={showPublish}
	title={m['listings.publish.title']({ platform })}
	message={m['listings.publish.message']({ platform })}
	confirmText={m['listings.publish.confirm']()}
	variant="info"
	onConfirm={() => publish.mutate()}
	onCancel={() => (showPublish = false)}
/>
