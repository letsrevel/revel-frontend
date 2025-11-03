<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type { OrganizationMemberSchema } from '$lib/api/generated/types.gen';
	import {
		Dialog,
		DialogContent,
		DialogDescription,
		DialogFooter,
		DialogHeader,
		DialogTitle
	} from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import { UserCog, AlertCircle } from 'lucide-svelte';

	interface Props {
		member: OrganizationMemberSchema | null;
		open: boolean;
		onClose: () => void;
		onConfirm: () => void;
		isPromoting?: boolean;
	}

	let { member, open, onClose, onConfirm, isPromoting = false }: Props = $props();

	// Display name
	let displayName = $derived(
		member
			? member.user.preferred_name ||
					(member.user.first_name && member.user.last_name
						? `${member.user.first_name} ${member.user.last_name}`
						: member.user.first_name || member.user.email || 'this member')
			: 'this member'
	);

	function handleConfirm() {
		onConfirm();
	}

	function handleCancel() {
		if (!isPromoting) {
			onClose();
		}
	}
</script>

<Dialog {open} onOpenChange={onClose}>
	<DialogContent class="max-w-md">
		<DialogHeader>
			<div class="flex items-center gap-3">
				<div class="rounded-full bg-primary/10 p-3">
					<UserCog class="h-6 w-6 text-primary" aria-hidden="true" />
				</div>
				<div class="flex-1">
					<DialogTitle>{m['promoteToStaffDialog.makeStaffMember']()}</DialogTitle>
					<DialogDescription class="mt-1">
						Promote {displayName} to staff
					</DialogDescription>
				</div>
			</div>
		</DialogHeader>

		<div class="space-y-4 py-4">
			<p class="text-sm text-muted-foreground">
				Are you sure you want to make <strong class="font-semibold text-foreground"
					>{displayName}</strong
				> a staff member of this organization?
			</p>

			<div
				class="rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-800 dark:bg-blue-950"
			>
				<div class="flex gap-2">
					<AlertCircle
						class="h-5 w-5 shrink-0 text-blue-600 dark:text-blue-400"
						aria-hidden="true"
					/>
					<div class="text-sm">
						<p class="font-medium text-blue-900 dark:text-blue-100">{m['promoteToStaffDialog.defaultPermissions']()}</p>
						<p class="mt-1 text-blue-700 dark:text-blue-300">
							They will be given default staff permissions. You can customize their permissions
							after promotion.
						</p>
					</div>
				</div>
			</div>

			<div class="space-y-2 text-sm text-muted-foreground">
				<p class="font-medium text-foreground">{m['promoteToStaffDialog.staffMembersCan']()}</p>
				<ul class="ml-4 list-disc space-y-1">
					<li>{m['promoteToStaffDialog.editEvents']()}</li>
					<li>{m['promoteToStaffDialog.checkInAttendees']()}</li>
					<li>{m['promoteToStaffDialog.manageTickets']()}</li>
					<li>{m['promoteToStaffDialog.invitePeople']()}</li>
					<li>{m['promoteToStaffDialog.viewOrgDetails']()}</li>
				</ul>
				<p class="mt-2 text-xs">
					Additional permissions like creating events or managing members can be granted after
					promotion.
				</p>
			</div>
		</div>

		<DialogFooter>
			<Button variant="outline" onclick={handleCancel} disabled={isPromoting}>{m['promoteToStaffDialog.cancel']()}</Button>
			<Button onclick={handleConfirm} disabled={isPromoting}>
				{isPromoting ? 'Promoting...' : m['promoteToStaffDialog.makeStaffMember']()}
			</Button>
		</DialogFooter>
	</DialogContent>
</Dialog>
