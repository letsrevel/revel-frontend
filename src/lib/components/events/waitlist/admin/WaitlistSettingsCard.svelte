<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { Loader2, Settings } from 'lucide-svelte';
	import { Button } from '$lib/components/ui/button';
	import WaitlistSettingsModal from '$lib/components/events/waitlist/WaitlistSettingsModal.svelte';
	import type { WaitlistSettingsSchema } from '$lib/api/generated/types.gen';

	interface Props {
		eventId: string;
		settings: WaitlistSettingsSchema | null;
		isLoading: boolean;
		formatDateTime: (iso: string) => string;
		humanizeIsoDuration: (iso: string | null | undefined) => string;
	}

	const { eventId, settings, isLoading, formatDateTime, humanizeIsoDuration }: Props = $props();

	let modalOpen = $state(false);

	const advancedDisabled = $derived(settings ? settings.waitlist_time_window === null : true);
</script>

<section class="rounded-lg border bg-card p-4 sm:p-6">
	<div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
		<div class="flex items-start gap-3">
			<Settings class="mt-0.5 h-5 w-5 text-muted-foreground" aria-hidden="true" />
			<div>
				<h2 class="text-lg font-semibold">{m['orgAdmin.waitlist.settings.title']()}</h2>
				{#if isLoading}
					<p class="mt-1 text-sm text-muted-foreground">
						<Loader2 class="inline h-3.5 w-3.5 animate-spin" aria-hidden="true" />
					</p>
				{:else if settings && advancedDisabled}
					<p class="mt-1 text-sm text-muted-foreground">
						{m['orgAdmin.waitlist.settings.disabled']()}
					</p>
				{/if}
			</div>
		</div>
		<Button
			variant="outline"
			size="sm"
			onclick={() => (modalOpen = true)}
			disabled={!settings}
			class="self-start sm:self-auto"
		>
			{m['orgAdmin.waitlist.settings.editButton']()}
		</Button>
	</div>

	{#if settings && !advancedDisabled}
		<dl class="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
			<div>
				<dt class="text-xs uppercase tracking-wide text-muted-foreground">
					{m['waitlistSettings.timeWindow.label']()}
				</dt>
				<dd class="mt-0.5 text-sm font-medium">
					{humanizeIsoDuration(settings.waitlist_time_window)}
				</dd>
			</div>
			<div>
				<dt class="text-xs uppercase tracking-wide text-muted-foreground">
					{m['waitlistSettings.batchSize.label']()}
				</dt>
				<dd class="mt-0.5 text-sm font-medium">
					{settings.waitlist_batch_size === 0 ? '∞' : settings.waitlist_batch_size}
				</dd>
			</div>
			<div>
				<dt class="text-xs uppercase tracking-wide text-muted-foreground">
					{m['waitlistSettings.cutoffDate.label']()}
				</dt>
				<dd class="mt-0.5 text-sm font-medium">
					{settings.waitlist_cutoff_date ? formatDateTime(settings.waitlist_cutoff_date) : '—'}
				</dd>
			</div>
			<div>
				<dt class="text-xs uppercase tracking-wide text-muted-foreground">
					{m['waitlistSettings.lotteryMode.label']()}
				</dt>
				<dd class="mt-0.5 text-sm font-medium">
					{settings.waitlist_lottery_mode ? m['common.yes']() : m['common.no']()}
				</dd>
			</div>
		</dl>
	{/if}
</section>

{#if settings}
	<WaitlistSettingsModal
		open={modalOpen}
		onOpenChange={(v) => (modalOpen = v)}
		mode="edit"
		{eventId}
		initialValues={settings}
	/>
{/if}
