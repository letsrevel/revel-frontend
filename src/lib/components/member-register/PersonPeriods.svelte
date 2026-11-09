<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { createQuery } from '@tanstack/svelte-query';
	import { Loader2 } from '@lucide/svelte';
	import type { MembershipRecordSchema } from '$lib/api/generated/types.gen';
	import SectionHeader from '$lib/components/common/SectionHeader.svelte';
	import { formatDate } from '$lib/utils/date';
	import { listPersonPeriods, memberRegisterKeys } from '$lib/member-register/api';
	import { kindLabel } from '$lib/member-register/badges';
	import RegisterBadges from './RegisterBadges.svelte';

	interface Props {
		record: MembershipRecordSchema;
		slug: string;
		accessToken: string | null | undefined;
	}

	const { record, slug, accessToken }: Props = $props();

	const userId = $derived(record.user_id ?? null);

	// A linked person: every entry of theirs plus the ones merged into them
	// (`user_id` + `include_merged`). An unlinked entry has nothing merged into it
	// (only an account-less entry is ever absorbed), so it is its own only period
	// and no request is made.
	const periodsQuery = createQuery(() => ({
		queryKey: memberRegisterKeys.periods(slug, userId ?? ''),
		queryFn: () => listPersonPeriods(slug, accessToken, userId as string),
		enabled: !!accessToken && !!userId
	}));

	const periods = $derived.by(() => {
		const rows = userId ? (periodsQuery.data?.results ?? []) : [record];
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

	{#if userId && periodsQuery.isPending}
		<p class="flex items-center gap-2 text-sm text-muted-foreground" role="status">
			<Loader2 class="h-4 w-4 animate-spin" aria-hidden="true" />
			{m['memberPeople.sheet.periodsLoading']()}
		</p>
	{:else if userId && periodsQuery.isError}
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
				</li>
			{/each}
		</ul>
	{/if}
</section>
