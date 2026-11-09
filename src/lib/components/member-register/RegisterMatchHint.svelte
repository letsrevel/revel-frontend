<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { createQuery } from '@tanstack/svelte-query';
	import { Link2 } from '@lucide/svelte';
	import type { MembershipRecordSchema } from '$lib/api/generated/types.gen';
	import { Button } from '$lib/components/ui/button';
	import { listRegisterMatches, memberRegisterKeys } from '$lib/member-register/api';
	import { formatDate } from '$lib/utils/date';
	import RegisterReasonChips from './RegisterReasonChips.svelte';

	interface Props {
		slug: string;
		requestId: string;
		accessToken: string | null;
		/** Only fetch while the request is opened (and still pending). */
		enabled: boolean;
		disabled?: boolean;
		/** Receives the whole entry: its tier is the default for the approval. */
		onApproveAndLink: (record: MembershipRecordSchema) => void;
	}

	const {
		slug,
		requestId,
		accessToken,
		enabled,
		disabled = false,
		onApproveAndLink
	}: Props = $props();

	const matchesQuery = createQuery(() => ({
		queryKey: memberRegisterKeys.matches(slug, requestId),
		queryFn: () => listRegisterMatches(slug, accessToken, requestId),
		enabled: enabled && !!accessToken
	}));

	// A failed lookup must never block the plain Approve, so errors stay silent.
	const matches = $derived(matchesQuery.data ?? []);
</script>

{#if matches.length > 0}
	<section class="space-y-2" aria-labelledby="register-matches-{requestId}">
		<h4 id="register-matches-{requestId}" class="text-sm font-bold">
			{m['memberRegister.matchesHeading']()}
		</h4>
		<ul class="space-y-2">
			{#each matches as match (match.record.id)}
				<li
					class="space-y-2 rounded-lg border border-border bg-muted/50 p-3"
					data-testid="register-match"
				>
					<p class="text-sm">{m['memberRegister.matchHint']({ name: match.record.full_name })}</p>
					<p class="text-xs text-muted-foreground">
						{[match.record.email, match.record.tier_name, formatDate(match.record.valid_from)]
							.filter(Boolean)
							.join(' · ')}
					</p>
					<RegisterReasonChips reasons={match.reasons} label={m['memberRegister.reasonsLabel']()} />
					<Button
						variant="outline"
						size="sm"
						{disabled}
						data-testid="approve-and-link"
						aria-label={m['memberRegister.approveAndLinkAria']({ name: match.record.full_name })}
						onclick={() => match.record.id && onApproveAndLink(match.record)}
					>
						<Link2 aria-hidden="true" />
						{m['memberRegister.approveAndLink']()}
					</Button>
				</li>
			{/each}
		</ul>
	</section>
{/if}
