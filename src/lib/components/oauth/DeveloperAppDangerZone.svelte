<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type { OAuthAppSchema } from '$lib/api/generated/types.gen';
	import { Button } from '$lib/components/ui/button';
	import SectionHeader from '$lib/components/common/SectionHeader.svelte';

	interface Props {
		app: OAuthAppSchema;
		/** One of the three actions is in flight. */
		busy?: boolean;
		onRotate: () => void;
		onToggleActive: () => void;
		onDelete: () => void;
	}
	const { app, busy = false, onRotate, onToggleActive, onDelete }: Props = $props();

	const headingId = $props.id();
</script>

<!-- Buttons only: the page owns every confirmation dialog and request. -->
<section
	aria-labelledby={headingId}
	class="space-y-4 rounded-2xl border border-destructive p-4 sm:p-5"
>
	<SectionHeader id={headingId} title={m['oauth.developer.danger.title']()} />
	<div class="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
		<!-- A public client has no secret to rotate. -->
		{#if app.client_type === 'confidential'}
			<Button type="button" variant="outline" disabled={busy} onclick={onRotate}>
				{m['oauth.developer.danger.rotate']()}
			</Button>
		{/if}
		<Button type="button" variant="outline" disabled={busy} onclick={onToggleActive}>
			{app.is_active
				? m['oauth.developer.danger.deactivate']()
				: m['oauth.developer.danger.activate']()}
		</Button>
		<Button type="button" variant="destructive" disabled={busy} onclick={onDelete}>
			{m['oauth.developer.danger.delete']()}
		</Button>
	</div>
</section>
