<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import {
		Card,
		CardContent,
		CardDescription,
		CardHeader,
		CardTitle
	} from '$lib/components/ui/card';
	import { Label } from '$lib/components/ui/label';
	import { Input } from '$lib/components/ui/input';

	interface Props {
		closesAt: string | null;
		error?: string | null;
	}

	let { closesAt = $bindable(), error = null }: Props = $props();
</script>

<Card>
	<CardHeader>
		<CardTitle>{m['pollNewPage.scheduleTitle']()}</CardTitle>
		<CardDescription>{m['pollNewPage.scheduleDescription']()}</CardDescription>
	</CardHeader>
	<CardContent class="space-y-2">
		<Label for="closes-at">{m['pollNewPage.closesAtLabel']()}</Label>
		<Input
			id="closes-at"
			type="datetime-local"
			value={closesAt ?? ''}
			oninput={(e) => {
				const v = (e.currentTarget as HTMLInputElement).value;
				closesAt = v === '' ? null : v;
			}}
			class={error ? 'border-destructive' : ''}
		/>
		{#if error}
			<p class="text-sm text-destructive">{error}</p>
		{/if}
	</CardContent>
</Card>
