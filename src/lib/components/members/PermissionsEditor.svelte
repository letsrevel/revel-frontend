<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type { OrganizationStaffSchema, PermissionMap } from '$lib/api/generated/types.gen';
	import {
		Dialog,
		DialogContent,
		DialogDescription,
		DialogFooter,
		DialogHeader,
		DialogTitle
	} from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import { Label } from '$lib/components/ui/label';
	import { Separator } from '$lib/components/ui/separator';

	interface Props {
		staff: OrganizationStaffSchema | null;
		open: boolean;
		onClose: () => void;
		onSave: (permissions: PermissionMap) => void;
		isSaving?: boolean;
	}

	let { staff, open, onClose, onSave, isSaving = false }: Props = $props();

	// Local permissions state
	let permissions = $state<PermissionMap>({} as PermissionMap);

	// Reset permissions when staff changes
	$effect(() => {
		if (staff?.permissions?.default) {
			permissions = { ...staff.permissions.default };
		}
	});

	// Display name
	let displayName = $derived(
		staff
			? staff.user.preferred_name ||
					(staff.user.first_name && staff.user.last_name
						? `${staff.user.first_name} ${staff.user.last_name}`
						: staff.user.first_name || staff.user.email || 'Staff Member')
			: 'Staff Member'
	);

	// Permission groups for better organization
	const permissionGroups = [
		{
			title: 'Organization Management',
			permissions: [
				{
					key: 'edit_organization',
					label: 'Edit Organization',
					description: 'Update organization details and settings'
				},
				{
					key: 'manage_members',
					label: 'Manage Members',
					description: 'Add, remove, and manage organization members'
				},
				{
					key: 'view_organization_details',
					label: 'View Organization Details',
					description: 'Access detailed organization information'
				}
			]
		},
		{
			title: 'Event Management',
			permissions: [
				{
					key: 'create_event',
					label: 'Create Events',
					description: 'Create new events for the organization'
				},
				{
					key: 'edit_event',
					label: 'Edit Events',
					description: 'Modify event details and settings'
				},
				{
					key: 'delete_event',
					label: 'Delete Events',
					description: 'Delete events from the organization'
				},
				{
					key: 'manage_event',
					label: 'Manage Events',
					description: 'Full event management access'
				},
				{
					key: 'manage_potluck',
					label: 'Manage Potluck',
					description: 'Manage potluck coordination for events'
				},
				{ key: 'open_event', label: 'Open Events', description: 'Open events for registration' },
				{ key: 'close_event', label: 'Close Events', description: 'Close events to registration' }
			]
		},
		{
			title: 'Event Series',
			permissions: [
				{
					key: 'create_event_series',
					label: 'Create Event Series',
					description: 'Create new event series'
				},
				{
					key: 'edit_event_series',
					label: 'Edit Event Series',
					description: 'Modify event series'
				},
				{
					key: 'delete_event_series',
					label: 'Delete Event Series',
					description: 'Delete event series'
				}
			]
		},
		{
			title: 'Attendee Management',
			permissions: [
				{
					key: 'invite_to_event',
					label: 'Invite to Events',
					description: 'Send event invitations'
				},
				{
					key: 'check_in_attendees',
					label: 'Check-in Attendees',
					description: 'Check in attendees at events'
				},
				{ key: 'manage_tickets', label: 'Manage Tickets', description: 'Manage event ticketing' }
			]
		},
		{
			title: 'Questionnaires',
			permissions: [
				{
					key: 'create_questionnaire',
					label: 'Create Questionnaires',
					description: 'Create new questionnaires'
				},
				{
					key: 'edit_questionnaire',
					label: 'Edit Questionnaires',
					description: 'Modify questionnaires'
				},
				{
					key: 'delete_questionnaire',
					label: 'Delete Questionnaires',
					description: 'Delete questionnaires'
				},
				{
					key: 'evaluate_questionnaire',
					label: 'Evaluate Questionnaires',
					description: 'Review questionnaire responses'
				}
			]
		},
		{
			title: 'Announcements',
			permissions: [
				{
					key: 'send_announcements',
					label: 'Send Announcements',
					description: 'Create and send organization announcements'
				}
			]
		}
	];

	function handleSave() {
		onSave(permissions);
	}

	function handleCancel() {
		// Reset to original permissions
		if (staff?.permissions?.default) {
			permissions = { ...staff.permissions.default };
		}
		onClose();
	}

	function togglePermission(key: string) {
		permissions = {
			...permissions,
			[key]: !permissions[key as keyof PermissionMap]
		};
	}
</script>

<Dialog {open} onOpenChange={onClose}>
	<DialogContent class="max-h-[80vh] max-w-2xl overflow-y-auto">
		<DialogHeader>
			<DialogTitle>{m['permissionsEditor.editPermissionsFor']()} {displayName}</DialogTitle>
			<DialogDescription>
				Configure what this staff member can do within the organization. Changes take effect
				immediately.
			</DialogDescription>
		</DialogHeader>

		<div class="space-y-6 py-4">
			{#each permissionGroups as group}
				<div class="space-y-3">
					<h3 class="text-sm font-semibold text-foreground">{group.title}</h3>
					<div class="space-y-3">
						{#each group.permissions as perm}
							<div class="flex items-start gap-3">
								<Checkbox
									id={perm.key}
									checked={permissions[perm.key as keyof PermissionMap] ?? false}
									onCheckedChange={() => togglePermission(perm.key)}
									aria-describedby="{perm.key}-description"
								/>
								<div class="flex-1">
									<Label for={perm.key} class="cursor-pointer text-sm font-medium">
										{perm.label}
									</Label>
									<p id="{perm.key}-description" class="mt-0.5 text-xs text-muted-foreground">
										{perm.description}
									</p>
								</div>
							</div>
						{/each}
					</div>
				</div>
				<Separator />
			{/each}
		</div>

		<DialogFooter>
			<Button variant="outline" onclick={handleCancel} disabled={isSaving}
				>{m['permissionsEditor.cancel']()}</Button
			>
			<Button onclick={handleSave} disabled={isSaving}>
				{isSaving ? 'Saving...' : 'Save Changes'}
			</Button>
		</DialogFooter>
	</DialogContent>
</Dialog>
