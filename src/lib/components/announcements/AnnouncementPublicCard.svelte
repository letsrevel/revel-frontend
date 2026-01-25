<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type { AnnouncementPublicSchema } from '$lib/api/generated/types.gen';
	import { formatRelativeTime } from '$lib/utils/time';
	import { Megaphone } from 'lucide-svelte';

	interface Props {
		announcement: AnnouncementPublicSchema;
		showSource?: boolean;
	}

	let { announcement, showSource = false }: Props = $props();

	/**
	 * Simple markdown to HTML converter (same as MarkdownEditor)
	 */
	function convertMarkdownToHtml(markdown: string): string {
		if (!markdown) return '';

		let html = markdown;

		// Escape HTML to prevent XSS
		html = html
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;')
			.replace(/'/g, '&#039;');

		// Headers
		html = html.replace(/^### (.*$)/gim, '<h3 class="text-lg font-semibold mt-4 mb-2">$1</h3>');
		html = html.replace(/^## (.*$)/gim, '<h2 class="text-xl font-bold mt-6 mb-3">$1</h2>');
		html = html.replace(/^# (.*$)/gim, '<h1 class="text-2xl font-bold mt-8 mb-4">$1</h1>');

		// Bold and Italic
		html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
		html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
		html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

		// Links
		html = html.replace(
			/\[([^\]]+)\]\(([^)]+)\)/g,
			'<a href="$2" class="text-primary underline" target="_blank" rel="noopener noreferrer">$1</a>'
		);

		// Unordered lists
		html = html.replace(/^\* (.+)$/gim, '<li class="ml-4">$1</li>');
		html = html.replace(/(<li class="ml-4">.*<\/li>)/s, '<ul class="list-disc my-2">$1</ul>');

		// Ordered lists
		html = html.replace(/^\d+\. (.+)$/gim, '<li class="ml-4">$1</li>');

		// Line breaks
		html = html.replace(/\n\n/g, '</p><p class="mb-2">');
		html = html.replace(/\n/g, '<br>');

		// Wrap in paragraph
		html = `<p class="mb-2">${html}</p>`;

		return html;
	}

	let htmlBody = $derived(convertMarkdownToHtml(announcement.body));
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
		</div>
	</div>

	<!-- Body -->
	<div class="prose prose-sm max-w-none dark:prose-invert">
		{@html htmlBody}
	</div>
</article>
