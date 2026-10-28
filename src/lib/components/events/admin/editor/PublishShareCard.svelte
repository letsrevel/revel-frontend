<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { Button } from '$lib/components/ui/button';
	import CopyField from '$lib/components/common/CopyField.svelte';
	import { CheckCircle, Eye, X, MessageCircle, Send, Mail } from '@lucide/svelte';
	import { cn } from '$lib/utils';
	import type { EventStatus } from '$lib/api/generated/types.gen';

	interface Props {
		status: EventStatus;
		eventName: string;
		/** Absolute public URL of the event. */
		eventUrl: string;
		/** Triggers the page's publish flow (keeps its confirm). */
		onPublish: () => void;
		publishing?: boolean;
		/** Relative or absolute link to the public page, for the draft preview. */
		previewHref?: string;
	}

	const {
		status,
		eventName,
		eventUrl,
		onPublish,
		publishing = false,
		previewHref
	}: Props = $props();

	// Session-only dismissal (no storage by design).
	let dismissed = $state(false);

	const whatsappHref = $derived(
		`https://wa.me/?text=${encodeURIComponent(`${eventName} ${eventUrl}`)}`
	);
	const telegramHref = $derived(
		`https://t.me/share/url?url=${encodeURIComponent(eventUrl)}&text=${encodeURIComponent(eventName)}`
	);
	const emailHref = $derived(
		`mailto:?subject=${encodeURIComponent(eventName)}&body=${encodeURIComponent(eventUrl)}`
	);

	const shareClass = cn(
		'inline-flex min-h-[44px] items-center gap-2 rounded-md border border-input bg-background px-4 text-sm font-medium',
		'hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
	);
</script>

{#if status === 'draft'}
	<section
		class="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between"
		aria-labelledby="publish-card-title"
		data-testid="publish-share-card"
	>
		<div class="space-y-1">
			<h2 id="publish-card-title" class="text-lg font-bold">
				{m['eventEditor.publishCard.draftTitle']()}
			</h2>
			<p class="text-sm text-muted-foreground">{m['eventEditor.publishCard.draftBody']()}</p>
		</div>
		<div class="flex flex-wrap items-center gap-2">
			{#if previewHref}
				<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- href comes from resolve()/orgHref() in the caller -->
				<a href={previewHref} target="_blank" rel="noopener noreferrer" class={shareClass}>
					<Eye class="h-4 w-4" aria-hidden="true" />
					{m['eventEditor.publishCard.preview']()}
				</a>
			{/if}
			<Button type="button" class="min-h-[44px]" onclick={onPublish} disabled={publishing}>
				<CheckCircle class="mr-2 h-4 w-4" aria-hidden="true" />
				{m['eventEditor.publishCard.publish']()}
			</Button>
		</div>
	</section>
{:else if status === 'open' && !dismissed}
	<section
		class="space-y-3 rounded-lg border border-border bg-card p-4"
		aria-labelledby="publish-card-title"
		data-testid="publish-share-card"
	>
		<div class="flex items-start justify-between gap-3">
			<div class="space-y-1">
				<h2 id="publish-card-title" class="text-lg font-bold">
					{m['eventEditor.publishCard.liveTitle']()}
				</h2>
				<p class="text-sm text-muted-foreground">{m['eventEditor.publishCard.liveBody']()}</p>
			</div>
			<Button
				type="button"
				variant="ghost"
				size="icon"
				class="h-11 w-11 shrink-0"
				aria-label={m['eventEditor.publishCard.dismiss']()}
				onclick={() => (dismissed = true)}
			>
				<X class="h-4 w-4" aria-hidden="true" />
			</Button>
		</div>
		<CopyField value={eventUrl} label={m['eventEditor.publishCard.linkLabel']()} />
		<!-- eslint-disable svelte/no-navigation-without-resolve -- external share URLs -->
		<div class="flex flex-wrap gap-2">
			<a href={whatsappHref} target="_blank" rel="noopener noreferrer" class={shareClass}>
				<MessageCircle class="h-4 w-4" aria-hidden="true" />
				<span class="sr-only">{m['eventEditor.publishCard.shareSrPrefix']()}</span>
				<span>{m['eventEditor.publishCard.shareWhatsAppLabel']()}</span>
			</a>
			<a href={telegramHref} target="_blank" rel="noopener noreferrer" class={shareClass}>
				<Send class="h-4 w-4" aria-hidden="true" />
				<span class="sr-only">{m['eventEditor.publishCard.shareSrPrefix']()}</span>
				<span>{m['eventEditor.publishCard.shareTelegramLabel']()}</span>
			</a>
			<a href={emailHref} class={shareClass}>
				<Mail class="h-4 w-4" aria-hidden="true" />
				<span class="sr-only">{m['eventEditor.publishCard.shareSrPrefix']()}</span>
				<span>{m['eventEditor.publishCard.shareEmailLabel']()}</span>
			</a>
		</div>
		<!-- eslint-enable svelte/no-navigation-without-resolve -->
	</section>
{/if}
