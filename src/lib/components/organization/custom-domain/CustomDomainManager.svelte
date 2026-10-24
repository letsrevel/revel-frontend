<script lang="ts">
	import { createMutation, createQuery, useQueryClient } from '@tanstack/svelte-query';
	import { AlertCircle, ExternalLink, Info, Loader2, RefreshCw, Trash2 } from '@lucide/svelte';
	import * as m from '$lib/paraglide/messages.js';
	import { Button } from '$lib/components/ui/button';
	import { Alert, AlertDescription } from '$lib/components/ui/alert';
	import {
		Dialog,
		DialogContent,
		DialogDescription,
		DialogFooter,
		DialogHeader,
		DialogTitle
	} from '$lib/components/ui/dialog';
	import SectionHeader from '$lib/components/common/SectionHeader.svelte';
	import StatusBadge from '$lib/components/common/StatusBadge.svelte';
	import CopyField from '$lib/components/common/CopyField.svelte';
	import { formatDateTime } from '$lib/utils/date';
	import HostnameForm from './HostnameForm.svelte';
	import DnsRecordsList from './DnsRecordsList.svelte';
	import DnsOnlyNote from './DnsOnlyNote.svelte';
	import {
		CustomDomainApiError,
		PENDING_POLL_MS,
		deleteCustomDomain,
		domainStatusTone,
		getCustomDomain,
		refreshCustomDomain,
		type CustomDomain
	} from './custom-domain-api';
	import { customDomainQueryKey } from './query-key';

	interface Props {
		slug: string;
	}
	const { slug }: Props = $props();

	const queryClient = useQueryClient();

	const domainQuery = createQuery(() => ({
		queryKey: customDomainQueryKey(slug),
		queryFn: () => getCustomDomain(slug),
		// Poll only while the domain is pending and the tab is visible. The
		// server re-syncs every 15 minutes anyway; this just keeps an open page honest.
		refetchInterval: (query) =>
			query.state.data?.status === 'pending' &&
			(typeof document === 'undefined' || !document.hidden)
				? PENDING_POLL_MS
				: false
	}));

	const domain = $derived(domainQuery.data ?? null);
	// Without a DNS provider integration (self-hosted, local dev) a pending domain carries
	// no records and no target: a platform administrator activates it instead.
	const hasDnsDetails = $derived(
		!!domain && (domain.verification_records.length > 0 || !!domain.cname_target)
	);

	// DNS host detected from the NS records (pending domains only). Only an
	// https help page is linked; anything else renders nothing.
	const dnsProvider = $derived(
		domain?.dns_provider && /^https:\/\//i.test(domain.dns_provider.help_url)
			? domain.dns_provider
			: null
	);
	// A link straight to this domain's DNS records at the host (only some hosts
	// have one); same https-only rule.
	const dnsDashboardUrl = $derived(
		dnsProvider?.dashboard_url && /^https:\/\//i.test(dnsProvider.dashboard_url)
			? dnsProvider.dashboard_url
			: null
	);

	// The CNAME already shows as a record card; the standalone section is only a fallback.
	const hasCnameRecord = $derived(
		!!domain && domain.verification_records.some((r) => r.type.toUpperCase() === 'CNAME')
	);

	let showChangeForm = $state(false);
	let removeOpen = $state(false);
	let actionError = $state<string | null>(null);

	function messageFor(error: unknown): string {
		if (error instanceof CustomDomainApiError && error.detail) return error.detail;
		return m['customDomain.actionError']();
	}

	const refreshMutation = createMutation(() => ({
		mutationFn: () => refreshCustomDomain(slug),
		onSuccess: (fresh: CustomDomain) => {
			actionError = null;
			queryClient.setQueryData(customDomainQueryKey(slug), fresh);
		},
		// Local onError replaces the global toast; the message renders inline.
		onError: (error: unknown) => {
			actionError = messageFor(error);
		}
	}));

	const removeMutation = createMutation(() => ({
		mutationFn: () => deleteCustomDomain(slug),
		onSuccess: () => {
			actionError = null;
			removeOpen = false;
			showChangeForm = false;
			queryClient.setQueryData(customDomainQueryKey(slug), null);
			void queryClient.invalidateQueries({ queryKey: customDomainQueryKey(slug) });
		},
		onError: (error: unknown) => {
			removeOpen = false;
			actionError = messageFor(error);
		}
	}));

	const refreshing = $derived(refreshMutation.isPending);
	const removing = $derived(removeMutation.isPending);

	function statusLabel(status: CustomDomain['status']): string {
		switch (status) {
			case 'active':
				return m['customDomain.status.active']();
			case 'failed':
				return m['customDomain.status.failed']();
			default:
				return m['customDomain.status.pending']();
		}
	}
</script>

<div class="space-y-6">
	{#if domainQuery.isPending}
		<p class="flex items-center gap-2 text-sm text-muted-foreground" role="status">
			<Loader2 class="h-4 w-4 animate-spin" aria-hidden="true" />
			{m['customDomain.loading']()}
		</p>
	{:else if domainQuery.isError}
		<Alert variant="destructive">
			<AlertCircle class="h-4 w-4" aria-hidden="true" />
			<AlertDescription class="space-y-3">
				<p>{m['customDomain.loadError']()}</p>
				<Button variant="outline" size="sm" onclick={() => domainQuery.refetch()}>
					{m['customDomain.retry']()}
				</Button>
			</AlertDescription>
		</Alert>
	{:else if !domain}
		<!-- State 1: none -->
		<section class="space-y-4 rounded-lg border bg-card p-4 sm:p-6" data-testid="state-none">
			<SectionHeader
				title={m['customDomain.none.heading']()}
				subtitle={m['customDomain.none.intro']()}
			/>
			<ul class="list-disc space-y-1.5 pl-5 text-sm">
				<li>{m['customDomain.none.benefitLinks']()}</li>
				<li>{m['customDomain.none.benefitDns']()}</li>
				<li>{m['customDomain.none.benefitPowered']()}</li>
			</ul>
			<HostnameForm {slug} />
		</section>
	{:else}
		<section
			class="space-y-4 rounded-lg border bg-card p-4 sm:p-6"
			data-testid="state-{domain.status}"
		>
			<div class="flex flex-wrap items-center justify-between gap-3">
				<div class="min-w-0">
					<p class="text-sm font-semibold text-muted-foreground">
						{m['customDomain.domain.label']()}
					</p>
					<p class="break-all font-mono text-lg font-bold" data-testid="domain-hostname">
						{domain.hostname}
					</p>
				</div>
				<StatusBadge
					tone={domainStatusTone(domain.status)}
					label={statusLabel(domain.status)}
					size="md"
				/>
			</div>

			{#if domain.status === 'active'}
				<!-- State 3: active -->
				<p class="text-sm">{m['customDomain.active.intro']()}</p>
				<p>
					<a
						href={`https://${domain.hostname}`}
						target="_blank"
						rel="noopener noreferrer"
						class="inline-flex items-center gap-1.5 break-all text-sm font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
					>
						{`https://${domain.hostname}`}
						<ExternalLink class="h-4 w-4 shrink-0" aria-hidden="true" />
						<span class="sr-only">{m['customDomain.opensInNewTab']()}</span>
					</a>
				</p>
				{#if domain.verified_at}
					<p class="text-sm text-muted-foreground">
						{m['customDomain.active.verifiedAt']({ date: formatDateTime(domain.verified_at) })}
					</p>
				{/if}
				<div class="rounded-md bg-muted p-4 text-sm">
					<p class="mb-2 font-semibold">{m['customDomain.active.changedHeading']()}</p>
					<ul class="list-disc space-y-1 pl-5">
						<li>{m['customDomain.active.changedLinks']()}</li>
						<li>{m['customDomain.active.changedRedirect']()}</li>
					</ul>
				</div>
			{:else if domain.status === 'failed'}
				<!-- State 4: failed -->
				<p class="text-sm">{m['customDomain.failed.intro']()}</p>
			{:else}
				<!-- State 2: pending -->
				<div class="space-y-4">
					{#if !hasDnsDetails}
						<p class="rounded-md bg-muted p-4 text-sm" data-testid="pending-platform-team">
							{m['customDomain.pending.platformTeam']()}
						</p>
					{:else}
						<p class="text-sm">{m['customDomain.pending.intro']()}</p>
						<ol class="list-decimal space-y-1.5 pl-5 text-sm">
							<li>
								{domain.dns_provider
									? m['customDomain.pending.step1Provider']({ provider: domain.dns_provider.name })
									: m['customDomain.pending.step1']()}
							</li>
							<li>{m['customDomain.pending.step2']()}</li>
							<li>{m['customDomain.pending.step3']()}</li>
						</ol>
						{#if dnsProvider}
							<div class="space-y-1.5 text-sm" data-testid="dns-provider">
								<p>{m['customDomain.dnsProvider.hostedAt']({ name: dnsProvider.name })}</p>
								<!-- External https links from the backend's provider table, checked above. -->
								<!-- eslint-disable svelte/no-navigation-without-resolve -->
								<p class="flex flex-wrap gap-x-4 gap-y-1">
									{#if dnsDashboardUrl}
										<a
											href={dnsDashboardUrl}
											target="_blank"
											rel="noopener noreferrer"
											class="inline-flex items-center gap-1 font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
										>
											{m['customDomain.dnsProvider.dashboardLink']({ name: dnsProvider.name })}
											<ExternalLink class="h-4 w-4 shrink-0" aria-hidden="true" />
											<span class="sr-only">{m['customDomain.opensInNewTab']()}</span>
										</a>
									{/if}
									<a
										href={dnsProvider.help_url}
										target="_blank"
										rel="noopener noreferrer"
										class={dnsDashboardUrl
											? 'inline-flex items-center gap-1 text-muted-foreground underline underline-offset-4 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
											: 'inline-flex items-center gap-1 font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'}
									>
										{dnsDashboardUrl
											? m['customDomain.dnsProvider.helpLinkShort']()
											: m['customDomain.dnsProvider.helpLink']({ name: dnsProvider.name })}
										<ExternalLink class="h-4 w-4 shrink-0" aria-hidden="true" />
										<span class="sr-only">{m['customDomain.opensInNewTab']()}</span>
									</a>
								</p>
								<!-- eslint-enable svelte/no-navigation-without-resolve -->
							</div>
						{/if}

						{#if domain.verification_records.length > 0}
							<div class="space-y-3">
								<h3 class="font-bold">{m['customDomain.records.heading']()}</h3>
								<DnsRecordsList
									records={domain.verification_records}
									provider={domain.dns_provider ?? null}
								/>
							</div>
						{/if}

						{#if domain.cname_target && !hasCnameRecord}
							<div class="space-y-2">
								<h3 class="font-bold">{m['customDomain.cname.heading']()}</h3>
								<p class="text-sm text-muted-foreground">
									{m['customDomain.cname.body']({ hostname: domain.hostname })}
								</p>
								<CopyField
									id="custom-domain-cname-target"
									value={domain.cname_target}
									label={m['customDomain.cname.label']()}
								/>
								<DnsOnlyNote provider={domain.dns_provider ?? null} />
							</div>
						{/if}

						<p class="text-sm text-muted-foreground">{m['customDomain.pending.timing']()}</p>
					{/if}
				</div>
			{/if}

			{#if domain.status !== 'active' && domain.errors && domain.errors.length > 0}
				<div
					class="rounded-md border border-info/40 bg-info/10 p-4 text-sm"
					data-testid="sync-errors"
				>
					<p class="mb-2 flex items-center gap-2 font-semibold">
						<Info class="h-4 w-4 shrink-0 text-info" aria-hidden="true" />
						{m['customDomain.errors.heading']()}
					</p>
					<ul class="list-disc space-y-1 pl-5">
						{#each domain.errors as message, i (i)}
							<li>{message}</li>
						{/each}
					</ul>
				</div>
			{/if}

			{#if actionError}
				<Alert variant="destructive">
					<AlertCircle class="h-4 w-4" aria-hidden="true" />
					<AlertDescription>{actionError}</AlertDescription>
				</Alert>
			{/if}

			<div class="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
				{#if domain.status !== 'active'}
					<Button
						type="button"
						variant="outline"
						class="gap-2"
						disabled={refreshing}
						onclick={() => refreshMutation.mutate()}
					>
						{#if refreshing}
							<Loader2 class="h-4 w-4 animate-spin" aria-hidden="true" />
						{:else}
							<RefreshCw class="h-4 w-4" aria-hidden="true" />
						{/if}
						{refreshing ? m['customDomain.checking']() : m['customDomain.checkNow']()}
					</Button>
				{/if}
				{#if domain.status === 'failed'}
					<Button
						type="button"
						variant="outline"
						aria-expanded={showChangeForm}
						aria-controls="custom-domain-change-form"
						onclick={() => (showChangeForm = !showChangeForm)}
					>
						{m['customDomain.failed.differentHostname']()}
					</Button>
				{/if}
				<Button
					type="button"
					variant="outline"
					class="gap-2 text-destructive"
					onclick={() => (removeOpen = true)}
				>
					<Trash2 class="h-4 w-4" aria-hidden="true" />
					{m['customDomain.remove.button']()}
				</Button>
			</div>

			{#if domain.status === 'failed' && showChangeForm}
				<div id="custom-domain-change-form" class="border-t pt-4">
					<HostnameForm
						{slug}
						submitLabel={m['customDomain.failed.submit']()}
						onRequested={() => (showChangeForm = false)}
					/>
				</div>
			{/if}
		</section>
	{/if}
</div>

<Dialog bind:open={removeOpen}>
	<DialogContent>
		<DialogHeader>
			<DialogTitle>{m['customDomain.remove.title']()}</DialogTitle>
			<DialogDescription>
				{m['customDomain.remove.body']({ hostname: domain?.hostname ?? '' })}
			</DialogDescription>
		</DialogHeader>
		<DialogFooter class="gap-2 sm:gap-0">
			<Button
				type="button"
				variant="outline"
				disabled={removing}
				onclick={() => (removeOpen = false)}
			>
				{m['customDomain.remove.cancel']()}
			</Button>
			<Button
				type="button"
				variant="destructive"
				class="gap-2"
				disabled={removing}
				onclick={() => removeMutation.mutate()}
			>
				{#if removing}
					<Loader2 class="h-4 w-4 animate-spin" aria-hidden="true" />
				{/if}
				{removing ? m['customDomain.remove.removing']() : m['customDomain.remove.confirm']()}
			</Button>
		</DialogFooter>
	</DialogContent>
</Dialog>
