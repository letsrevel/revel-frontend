<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { Label } from '$lib/components/ui/label';
	import * as RadioGroup from '$lib/components/ui/radio-group';
	import type { VisibilityValue } from '$lib/schemas/preferences';

	interface Props {
		/** Current visibility value (bindable) */
		value: VisibilityValue;
		/** Called whenever the selection changes */
		onchange?: (value: VisibilityValue) => void;
		/** Optional id prefix to avoid radio-id collisions when rendered twice on a page */
		idPrefix?: string;
	}

	let { value = $bindable(), onchange, idPrefix = 'attendee-visibility' }: Props = $props();

	const OPTIONS: { value: VisibilityValue; labelKey: () => string }[] = [
		{ value: 'never', labelKey: () => m['accountSettingsPage.privacyNever']() },
		{ value: 'to_members', labelKey: () => m['accountSettingsPage.privacyToMembers']() },
		{ value: 'to_invitees', labelKey: () => m['accountSettingsPage.privacyToInvitees']() },
		{ value: 'to_both', labelKey: () => m['accountSettingsPage.privacyToBoth']() },
		{ value: 'always', labelKey: () => m['accountSettingsPage.privacyAlways']() }
	];

	function handleChange(newValue: string) {
		value = newValue as VisibilityValue;
		onchange?.(value);
	}
</script>

<div class="space-y-3">
	<div>
		<p class="text-sm font-medium leading-none">
			{m['notificationPreferences.privacySettings']()}
		</p>
		<p class="mt-1 text-sm text-muted-foreground">
			{m['accountSettingsPage.privacyDescription']()}
		</p>
	</div>

	<RadioGroup.Root
		{value}
		onValueChange={handleChange}
		class="space-y-2"
		aria-label={m['notificationPreferences.privacySettings']()}
	>
		{#each OPTIONS as option (option.value)}
			<div class="flex items-center space-x-2">
				<RadioGroup.Item value={option.value} id="{idPrefix}-{option.value}" />
				<Label for="{idPrefix}-{option.value}" class="font-normal">
					{option.labelKey()}
				</Label>
			</div>
		{/each}
	</RadioGroup.Root>
</div>
