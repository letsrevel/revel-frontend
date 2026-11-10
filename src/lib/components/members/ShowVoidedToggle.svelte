<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import { Label } from '$lib/components/ui/label';

	interface Props {
		id: string;
		checked: boolean;
		onChange: (checked: boolean) => void;
	}

	const { id, checked, onChange }: Props = $props();
</script>

<div class="flex items-center gap-2">
	<Checkbox {id} {checked} onCheckedChange={(c) => onChange(c === true)} />
	<Label for={id} class="text-sm font-normal">
		{m['orgAdmin.members.subscriptions.paymentActions.showVoided']()}
	</Label>
</div>
