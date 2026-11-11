<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { createQuery } from '@tanstack/svelte-query';
	import { Loader2 } from '@lucide/svelte';
	import type { MembershipRecordSchema } from '$lib/api/generated/types.gen';
	import { Button } from '$lib/components/ui/button';
	import SectionHeader from '$lib/components/common/SectionHeader.svelte';
	import { formatDate } from '$lib/utils/date';
	import { listMergedInto, listPersonPeriods, memberRegisterKeys } from '$lib/member-register/api';
	import { kindLabel } from '$lib/member-register/badges';
	import RegisterBadges from './RegisterBadges.svelte';

	interface Props {
		record: MembershipRecordSchema;
		slug: string;
		accessToken: string | null | undefined;
		/** Open one merged period read-only (it lives on another person). */
		onOpenRecord?: (record: MembershipRecordSchema) => void;
	}

	const { record, slug, accessToken, onOpenRecord }: Props = $props();

	const userId = $derived(record.user_id ?? null);
	const isMerged = $derived(!!record.merged_into_id);

	// A linked person: every entry of theirs plus the ones merged into them
	// (`user_id` + `include_merged`). An account-less survivor has no user id to
	// ask by: it is shown with the entries merged INTO it (`merged_into`). A
	// merged entry itself has nothing merged into it, so no request is made.
	const userQuery = createQuery(() => ({
		queryKey: memberRegisterKeys.periods(slug, userId ?? ''),
		queryFn: () => listPersonPeriods(slug, accessToken, userId as string),
		enabled: !!accessToken && !!userId && !isMerged
	}));
	const mergedQuery = createQuery(() => ({
		queryKey: memberRegisterKeys.mergedInto(slug, record.id ?? ''),
		queryFn: () => listMergedInto(slug, accessToken, record.id as string),
		enabled: !!accessToken && !userId && !isMerged && !!record.id
	}));
	const periodsQuery = $derived(userId ? userQuery : mergedQuery);
	const remote = $derived(!isMerged && (!!userId || !!record.id));

	const periods = $derived.by(() => {
		const rows = userId
			? (userQuery.data?.results ?? [])
			: isMerged
				? [record]
				: [record, ...(mergedQuery.data?.results ?? []).filter((r) => r.id !== record.id)];
		return [...rows].sort((a, b) => Date.parse(b.valid_from) - Date.parse(a.valid_from));
	});

	function range(period: MembershipRecordSchema): string {
		return period.valid_until
			? m['memberPeople.sheet.periodRange']({
					from: formatDate(period.valid_from),
					to: formatDate(period.valid_until)
				})
			: m['memberPeople.sheet.periodFrom']({ from: formatDate(period.valid_from) });
	}
</script>

<section aria-labelledby="person-periods-heading" class="space-y-3" data-testid="person-periods">
	<SectionHeader
		id="person-periods-heading"
		level={3}
		title={m['memberPeople.sheet.periodsHeading']()}
	/>

	{#if remote && periodsQuery.isPending}
		<p class="flex items-center gap-2 text-sm text-muted-foreground" role="status">
			<Loader2 class="h-4 w-4 animate-spin" aria-hidden="true" />
			{m['memberPeople.sheet.periodsLoading']()}
		</p>
	{:else if remote && periodsQuery.isError}
		<p class="text-sm text-destructive" role="alert">{m['memberPeople.sheet.periodsError']()}</p>
	{:else}
		<ul class="space-y-3">
			{#each periods as period (period.id ?? period.valid_from)}
				<li
					class="space-y-1.5 rounded-lg border border-border bg-card p-3"
					data-testid="person-period"
				>
					<p class="text-sm font-semibold">
						{period.tier_name || '-'}
						<span class="font-normal text-muted-foreground">· {kindLabel(period.kind)}</span>
					</p>
					<p class="text-sm">{range(period)}</p>
					<RegisterBadges record={period} />
					{#if period.merged_into_id && period.id !== record.id && onOpenRecord}
						<Button
							variant="outline"
							size="sm"
							data-testid="person-period-open"
							onclick={() => onOpenRecord(period)}
						>
							{m['memberPeople.sheet.openMerged']()}
						</Button>
					{/if}
				</li>
			{/each}
		</ul>
	{/if}
</section>
