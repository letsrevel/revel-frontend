<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type {
		OrganizationTokenSchema,
		OrganizationTokenCreateSchema,
		OrganizationTokenUpdateSchema,
		MembershipTierSchema
	} from '$lib/api/generated/types.gen';
	import {
		Dialog,
		DialogContent,
		DialogDescription,
		DialogFooter,
		DialogHeader,
		DialogTitle
	} from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import { RadioGroup, RadioGroupItem } from '$lib/components/ui/radio-group';
	import { AlertCircle, Loader2 } from 'lucide-svelte';
	import { durationOptions } from '$lib/utils/tokens';

	interface Props {
		open: boolean;
		token?: OrganizationTokenSchema | null;
		membershipTiers: MembershipTierSchema[];
		isLoading?: boolean;
		onClose: () => void;
		onSave: (
			data: OrganizationTokenCreateSchema | OrganizationTokenUpdateSchema
		) => void | Promise<void>;
	}

	let { open, token = null, membershipTiers, isLoading = false, onClose, onSave }: Props = $props();

	const isEdit = $derived(!!token);

	// Form state
	let name = $state('');
	let duration = $state<string>('1440'); // Default 1 day
	let maxUses = $state<number>(1);
	let grantsMembership = $state(true);
	let grantsStaffStatus = $state(false);
	let membershipTierId = $state<string>('');
	let expiresAt = $state<string>('');

	// Reset form when token changes or modal opens
	$effect(() => {
		if (open) {
			if (token) {
				name = token.name || '';
				maxUses = token.max_uses ?? 0;
				grantsMembership = token.grants_membership ?? false;
				grantsStaffStatus = token.grants_staff_status ?? false;
				membershipTierId = token.membership_tier || '';
				expiresAt = token.expires_at || '';
				duration = '1440'; // Not used in edit mode
			} else {
				// Reset to defaults for create
				name = '';
				duration = '1440';
				maxUses = 1;
				grantsMembership = true;
				grantsStaffStatus = false;
				// Pre-select first tier if available and grants_membership is true
				membershipTierId = membershipTiers.length > 0 ? membershipTiers[0].id || '' : '';
				expiresAt = '';
			}
		}
	});

	function handleSave() {
		if (isEdit && token) {
			// Update
			const updateData: OrganizationTokenUpdateSchema = {
				name: name || null,
				max_uses: maxUses,
				expires_at: expiresAt || null,
				grants_membership: grantsMembership,
				grants_staff_status: grantsStaffStatus,
				membership_tier_id: grantsMembership && membershipTierId ? membershipTierId : null
			};
			onSave(updateData);
		} else {
			// Create
			const createData: OrganizationTokenCreateSchema = {
				name: name || null,
				duration: parseInt(duration, 10),
				max_uses: maxUses,
				grants_membership: grantsMembership,
				grants_staff_status: grantsStaffStatus,
				membership_tier_id: grantsMembership && membershipTierId ? membershipTierId : null
			};
			onSave(createData);
		}
	}

	const showStaffWarning = $derived(grantsStaffStatus);
	const showBothUncheckedWarning = $derived(!grantsMembership && !grantsStaffStatus);
	const showTierRequiredWarning = $derived(
		grantsMembership && membershipTiers.length > 0 && !membershipTierId
	);
	const isFormValid = $derived(!showBothUncheckedWarning && !showTierRequiredWarning);
</script>

<Dialog
	{open}
	onOpenChange={(isOpen) => {
		if (!isOpen) onClose();
	}}
>
	<DialogContent class="max-h-[90vh] overflow-y-auto sm:max-w-[500px]">
		<DialogHeader>
			<DialogTitle>{isEdit ? 'Edit' : 'Create'} Invitation Token</DialogTitle>
			<DialogDescription>
				{#if isEdit}
					Update token settings. The shareable link will remain the same.
				{:else}
					Create a shareable invitation link for your organization.
				{/if}
			</DialogDescription>
		</DialogHeader>

		<form
			onsubmit={(e) => {
				e.preventDefault();
				handleSave();
			}}
			class="space-y-4"
		>
			<!-- Name -->
			<div class="space-y-2">
				<Label for="token-name">{m['organizationTokenModal.nameOptional']()}</Label>
				<Input
					id="token-name"
					bind:value={name}
					placeholder="e.g., Spring 2025 Recruitment"
					maxlength={150}
				/>
				<p class="text-xs text-muted-foreground">{m['organizationTokenModal.displayName']()}</p>
			</div>

			{#if !isEdit}
				<!-- Duration (create only) -->
				<div class="space-y-2">
					<Label>{m['organizationTokenModal.duration']()}</Label>
					<RadioGroup bind:value={duration}>
						{#each durationOptions as option}
							<div class="flex items-center space-x-2">
								<RadioGroupItem value={option.value.toString()} id={`duration-${option.value}`} />
								<Label for={`duration-${option.value}`} class="font-normal">
									{option.label}
								</Label>
							</div>
						{/each}
					</RadioGroup>
				</div>
			{:else}
				<!-- Expires At (edit only) -->
				<div class="space-y-2">
					<Label for="expires-at">{m['organizationTokenModal.expirationDate']()}</Label>
					<Input id="expires-at" type="datetime-local" bind:value={expiresAt} />
					<p class="text-xs text-muted-foreground">{m['organizationTokenModal.noExpiration']()}</p>
				</div>
			{/if}

			<!-- Max Uses -->
			<div class="space-y-2">
				<Label for="max-uses">{m['organizationTokenModal.maxUses']()}</Label>
				<Input
					id="max-uses"
					type="number"
					bind:value={maxUses}
					min={0}
					placeholder="0 = unlimited"
				/>
				<p class="text-xs text-muted-foreground">
					0 = unlimited uses. Set a number to limit how many people can join.
				</p>
				{#if isEdit && token && token.uses !== undefined && maxUses < token.uses}
					<p class="flex items-center gap-1 text-xs text-destructive">
						<AlertCircle class="h-3 w-3" aria-hidden="true" />
						Warning: This will disable the token immediately (already {token.uses} uses)
					</p>
				{/if}
			</div>

			<!-- Access Type -->
			<div class="space-y-3">
				<Label>{m['organizationTokenModal.accessType']()}</Label>

				<label
					class="flex cursor-pointer items-start gap-3 rounded-md border p-3 transition-colors hover:bg-accent"
				>
					<Checkbox
						checked={grantsMembership}
						onCheckedChange={(checked) => (grantsMembership = !!checked)}
						id="grants-membership"
					/>
					<div class="flex-1">
						<div class="font-medium">{m['organizationTokenModal.grantMembership']()}</div>
						<div class="text-sm text-muted-foreground">
							Users become organization members when claiming
						</div>
					</div>
				</label>

				<!-- Membership Tier Selection (conditional) -->
				{#if grantsMembership && membershipTiers.length > 0}
					<div class="ml-10 space-y-2">
						<Label for="membership-tier">Membership Tier</Label>
						<select
							id="membership-tier"
							bind:value={membershipTierId}
							class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
						>
							<option value="">Select a tier...</option>
							{#each membershipTiers as tier (tier.id)}
								<option value={tier.id}>{tier.name}</option>
							{/each}
						</select>
						<p class="text-xs text-muted-foreground">
							Select which membership tier to assign when users claim this token
						</p>
					</div>
				{/if}

				<label
					class="flex cursor-pointer items-start gap-3 rounded-md border p-3 transition-colors hover:bg-accent"
				>
					<Checkbox
						checked={grantsStaffStatus}
						onCheckedChange={(checked) => (grantsStaffStatus = !!checked)}
						id="grants-staff"
					/>
					<div class="flex-1">
						<div class="flex items-center gap-2 font-medium">
							<span>{m['organizationTokenModal.grantStaff']()}</span>
							<span class="text-xs text-muted-foreground">⚠️ Sensitive</span>
						</div>
						<div class="text-sm text-muted-foreground">
							Users become staff with permissions when claiming
						</div>
					</div>
				</label>

				{#if showStaffWarning}
					<div class="rounded-md bg-yellow-50 p-3 text-sm text-yellow-800">
						<strong>{m['organizationTokenModal.securityWarning']()}</strong> Staff tokens grant sensitive
						permissions. Only share privately (email, Slack DM, etc.).
					</div>
				{/if}

				{#if showBothUncheckedWarning}
					<div class="rounded-md bg-red-50 p-3 text-sm text-red-800">
						<strong>{m['organizationTokenModal.error']()}</strong> At least one access type must be selected.
						The token must grant membership or staff access.
					</div>
				{/if}

				{#if showTierRequiredWarning}
					<div class="rounded-md bg-red-50 p-3 text-sm text-red-800">
						<strong>{m['organizationTokenModal.error']()}</strong> Membership tier is required when granting
						membership.
					</div>
				{/if}
			</div>

			<DialogFooter>
				<Button type="button" variant="outline" onclick={onClose} disabled={isLoading}>
					Cancel
				</Button>
				<Button type="submit" disabled={isLoading || !isFormValid}>
					{#if isLoading}
						<Loader2 class="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
					{/if}
					{isEdit ? 'Save Changes' : 'Create Token'}
				</Button>
			</DialogFooter>
		</form>
	</DialogContent>
</Dialog>
