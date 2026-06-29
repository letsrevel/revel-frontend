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

	// DateTimePicker stores '' for empty; this component's public API uses null.
	// Controlled-input pattern: closesAt is the single source of truth — read it
	// into the picker, map the picker's '' back to null on change.
</script>

<Card>
	<CardHeader>
		<CardTitle>{m['pollNewPage.scheduleTitle']()}</CardTitle>
		<CardDescription>{m['pollNewPage.scheduleDescription']()}</CardDescription>
	</CardHeader>
	<CardContent class="space-y-2">
		<DateTimePicker
			value={closesAt ?? ''}
			label={m['pollNewPage.closesAtLabel']()}
			error={error ?? undefined}
			onValueChange={(v) => (closesAt = v === '' ? null : v)}
		/>
	</CardContent>
</Card>
