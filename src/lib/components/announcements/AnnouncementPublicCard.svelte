<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type { AnnouncementPublicSchema } from '$lib/api/generated/types.gen';
	import { formatRelativeTime } from '$lib/utils/time';
	import MarkdownContent from '$lib/components/common/MarkdownContent.svelte';
	import { Megaphone, Users, Layers, UserCog, Calendar } from '@lucide/svelte';

	interface Props {
		announcement: AnnouncementPublicSchema;
		showSource?: boolean;
	}

	const { announcement, showSource = false }: Props = $props();

	// Who can see this announcement. There's no truly public announcement — all
	// are restricted — so we always surface the audience descriptor.
	const audienceInfo = $derived.by(() => {
		switch (announcement.audience) {
			case 'members':
				return { icon: Users, text: m['announcements.public.audience.members']() };
			case 'tiers':
				return { icon: Layers, text: m['announcements.public.audience.tiers']() };
			case 'staff':
				return { icon: UserCog, text: m['announcements.public.audience.staff']() };
			case 'event':
			default:
				return { icon: Calendar, text: m['announcements.public.audience.event']() };
		}
	});
</script>

<article class="rounded-lg border bg-card p-4">
	<!-- Header -->
	<div class="mb-3 flex items-start gap-3">
		<div
			class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"
		>
			<Megaphone class="h-5 w-5" aria-hidden="true" />
		</div>
		<div class="min-w-0 flex-1">
			<h3 class="font-semibold">{announcement.title}</h3>
			<div class="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm text-muted-foreground">
				{#if announcement.sent_at}
					<span
						>{m['announcements.card.sentAt']({
							date: formatRelativeTime(announcement.sent_at)
						})}</span
					>
				{/if}
				{#if showSource && (announcement.organization_name || announcement.event_name)}
					<span>·</span>
					<span>
						{m['announcements.public.from']({
							name: announcement.event_name || announcement.organization_name || ''
						})}
					</span>
				{/if}
			</div>
			<p
				class="mt-1 inline-flex items-center gap-1.5 text-xs text-muted-foreground"
				title={m['announcements.public.audienceLabel']()}
			>
				<audienceInfo.icon class="h-3.5 w-3.5" aria-hidden="true" />
				<span>{audienceInfo.text}</span>
			</p>
		</div>
	</div>

	<!-- Body -->
	<MarkdownContent content={announcement.body} ariaLabel="Announcement content" />
</article>
