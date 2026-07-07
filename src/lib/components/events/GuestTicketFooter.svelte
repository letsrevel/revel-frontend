<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { Button } from '$lib/components/ui/button';
	import { DialogFooter } from '$lib/components/ui/dialog';

	interface Props {
		isSubmitting: boolean;
		onClose: () => void;
	}

	const { isSubmitting, onClose }: Props = $props();
</script>

<div class="shrink-0">
	<DialogFooter class="gap-2 pt-4 sm:gap-0">
		<Button
			type="button"
			variant="outline"
			onclick={onClose}
			disabled={isSubmitting}
			class="flex-1 sm:flex-initial"
		>
			{m['guest_attendance.common_cancel']()}
		</Button>
		<Button type="submit" disabled={isSubmitting} class="flex-1 sm:flex-initial">
			{#if isSubmitting}
				{m['guest_attendance.submitting']()}
			{:else}
				{m['guest_attendance.submit_ticket']()}
			{/if}
		</Button>
	</DialogFooter>

	<!-- Subtle login link -->
	<div class="border-t pt-3 text-center text-xs text-muted-foreground">
		<p>
			<!-- eslint-disable-next-line svelte/no-at-html-tags -- static i18n string, no interpolated data; only a developer-authored <a>→login link is injected -->
			{@html m['guest_attendance.or_login']()
				.replace('<a>', '<a href="/login" class="text-primary hover:underline">')
				.replace('</a>', '</a>')}
		</p>
	</div>
</div>
