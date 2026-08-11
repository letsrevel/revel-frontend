<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type { MyMembershipSchema } from '$lib/api/generated/types.gen';
	import {
		Dialog,
		DialogContent,
		DialogHeader,
		DialogTitle,
		DialogDescription
	} from '$lib/components/ui/dialog';
	import MemberStatusBadge from '$lib/components/members/MemberStatusBadge.svelte';
	import MembershipCardDownloads from './MembershipCardDownloads.svelte';
	import { authStore } from '$lib/stores/auth.svelte';
	import { getUserDisplayName } from '$lib/utils/user-display';
	import { getImageUrl } from '$lib/utils/url';
	import { formatDate } from '$lib/utils/date';
	import QRCode from 'qrcode';

	interface Props {
		open: boolean;
		membership: MyMembershipSchema;
		onClose: () => void;
	}

	const { open, membership, onClose }: Props = $props();

	let qrCodeDataUrl = $state<string | null>(null);

	/**
	 * The scan contract, rendered VERBATIM. `member:<uuid>` payloads are never
	 * constructed client-side — the backend owns the namespace, and a card whose
	 * QR the frontend assembled would silently break the day that changes.
	 *
	 * Screenshotting this is fine by design: the QR is an identity pointer, not an
	 * entitlement. Every scan resolves the member's live status server-side, which
	 * is also why the card is shown for every status rather than hidden for some —
	 * a door needs to read "banned", not a missing card.
	 */
	const qrPayload = $derived(membership.qr_payload);

	// Regenerated whenever the payload changes: one modal instance is reused
	// across cards, so an $effect (not onMount) is what keeps the QR truthful.
	$effect(() => {
		const payload = qrPayload;
		if (!open || !payload) return;
		let cancelled = false;
		QRCode.toDataURL(payload, {
			width: 256,
			margin: 2,
			color: { dark: '#000000', light: '#FFFFFF' }
		})
			.then((url) => {
				if (!cancelled) qrCodeDataUrl = url;
			})
			.catch((err) => {
				console.error('Failed to generate membership QR code:', err);
			});
		return () => {
			cancelled = true;
		};
	});

	const logoUrl = $derived(getImageUrl(membership.organization_logo_url));

	/** Initials fallback so a logo-less organization still gets a card face. */
	const initials = $derived(
		membership.organization_name
			.split(/\s+/)
			.slice(0, 2)
			.map((word) => word.charAt(0).toUpperCase())
			.join('')
	);

	const user = $derived(authStore.user);
	const memberName = $derived(user ? getUserDisplayName(user, '') : '');
	const pronouns = $derived(user?.pronouns?.trim() || '');

	/**
	 * Non-active statuses get an explicit line. A member who walks to a door
	 * believing a paused card will open it has been failed by this screen — the
	 * badge alone is too quiet to carry that.
	 */
	const statusNotice = $derived.by(() => {
		switch (membership.status) {
			case 'paused':
				return m['membershipCard.statusNoticePaused']();
			case 'cancelled':
				return m['membershipCard.statusNoticeCancelled']();
			case 'banned':
				return m['membershipCard.statusNoticeBanned']();
			default:
				return null;
		}
	});
</script>

<Dialog {open} onOpenChange={(isOpen) => !isOpen && onClose()}>
	<DialogContent class="max-h-[90vh] overflow-y-auto sm:max-w-[420px]">
		<DialogHeader>
			<DialogTitle>{membership.organization_name}</DialogTitle>
			<DialogDescription>{m['membershipCard.dialogDescription']()}</DialogDescription>
		</DialogHeader>

		<div class="flex flex-col items-center gap-4">
			{#if logoUrl}
				<img src={logoUrl} alt="" class="h-16 w-16 rounded-2xl object-cover" draggable="false" />
			{:else}
				<!-- aria-hidden: the organization is already named by the dialog title. -->
				<div
					aria-hidden="true"
					class="flex h-16 w-16 items-center justify-center rounded-2xl bg-secondary text-xl font-black text-secondary-foreground"
				>
					{initials}
				</div>
			{/if}

			<MemberStatusBadge status={membership.status} />

			{#if statusNotice}
				<p class="rounded-lg border bg-muted p-3 text-center text-sm text-muted-foreground">
					{statusNotice}
				</p>
			{/if}

			{#if qrCodeDataUrl}
				<!-- bg-white, not a token: a QR needs its quiet zone to stay white in
				     dark mode or scanners lose the finder patterns. -->
				<div class="rounded-lg border bg-white p-3">
					<img src={qrCodeDataUrl} alt={m['membershipCard.qrAlt']()} class="h-56 w-56" />
				</div>
				<p class="text-center text-xs text-muted-foreground">
					{m['membershipCard.qrHint']()}
				</p>
			{/if}

			<dl class="w-full space-y-1.5 text-sm">
				{#if memberName}
					<div class="flex justify-between gap-3">
						<dt class="text-muted-foreground">{m['membershipCard.memberLabel']()}</dt>
						<dd class="text-right font-medium">
							{memberName}{#if pronouns}<span class="font-normal text-muted-foreground">
									&nbsp;({pronouns})</span
								>{/if}
						</dd>
					</div>
				{/if}
				{#if membership.tier}
					<div class="flex justify-between gap-3">
						<dt class="text-muted-foreground">{m['membershipCard.tierLabel']()}</dt>
						<dd class="text-right font-medium">{membership.tier.name}</dd>
					</div>
				{/if}
				<div class="flex justify-between gap-3">
					<dt class="text-muted-foreground">{m['membershipCard.memberSinceLabel']()}</dt>
					<dd class="text-right font-medium">{formatDate(membership.member_since)}</dd>
				</div>
			</dl>

			<div class="w-full">
				<MembershipCardDownloads
					slug={membership.organization_slug}
					organizationName={membership.organization_name}
					applePassAvailable={membership.apple_pass_available}
					googlePassAvailable={membership.google_pass_available}
				/>
			</div>
		</div>
	</DialogContent>
</Dialog>
