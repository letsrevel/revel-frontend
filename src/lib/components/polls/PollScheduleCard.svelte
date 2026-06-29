<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import {
		Card,
		CardContent,
		CardDescription,
		CardHeader,
		CardTitle
	} from '$lib/components/ui/card';
	import DateTimePicker from '$lib/components/forms/DateTimePicker.svelte';

	interface Props {
		closesAt: string | null;
		error?: string | null;
	}

	let { closesAt = $bindable(), error = null }: Props = $props();

	// Bridge: DateTimePicker stores '' for empty; this component's public API uses null.
	// We keep a local string state and sync bidirectionally with the parent's nullable value.
	let pickerValue = $state(closesAt ?? '');

	// Picker → parent: propagate user's selection up as ISO or null.
	$effect(() => {
		const next = pickerValue === '' ? null : pickerValue;
		if (closesAt !== next) closesAt = next;
	});

	// Parent → picker: propagate external resets (e.g. post-save re-sync) down.
	$effect(() => {
		const expected = closesAt ?? '';
		if (pickerValue !== expected) pickerValue = expected;
	});
</script>

<Card>
	<CardHeader>
		<CardTitle>{m['pollNewPage.scheduleTitle']()}</CardTitle>
		<CardDescription>{m['pollNewPage.scheduleDescription']()}</CardDescription>
	</CardHeader>
	<CardContent class="space-y-2">
		<DateTimePicker
			bind:value={pickerValue}
			label={m['pollNewPage.closesAtLabel']()}
			error={error ?? undefined}
		/>
	</CardContent>
</Card>
