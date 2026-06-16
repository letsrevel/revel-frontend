<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { Select, SelectContent, SelectItem, SelectTrigger } from '$lib/components/ui/select';
	import type { VisibilityValue } from '$lib/schemas/preferences';

	interface Props {
		/** Current visibility value (bindable) */
		value: VisibilityValue;
		/** Called whenever the selection changes */
		onValueChange?: (value: VisibilityValue) => void;
		/**
		 * When false the internal "Privacy Settings" heading + description are suppressed so
		 * the host page can supply its own heading without creating two competing titles.
		 * Defaults to true so existing usages (settings page) are unchanged.
		 */
		showHeading?: boolean;
	}

	let { value = $bindable(), onValueChange, showHeading = true }: Props = $props();

	const OPTIONS: { value: VisibilityValue; label: () => string }[] = [
		{ value: 'never', label: () => m['accountSettingsPage.privacyNever']() },
		{ value: 'to_members', label: () => m['accountSettingsPage.privacyToMembers']() },
		{ value: 'to_invitees', label: () => m['accountSettingsPage.privacyToInvitees']() },
		{ value: 'to_both', label: () => m['accountSettingsPage.privacyToBoth']() },
		{ value: 'always', label: () => m['accountSettingsPage.privacyAlways']() }
	];

	const selectedLabel = $derived(OPTIONS.find((o) => o.value === value)?.label() ?? '');
</script>

<div class="space-y-3">
	{#if showHeading}
		<div>
			<p class="text-sm font-medium leading-none">
				{m['notificationPreferences.privacySettings']()}
			</p>
			<p class="mt-1 text-sm text-muted-foreground">
				{m['accountSettingsPage.privacyDescription']()}
			</p>
		</div>
	{/if}

	<Select
		type="single"
		{value}
		onValueChange={(v) => {
			if (v) {
				value = v as VisibilityValue;
				onValueChange?.(value);
			}
		}}
	>
		<SelectTrigger aria-label={m['notificationPreferences.privacySettings']()}>
			{selectedLabel}
		</SelectTrigger>
		<SelectContent>
			{#each OPTIONS as option (option.value)}
				<SelectItem value={option.value} label={option.label()}>{option.label()}</SelectItem>
			{/each}
		</SelectContent>
	</Select>

	{#if !showHeading}
		<p class="text-sm text-muted-foreground">
			{m['accountSettingsPage.privacyDescription']()}
		</p>
	{/if}
</div>
