<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { organizationadminsubscriptionsListPlans } from '$lib/api/generated/sdk.gen';
	import type {
		OrganizationAdminDetailSchema,
		PlanSchema,
		MembershipTierSchema,
		OrganizationMemberSchema,
		SubscriptionCreateSchema
	} from '$lib/api/generated/types.gen';
	import { authStore } from '$lib/stores/auth.svelte';
	import { Dialog, DialogContent, DialogHeader, DialogTitle } from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import { Label } from '$lib/components/ui/label';
	import { Input } from '$lib/components/ui/input';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import { Textarea } from '$lib/components/ui/textarea';
	import { Loader2 } from 'lucide-svelte';
	import MemberCombobox from './MemberCombobox.svelte';
	import { CURRENCY_OPTIONS } from '$lib/utils/currencies';
	import { formatPlanPrice } from '$lib/utils/subscriptions';

	interface Props {
		organization: OrganizationAdminDetailSchema;
		tiers: MembershipTierSchema[];
		open: boolean;
		onClose: () => void;
		onSubmit: (payload: SubscriptionCreateSchema) => void;
		isSubmitting?: boolean;
	}

	const { organization, tiers, open, onClose, onSubmit, isSubmitting = false }: Props = $props();
	const accessToken = $derived(authStore.accessToken);

	let selectedMember = $state<OrganizationMemberSchema | null>(null);
	let planId = $state<string>('');
	let recordInitial = $state(false);
	let amount = $state('0.00');
	let currency = $state<string>('EUR');
	let notes = $state('');
	let errors = $state<{ user?: string; plan?: string }>({});

	let allPlans = $state<PlanSchema[]>([]);
	$effect(() => {
		if (!open || tiers.length === 0) return;
		(async () => {
			const all: PlanSchema[] = [];
			for (const t of tiers) {
				const r = await organizationadminsubscriptionsListPlans({
					path: { slug: organization.slug, tier_id: t.id ?? '' },
					headers: { Authorization: `Bearer ${accessToken}` }
				});
				if (!r.error && r.data) {
					all.push(...(r.data as PlanSchema[]).filter((p) => p.is_active !== false));
				}
			}
			allPlans = all;
		})();
	});

	// Group plans by tier for the dropdown (preserves tier order)
	const plansByTier = $derived(
		tiers
			.map((t) => ({
				tier: t,
				plans: allPlans.filter((p) => p.tier_id === t.id)
			}))
			.filter((g) => g.plans.length > 0)
	);

	// Sync currency to selected plan's currency
	$effect(() => {
		const p = allPlans.find((pl) => pl.id === planId);
		if (p) currency = p.currency;
	});

	// Reset on close
	$effect(() => {
		if (!open) {
			selectedMember = null;
			planId = '';
			recordInitial = false;
			amount = '0.00';
			currency = 'EUR';
			notes = '';
			errors = {};
		}
	});

	function validate(): boolean {
		errors = {};
		if (!selectedMember || !selectedMember.user.id) {
			errors.user = m['orgAdmin.members.subscriptions.create.errors.userRequired']();
			return false;
		}
		if (!planId) {
			errors.plan = m['orgAdmin.members.subscriptions.create.errors.planRequired']();
			return false;
		}
		return true;
	}

	function handleSubmit(e: Event) {
		e.preventDefault();
		if (!validate()) return;
		const userId = selectedMember?.user.id;
		if (!userId) return;
		const payload: SubscriptionCreateSchema = {
			user_id: userId,
			plan_id: planId
		};
		if (recordInitial) {
			payload.initial_payment_amount = amount;
			payload.initial_payment_currency =
				currency as SubscriptionCreateSchema['initial_payment_currency'];
			payload.initial_payment_notes = notes;
		}
		onSubmit(payload);
	}
</script>

<Dialog {open} onOpenChange={(v: boolean) => (!v ? onClose() : null)}>
	<DialogContent class="sm:max-w-md">
		<DialogHeader>
			<DialogTitle>{m['orgAdmin.members.subscriptions.create.title']()}</DialogTitle>
		</DialogHeader>

		<form onsubmit={handleSubmit} class="space-y-4">
			<div class="space-y-1">
				<Label>{m['orgAdmin.members.subscriptions.create.user']()}</Label>
				<MemberCombobox
					{organization}
					value={selectedMember}
					onSelect={(member) => (selectedMember = member)}
				/>
				{#if errors.user}<p class="text-sm text-red-600">{errors.user}</p>{/if}
			</div>

			<div class="space-y-1">
				<Label for="sub-plan">{m['orgAdmin.members.subscriptions.create.plan']()}</Label>
				<select
					id="sub-plan"
					bind:value={planId}
					class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm transition-colors focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
				>
					<option value="" disabled>—</option>
					{#each plansByTier as group (group.tier.id)}
						<optgroup label={group.tier.name}>
							{#each group.plans as p (p.id)}
								<option value={p.id ?? ''}>{p.name} — {formatPlanPrice(p)}</option>
							{/each}
						</optgroup>
					{/each}
				</select>
				{#if errors.plan}<p class="text-sm text-red-600">{errors.plan}</p>{/if}
			</div>

			<div class="flex items-center gap-2">
				<Checkbox
					id="sub-initial"
					checked={recordInitial}
					onCheckedChange={(c) => (recordInitial = c === true)}
				/>
				<Label for="sub-initial">{m['orgAdmin.members.subscriptions.create.recordInitial']()}</Label
				>
			</div>

			{#if recordInitial}
				<div class="grid grid-cols-2 gap-3">
					<div class="space-y-1">
						<Label for="sub-amt">{m['orgAdmin.members.subscriptions.create.amount']()}</Label>
						<Input id="sub-amt" type="number" min="0" step="0.01" bind:value={amount} />
					</div>
					<div class="space-y-1">
						<Label for="sub-cur">{m['orgAdmin.members.subscriptions.create.currency']()}</Label>
						<select
							id="sub-cur"
							bind:value={currency}
							class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm transition-colors focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
						>
							{#each CURRENCY_OPTIONS as opt (opt.value)}
								<option value={opt.value}>{opt.label}</option>
							{/each}
						</select>
					</div>
				</div>
				<div class="space-y-1">
					<Label for="sub-notes">{m['orgAdmin.members.subscriptions.create.notes']()}</Label>
					<Textarea id="sub-notes" bind:value={notes} rows={2} />
				</div>
			{/if}

			<div class="flex justify-end gap-2">
				<Button type="button" variant="outline" onclick={onClose} disabled={isSubmitting}>
					{m['tierForm.cancel']()}
				</Button>
				<Button type="submit" disabled={isSubmitting}>
					{#if isSubmitting}<Loader2 class="mr-2 h-4 w-4 animate-spin" />{/if}
					{m['orgAdmin.members.subscriptions.create.submit']()}
				</Button>
			</div>
		</form>
	</DialogContent>
</Dialog>
