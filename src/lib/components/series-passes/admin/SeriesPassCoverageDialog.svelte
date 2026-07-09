<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type { EventInListSchema, SeriesPassAdminSchema } from '$lib/api/generated/types.gen';
	import {
		seriespassadminAddSeriesPassTierLinks,
		seriespassadminRemoveSeriesPassTierLink
	} from '$lib/api';
	import { invalidateAdminPasses } from '$lib/queries/series-passes';
	import { createMutation, useQueryClient } from '@tanstack/svelte-query';
	import {
		Dialog,
		DialogContent,
		DialogHeader,
		DialogTitle,
		DialogDescription
	} from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import ConfirmDialog from '$lib/components/common/ConfirmDialog.svelte';
	import PassTierMappingSection from './PassTierMappingSection.svelte';
	import { formatEventDate } from '$lib/utils/date';
	import { extractErrorMessage } from '$lib/utils/errors';
	import { CalendarCheck, Trash2 } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';

	interface Props {
		seriesId: string;
		pass: SeriesPassAdminSchema;
		accessToken: string | null;
		/** Upcoming, non-template occurrences — extension candidates. */
		upcomingEvents: EventInListSchema[];
		onClose: () => void;
	}

	const { seriesId, pass, accessToken, upcomingEvents, onClose }: Props = $props();

	const queryClient = useQueryClient();
	const passId = $derived(pass.id ?? '');

	// The pass row from the admin list is a snapshot; after an extend/remove the
	// list is invalidated, but this dialog instance keeps the stale prop. Track
	// local overlays so the covered list reflects mutations immediately.
	let addedLinks = $state<SeriesPassAdminSchema['tier_links']>([]);
	let removedEventIds = $state<Set<string>>(new Set());

	const coveredLinks = $derived(
		[...pass.tier_links, ...addedLinks].filter((link) => !removedEventIds.has(link.event_id))
	);
	const coveredEventIds = $derived(new Set(coveredLinks.map((link) => link.event_id)));
	const uncoveredEvents = $derived(upcomingEvents.filter((e) => !coveredEventIds.has(e.id)));

	// Extension tier picks: eventId -> tierId | null (explicitly excluded).
	let tierSelections = $state<Record<string, string | null | undefined>>({});

	const extendMutation = createMutation(() => ({
		mutationFn: async (links: { event_id: string; tier_id: string }[]) => {
			const response = await seriespassadminAddSeriesPassTierLinks({
				path: { series_id: seriesId, pass_id: passId },
				body: links,
				headers: { Authorization: `Bearer ${accessToken}` }
			});
			if (response.error) {
				throw new Error(extractErrorMessage(response.error, m['seriesPassAdmin.extendFailed']()));
			}
			return { response: response.data, links };
		},
		onSuccess: async ({ links }) => {
			// Reflect immediately; existing holders get their new tickets
			// materialized server-side, free of charge.
			const byEvent = new Map(upcomingEvents.map((e) => [e.id, e]));
			addedLinks = [
				...addedLinks,
				...links.map((l) => ({
					event_id: l.event_id,
					event_name: byEvent.get(l.event_id)?.name ?? '',
					event_start: byEvent.get(l.event_id)?.start ?? '',
					tier_id: l.tier_id,
					tier_name: ''
				}))
			];
			tierSelections = {};
			await invalidateAdminPasses(queryClient, seriesId);
			toast.success(m['seriesPassAdmin.extendSuccess']({ count: links.length }));
		},
		onError: (error) => {
			toast.error(error instanceof Error ? error.message : m['seriesPassAdmin.extendFailed']());
		}
	}));

	let linkToRemove = $state<{ event_id: string; event_name: string } | null>(null);

	const removeMutation = createMutation(() => ({
		mutationFn: async (eventId: string) => {
			const response = await seriespassadminRemoveSeriesPassTierLink({
				path: { series_id: seriesId, pass_id: passId, event_id: eventId },
				headers: { Authorization: `Bearer ${accessToken}` }
			});
			if (response.error) {
				throw new Error(
					extractErrorMessage(response.error, m['seriesPassAdmin.removeLinkFailed']())
				);
			}
			return eventId;
		},
		onSuccess: async (eventId) => {
			removedEventIds = new Set([...removedEventIds, eventId]);
			await invalidateAdminPasses(queryClient, seriesId);
			toast.success(m['seriesPassAdmin.removeLinkSuccess']());
			linkToRemove = null;
		},
		onError: (error) => {
			toast.error(error instanceof Error ? error.message : m['seriesPassAdmin.removeLinkFailed']());
			linkToRemove = null;
		}
	}));

	function handleExtend() {
		const links = Object.entries(tierSelections)
			.filter((entry): entry is [string, string] => typeof entry[1] === 'string')
			.map(([event_id, tier_id]) => ({ event_id, tier_id }));
		if (links.length > 0) {
			extendMutation.mutate(links);
		}
	}

	const selectedCount = $derived(
		Object.values(tierSelections).filter((v) => typeof v === 'string').length
	);
</script>

<Dialog open onOpenChange={onClose}>
	<DialogContent class="max-h-[90vh] overflow-y-auto sm:max-w-[640px]">
		<DialogHeader>
			<DialogTitle>{m['seriesPassAdmin.coverageTitle']({ name: pass.name })}</DialogTitle>
			<DialogDescription>{m['seriesPassAdmin.coverageDescription']()}</DialogDescription>
		</DialogHeader>

		<!-- Covered events -->
		<section aria-labelledby="covered-events-heading" class="space-y-2">
			<h3 id="covered-events-heading" class="text-sm font-medium">
				{m['seriesPassAdmin.coveredEventsHeading']({ count: coveredLinks.length })}
			</h3>
			{#if coveredLinks.length === 0}
				<p class="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
					{m['seriesPassAdmin.noCoveredEvents']()}
				</p>
			{:else}
				<ul class="space-y-2">
					{#each coveredLinks as link (link.event_id)}
						<li class="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3">
							<div class="min-w-0">
								<div class="truncate text-sm font-medium">{link.event_name}</div>
								<div class="text-xs text-muted-foreground">
									{#if link.event_start}{formatEventDate(link.event_start)}{/if}
									{#if link.tier_name}
										· {m['seriesPassAdmin.tierPrefix']({ tier: link.tier_name })}{/if}
								</div>
							</div>
							<Button
								size="sm"
								variant="outline"
								class="text-destructive hover:bg-destructive hover:text-destructive-foreground"
								onclick={() =>
									(linkToRemove = { event_id: link.event_id, event_name: link.event_name })}
								disabled={removeMutation.isPending}
							>
								<Trash2 class="mr-1 h-3.5 w-3.5" aria-hidden="true" />
								{m['seriesPassAdmin.removeLinkButton']()}
							</Button>
						</li>
					{/each}
				</ul>
			{/if}
		</section>

		<!-- Extend coverage -->
		{#if uncoveredEvents.length > 0}
			<section aria-labelledby="extend-coverage-heading" class="space-y-2 border-t pt-4">
				<h3 id="extend-coverage-heading" class="text-sm font-medium">
					{m['seriesPassAdmin.extendHeading']()}
				</h3>
				<p class="text-xs text-muted-foreground">{m['seriesPassAdmin.extendHint']()}</p>
				<PassTierMappingSection
					events={uncoveredEvents}
					{accessToken}
					currency={pass.currency ?? 'EUR'}
					selections={tierSelections}
					onSelectionsChange={(next) => (tierSelections = next)}
					disabled={extendMutation.isPending}
				/>
				<div class="flex justify-end">
					<Button onclick={handleExtend} disabled={selectedCount === 0 || extendMutation.isPending}>
						<CalendarCheck class="mr-1.5 h-4 w-4" aria-hidden="true" />
						{extendMutation.isPending
							? m['seriesPass.processing']()
							: m['seriesPassAdmin.extendButton']({ count: selectedCount })}
					</Button>
				</div>
			</section>
		{/if}
	</DialogContent>
</Dialog>

<ConfirmDialog
	isOpen={!!linkToRemove}
	title={m['seriesPassAdmin.removeLinkTitle']()}
	message={m['seriesPassAdmin.removeLinkMessage']({ eventName: linkToRemove?.event_name ?? '' })}
	confirmText={m['seriesPassAdmin.removeLinkButton']()}
	cancelText={m['seriesPass.cancelButton']()}
	variant="danger"
	onConfirm={() => linkToRemove && removeMutation.mutate(linkToRemove.event_id)}
	onCancel={() => (linkToRemove = null)}
/>
