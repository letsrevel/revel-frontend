<script lang="ts">
	import type {
		OrganizationTokenSchema,
		OrganizationTokenCreateSchema,
		OrganizationTokenUpdateSchema
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
		isLoading?: boolean;
		onClose: () => void;
		onSave: (
			data: OrganizationTokenCreateSchema | OrganizationTokenUpdateSchema
		) => void | Promise<void>;
	}

	let { open, token = null, isLoading = false, onClose, onSave }: Props = $props();

	const isEdit = $derived(!!token);

	// Form state
	let name = $state('');
	let duration = $state<number>(1440); // Default 1 day
	let maxUses = $state<number>(1);
	let grantsMembership = $state(true);
	let grantsStaffStatus = $state(false);
	let expiresAt = $state<string>('');

	// Reset form when token changes or modal opens
	$effect(() => {
		if (open) {
			if (token) {
				name = token.name || '';
				maxUses = token.max_uses;
				grantsMembership = token.grants_membership;
				grantsStaffStatus = token.grants_staff_status;
				expiresAt = token.expires_at || '';
				duration = 1440; // Not used in edit mode
			} else {
				// Reset to defaults for create
				name = '';
				duration = 1440;
				maxUses = 1;
				grantsMembership = true;
				grantsStaffStatus = false;
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
				grants_staff_status: grantsStaffStatus
			};
			onSave(updateData);
		} else {
			// Create
			const createData: OrganizationTokenCreateSchema = {
				name: name || null,
				duration: duration,
				max_uses: maxUses,
				grants_membership: grantsMembership,
				grants_staff_status: grantsStaffStatus
			};
			onSave(createData);
		}
	}

	const showStaffWarning = $derived(grantsStaffStatus);
	const showBothUncheckedWarning = $derived(!grantsMembership && !grantsStaffStatus);
</script>

<Dialog {open} onOpenChange={(isOpen) => { if (!isOpen) onClose(); }}>
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
				<Label for="token-name">Name (optional)</Label>
				<Input
					id="token-name"
					bind:value={name}
					placeholder="e.g., Spring 2025 Recruitment"
					maxlength={150}
				/>
				<p class="text-xs text-muted-foreground">
					A display name to help you organize your tokens
				</p>
			</div>

			{#if !isEdit}
				<!-- Duration (create only) -->
				<div class="space-y-2">
					<Label>Duration</Label>
					<RadioGroup bind:value={duration}>
						{#each durationOptions as option}
							<div class="flex items-center space-x-2">
								<RadioGroupItem value={option.value} id={`duration-${option.value}`} />
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
					<Label for="expires-at">Expiration Date</Label>
					<Input
						id="expires-at"
						type="datetime-local"
						bind:value={expiresAt}
					/>
					<p class="text-xs text-muted-foreground">
						Leave empty for no expiration
					</p>
				</div>
			{/if}

			<!-- Max Uses -->
			<div class="space-y-2">
				<Label for="max-uses">Maximum Uses</Label>
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
				{#if isEdit && token && maxUses < token.uses}
					<p class="flex items-center gap-1 text-xs text-destructive">
						<AlertCircle class="h-3 w-3" aria-hidden="true" />
						Warning: This will disable the token immediately (already {token.uses} uses)
					</p>
				{/if}
			</div>

			<!-- Access Type -->
			<div class="space-y-3">
				<Label>Access Type</Label>

				<label class="flex cursor-pointer items-start gap-3 rounded-md border p-3 transition-colors hover:bg-accent">
					<Checkbox
						checked={grantsMembership}
						onCheckedChange={(checked) => (grantsMembership = !!checked)}
						id="grants-membership"
					/>
					<div class="flex-1">
						<div class="font-medium">Grant membership access</div>
						<div class="text-sm text-muted-foreground">
							Users become organization members when claiming
						</div>
					</div>
				</label>

				<label class="flex cursor-pointer items-start gap-3 rounded-md border p-3 transition-colors hover:bg-accent">
					<Checkbox
						checked={grantsStaffStatus}
						onCheckedChange={(checked) => (grantsStaffStatus = !!checked)}
						id="grants-staff"
					/>
					<div class="flex-1">
						<div class="flex items-center gap-2 font-medium">
							<span>Grant staff access</span>
							<span class="text-xs text-muted-foreground">⚠️ Sensitive</span>
						</div>
						<div class="text-sm text-muted-foreground">
							Users become staff with permissions when claiming
						</div>
					</div>
				</label>

				{#if showStaffWarning}
					<div class="rounded-md bg-yellow-50 p-3 text-sm text-yellow-800">
						<strong>Security Warning:</strong> Staff tokens grant sensitive permissions. Only share
						privately (email, Slack DM, etc.).
					</div>
				{/if}

				{#if showBothUncheckedWarning}
					<div class="rounded-md bg-red-50 p-3 text-sm text-red-800">
						<strong>Error:</strong> At least one access type must be selected. The token must grant
						membership or staff access.
					</div>
				{/if}
			</div>

			<DialogFooter>
				<Button type="button" variant="outline" onclick={onClose} disabled={isLoading}>
					Cancel
				</Button>
				<Button type="submit" disabled={isLoading || showBothUncheckedWarning}>
					{#if isLoading}
						<Loader2 class="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
					{/if}
					{isEdit ? 'Save Changes' : 'Create Token'}
				</Button>
			</DialogFooter>
		</form>
	</DialogContent>
</Dialog>
