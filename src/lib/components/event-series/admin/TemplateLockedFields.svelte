<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';

	interface Props {
		startDisplay: string;
		endDisplay: string;
		rsvpBeforeDisplay: string;
		applyBeforeDisplay: string;
	}
	const { startDisplay, endDisplay, rsvpBeforeDisplay, applyBeforeDisplay }: Props = $props();

	const fields = $derived([
		{ label: m['recurringEvents.templateDialog.locked.startLabel'](), value: startDisplay },
		{ label: m['recurringEvents.templateDialog.locked.endLabel'](), value: endDisplay },
		{
			label: m['recurringEvents.templateDialog.locked.rsvpBeforeLabel'](),
			value: rsvpBeforeDisplay
		},
		{
			label: m['recurringEvents.templateDialog.locked.applyBeforeLabel'](),
			value: applyBeforeDisplay
		},
		{ label: m['recurringEvents.templateDialog.locked.statusLabel'](), value: 'DRAFT' }
	]);
</script>

<section
	class="space-y-3 rounded-md border border-dashed border-border bg-muted/30 p-4"
	aria-labelledby="template-edit-locked-heading"
>
	<div>
		<h3 id="template-edit-locked-heading" class="text-sm font-semibold text-muted-foreground">
			{m['recurringEvents.templateDialog.locked.heading']()}
		</h3>
		<p class="mt-1 text-xs text-muted-foreground">
			{m['recurringEvents.templateDialog.locked.subheading']()}
		</p>
	</div>
	<dl class="grid gap-x-4 gap-y-2 text-sm sm:grid-cols-2">
		{#each fields as f (f.label)}
			<div>
				<dt class="text-xs uppercase tracking-wide text-muted-foreground">{f.label}</dt>
				<dd class="font-mono text-sm">{f.value}</dd>
			</div>
		{/each}
	</dl>
	<p class="text-xs text-muted-foreground">
		{m['recurringEvents.templateDialog.locked.startHelper']()}
	</p>
	<p class="text-xs text-muted-foreground">
		{m['recurringEvents.templateDialog.locked.rsvpBeforeHelper']()}
	</p>
	<p class="text-xs text-muted-foreground">
		{m['recurringEvents.templateDialog.locked.statusHelper']()}
	</p>
</section>
