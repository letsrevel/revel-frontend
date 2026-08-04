<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import MarkdownEditor from '$lib/components/forms/MarkdownEditor.svelte';
	import type { OrganizationAdminDetailSchema } from '$lib/api/generated';
	import SectionHeader from '$lib/components/common/SectionHeader.svelte';

	interface Props {
		organization: OrganizationAdminDetailSchema;
	}

	const { organization }: Props = $props();

	// All three fields always render and always post — the number inputs via their
	// `name`, the markdown body via a hidden input — and the settings action includes
	// each one only when it actually arrived (`formData.has()`).
	//
	// Not because omitting them would reset them: the backend applies only the fields
	// the client sent (`exclude_unset=True`), so an absent field is left alone. The
	// point is the inverse failure, the #491 telegram_url data loss — a field written
	// into the payload unconditionally while its control wasn't rendered, overwriting
	// the stored value with the component's empty default.
	let gracePeriodDays = $state<number>(organization.membership_grace_period_days ?? 7);
	let revivalWindowDays = $state<number>(
		organization.membership_subscription_revival_window_days ?? 30
	);
	let refundPolicy = $state(organization.membership_refund_policy || '');

	// Re-sync once a save has refreshed the organization.
	$effect(() => {
		gracePeriodDays = organization.membership_grace_period_days ?? 7;
		revivalWindowDays = organization.membership_subscription_revival_window_days ?? 30;
		refundPolicy = organization.membership_refund_policy || '';
	});
</script>

<section class="space-y-4 rounded-lg border border-border bg-card p-6 shadow-sm">
	<SectionHeader title={m['orgSettingsPage.subscriptionPolicy.heading']()} />
	<p class="text-sm text-muted-foreground">
		{m['orgSettingsPage.subscriptionPolicy.description']()}
	</p>

	<!-- Grace period (days) -->
	<div>
		<label for="membership_grace_period_days" class="block text-sm font-medium">
			{m['orgSettingsPage.subscriptionPolicy.gracePeriodLabel']()}
		</label>
		<input
			type="number"
			id="membership_grace_period_days"
			name="membership_grace_period_days"
			min="0"
			step="1"
			inputmode="numeric"
			bind:value={gracePeriodDays}
			class="mt-1 flex w-full rounded-md border-2 border-input bg-background px-3 py-2 text-sm text-foreground transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 sm:max-w-xs"
		/>
		<p class="mt-1 text-xs text-muted-foreground">
			{m['orgSettingsPage.subscriptionPolicy.gracePeriodHelp']()}
		</p>
	</div>

	<!-- Revival window (days; 0 = disabled) -->
	<div>
		<label for="membership_subscription_revival_window_days" class="block text-sm font-medium">
			{m['orgSettingsPage.subscriptionPolicy.revivalWindowLabel']()}
		</label>
		<input
			type="number"
			id="membership_subscription_revival_window_days"
			name="membership_subscription_revival_window_days"
			min="0"
			step="1"
			inputmode="numeric"
			bind:value={revivalWindowDays}
			class="mt-1 flex w-full rounded-md border-2 border-input bg-background px-3 py-2 text-sm text-foreground transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 sm:max-w-xs"
		/>
		<p class="mt-1 text-xs text-muted-foreground">
			{m['orgSettingsPage.subscriptionPolicy.revivalWindowHelp']()}
		</p>
	</div>

	<!-- Refund policy (markdown) -->
	<div>
		<MarkdownEditor
			bind:value={refundPolicy}
			label={m['orgSettingsPage.subscriptionPolicy.refundPolicyLabel']()}
			placeholder={m['orgSettingsPage.subscriptionPolicy.refundPolicyPlaceholder']()}
			rows={6}
		/>
		<input type="hidden" name="membership_refund_policy" value={refundPolicy} />
		<p class="mt-1 text-xs text-muted-foreground">
			{m['orgSettingsPage.subscriptionPolicy.refundPolicyHelp']()}
		</p>
	</div>
</section>
