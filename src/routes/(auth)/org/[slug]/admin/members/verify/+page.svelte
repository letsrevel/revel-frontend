<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type { PageData } from './$types';
	import { organizationadminmembersVerifyMember } from '$lib/api';
	import type { MemberVerificationSchema } from '$lib/api/generated/types.gen';
	import { authStore } from '$lib/stores/auth.svelte';
	import { normalizeMemberCode } from '$lib/utils/member-qr';
	import { extractApiErrorDetail } from '$lib/utils/api-error-detail';
	import QrCameraScanner from '$lib/components/tickets/QrCameraScanner.svelte';
	import MemberVerificationCard from '$lib/components/members/MemberVerificationCard.svelte';
	import PageHeader from '$lib/components/common/PageHeader.svelte';
	import { Card, CardContent } from '$lib/components/ui/card';
	import { ScanLine } from '@lucide/svelte';

	const { data }: { data: PageData } = $props();

	let result = $state<MemberVerificationSchema | null>(null);
	let errorMessage = $state<string | null>(null);

	/**
	 * Door mode: one scan replaces the previous result and the camera keeps
	 * running. Deliberately NOT a history list — the only thing that matters at a
	 * door is the person currently standing there, and a scrolling log of previous
	 * members on a phone held up at head height is a privacy leak, not a feature.
	 */
	async function verify(code: string): Promise<void> {
		errorMessage = null;
		// Never send a literal "Bearer null" during the auth bootstrap window —
		// the same guard the ticket-admin controllers carry. Unlikely here (the
		// page is behind the auth guard and a scan needs a human), but a 401 would
		// read at a door as "this card is invalid".
		const accessToken = authStore.accessToken;
		if (!accessToken) {
			errorMessage = m['memberVerify.error']();
			return;
		}
		const response = await organizationadminmembersVerifyMember({
			path: { slug: data.organization.slug, code: normalizeMemberCode(code) },
			headers: { Authorization: `Bearer ${accessToken}` }
		});

		if (response.error || !response.data) {
			result = null;
			// A 404 here means "no such membership card for this organization",
			// which is a real answer at a door — not a system failure. Every other
			// status falls back to the generic line.
			errorMessage =
				response.response?.status === 404
					? m['memberVerify.notFound']()
					: (extractApiErrorDetail(response.error) ?? m['memberVerify.error']());
			return;
		}

		result = response.data;
	}
</script>

<svelte:head>
	<title>{m['memberVerify.pageTitle']()}</title>
</svelte:head>

<div class="container mx-auto max-w-2xl space-y-6 px-4 py-6">
	<PageHeader
		volume="studio"
		kicker={data.organization.name}
		title={m['memberVerify.pageTitle']()}
		subtitle={m['memberVerify.pageSubtitle']()}
	/>

	<Card>
		<CardContent class="p-4">
			<QrCameraScanner
				active={true}
				continuous={true}
				onScan={verify}
				manualLabel={m['memberVerify.manualEntryLabel']()}
				manualPlaceholder={m['memberVerify.manualEntryPlaceholder']()}
				manualSubmitLabel={m['memberVerify.manualEntrySubmit']()}
			/>
		</CardContent>
	</Card>

	<!--
		`aria-live="polite"` on the results region, not on each outcome: the scan is
		hands-busy work, so the result has to be announced without the organizer
		having to go looking for it — but politely, since the camera may fire again
		while the previous announcement is still being read.
	-->
	<section aria-live="polite" aria-label={m['memberVerify.resultRegionLabel']()}>
		{#if errorMessage}
			<Card>
				<CardContent class="p-4">
					<p class="text-sm font-medium text-destructive">{errorMessage}</p>
				</CardContent>
			</Card>
		{:else if result}
			<Card>
				<CardContent class="p-4">
					<MemberVerificationCard member={result} />
				</CardContent>
			</Card>
		{:else}
			<Card>
				<CardContent class="flex flex-col items-center gap-2 p-6 text-center">
					<ScanLine class="h-8 w-8 text-muted-foreground" aria-hidden="true" />
					<p class="text-sm text-muted-foreground">{m['memberVerify.idlePrompt']()}</p>
				</CardContent>
			</Card>
		{/if}
	</section>
</div>
