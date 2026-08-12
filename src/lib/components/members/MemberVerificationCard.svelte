<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type { MemberVerificationSchema } from '$lib/api/generated/types.gen';
	import MemberStatusBadge from './MemberStatusBadge.svelte';
	import { getUserDisplayName } from '$lib/utils/user-display';
	import { getImageUrl } from '$lib/utils/url';
	import { formatDate } from '$lib/utils/date';
	import { cn } from '$lib/utils';

	/**
	 * The organizer-side answer to "who is this and are they a member?", shared by
	 * BOTH verification surfaces — the org door page and the event scanner's
	 * member report — so the same card never reads two different ways depending on
	 * where it was scanned.
	 *
	 * The photo is the point: the backend deliberately reports every status
	 * (paused, cancelled, banned) instead of 404ing, and the name + face are the
	 * anti-impersonation check against a screenshotted QR. Nothing here is a
	 * decision — the card reports, and staff decide.
	 */
	interface Props {
		member: MemberVerificationSchema;
		class?: string;
	}

	const { member, class: className = '' }: Props = $props();

	const name = $derived(getUserDisplayName(member.user, m['memberVerify.unknownMember']()));
	const pronouns = $derived(member.user.pronouns?.trim() || '');
	const photoUrl = $derived(
		getImageUrl(member.user.profile_picture_thumbnail_url || member.user.profile_picture_url)
	);

	const initials = $derived(
		name
			.split(/\s+/)
			.slice(0, 2)
			.map((word) => word.charAt(0).toUpperCase())
			.join('')
	);

	/**
	 * Non-active statuses get a `role="alert"` line of their own. The badge states
	 * the fact; this states the consequence, which is the part a person working a
	 * door at 1am actually needs. Deliberately not colour-only (WCAG 1.4.1).
	 */
	const warning = $derived.by(() => {
		switch (member.status) {
			case 'paused':
				return m['memberVerify.warningPaused']();
			case 'cancelled':
				return m['memberVerify.warningCancelled']();
			case 'banned':
				return m['memberVerify.warningBanned']();
			default:
				return null;
		}
	});
</script>

<div class={cn('flex flex-col gap-3', className)}>
	<div class="flex items-start gap-4">
		{#if photoUrl}
			<!-- Named alt, not `alt=""`: a screen-reader user working the door needs
			     to know a photo is present to compare, and the name is what names it. -->
			<img
				src={photoUrl}
				alt={name}
				class="h-20 w-20 shrink-0 rounded-2xl object-cover"
				draggable="false"
			/>
		{:else}
			<div
				aria-hidden="true"
				class="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-secondary text-2xl font-black text-secondary-foreground"
			>
				{initials}
			</div>
		{/if}

		<div class="min-w-0 flex-1 space-y-1">
			<p class="text-xl font-extrabold leading-tight">{name}</p>
			{#if pronouns}
				<p class="text-sm text-muted-foreground">{pronouns}</p>
			{/if}
			<MemberStatusBadge status={member.status} />
		</div>
	</div>

	{#if warning}
		<p
			role="alert"
			class="rounded-lg border border-highlight/40 bg-highlight/20 p-3 text-sm text-highlight-foreground dark:text-highlight"
		>
			{warning}
		</p>
	{/if}

	<dl class="space-y-1.5 text-sm">
		{#if member.tier}
			<div class="flex justify-between gap-3">
				<dt class="text-muted-foreground">{m['memberVerify.tierLabel']()}</dt>
				<dd class="text-right font-medium">{member.tier.name}</dd>
			</div>
		{/if}
		<div class="flex justify-between gap-3">
			<dt class="text-muted-foreground">{m['memberVerify.memberSinceLabel']()}</dt>
			<dd class="text-right font-medium">{formatDate(member.member_since)}</dd>
		</div>
	</dl>
</div>
