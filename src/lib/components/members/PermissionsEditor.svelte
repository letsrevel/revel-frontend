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

	const { staff, open, onClose, onSave, isSaving = false }: Props = $props();

	// Local permissions state
	let permissions = $state<PermissionMap>({} as PermissionMap);

	// Reset permissions when staff changes
	$effect(() => {
		if (staff?.permissions?.default) {
			permissions = { ...staff.permissions.default };
		}
	});

	// Display name
	const displayName = $derived(
		staff
			? staff.user.preferred_name ||
					(staff.user.first_name && staff.user.last_name
						? `${staff.user.first_name} ${staff.user.last_name}`
						: staff.user.first_name || staff.user.email || m['permissionsEditor.staffMember']())
			: m['permissionsEditor.staffMember']()
	);

	// Permission groups for better organization
	const permissionGroups = [
		{
			title: m['permissionsEditor.groups.organizationManagement'](),
			permissions: [
				{
					key: 'edit_organization',
					label: m['permissionsEditor.perms.editOrganization.label'](),
					description: m['permissionsEditor.perms.editOrganization.description']()
				},
				{
					key: 'manage_members',
					label: m['permissionsEditor.perms.manageMembers.label'](),
					description: m['permissionsEditor.perms.manageMembers.description']()
				},
				{
					key: 'view_organization_details',
					label: m['permissionsEditor.perms.viewOrganizationDetails.label'](),
					description: m['permissionsEditor.perms.viewOrganizationDetails.description']()
				}
			]
		},
		{
			title: m['permissionsEditor.groups.eventManagement'](),
			permissions: [
				{
					key: 'create_event',
					label: m['permissionsEditor.perms.createEvent.label'](),
					description: m['permissionsEditor.perms.createEvent.description']()
				},
				{
					key: 'edit_event',
					label: m['permissionsEditor.perms.editEvent.label'](),
					description: m['permissionsEditor.perms.editEvent.description']()
				},
				{
					key: 'delete_event',
					label: m['permissionsEditor.perms.deleteEvent.label'](),
					description: m['permissionsEditor.perms.deleteEvent.description']()
				},
				{
					key: 'manage_event',
					label: m['permissionsEditor.perms.manageEvent.label'](),
					description: m['permissionsEditor.perms.manageEvent.description']()
				},
				{
					key: 'manage_potluck',
					label: m['permissionsEditor.perms.managePotluck.label'](),
					description: m['permissionsEditor.perms.managePotluck.description']()
				},
				{
					key: 'open_event',
					label: m['permissionsEditor.perms.openEvent.label'](),
					description: m['permissionsEditor.perms.openEvent.description']()
				},
				{
					key: 'close_event',
					label: m['permissionsEditor.perms.closeEvent.label'](),
					description: m['permissionsEditor.perms.closeEvent.description']()
				}
			]
		},
		{
			title: m['permissionsEditor.groups.eventSeries'](),
			permissions: [
				{
					key: 'create_event_series',
					label: m['permissionsEditor.perms.createEventSeries.label'](),
					description: m['permissionsEditor.perms.createEventSeries.description']()
				},
				{
					key: 'edit_event_series',
					label: m['permissionsEditor.perms.editEventSeries.label'](),
					description: m['permissionsEditor.perms.editEventSeries.description']()
				},
				{
					key: 'delete_event_series',
					label: m['permissionsEditor.perms.deleteEventSeries.label'](),
					description: m['permissionsEditor.perms.deleteEventSeries.description']()
				}
			]
		},
		{
			title: m['permissionsEditor.groups.attendeeManagement'](),
			permissions: [
				{
					key: 'invite_to_event',
					label: m['permissionsEditor.perms.inviteToEvent.label'](),
					description: m['permissionsEditor.perms.inviteToEvent.description']()
				},
				{
					key: 'check_in_attendees',
					label: m['permissionsEditor.perms.checkInAttendees.label'](),
					description: m['permissionsEditor.perms.checkInAttendees.description']()
				},
				{
					key: 'manage_tickets',
					label: m['permissionsEditor.perms.manageTickets.label'](),
					description: m['permissionsEditor.perms.manageTickets.description']()
				}
			]
		},
		{
			title: m['permissionsEditor.groups.questionnaires'](),
			permissions: [
				{
					key: 'create_questionnaire',
					label: m['permissionsEditor.perms.createQuestionnaire.label'](),
					description: m['permissionsEditor.perms.createQuestionnaire.description']()
				},
				{
					key: 'edit_questionnaire',
					label: m['permissionsEditor.perms.editQuestionnaire.label'](),
					description: m['permissionsEditor.perms.editQuestionnaire.description']()
				},
				{
					key: 'delete_questionnaire',
					label: m['permissionsEditor.perms.deleteQuestionnaire.label'](),
					description: m['permissionsEditor.perms.deleteQuestionnaire.description']()
				},
				{
					key: 'evaluate_questionnaire',
					label: m['permissionsEditor.perms.evaluateQuestionnaire.label'](),
					description: m['permissionsEditor.perms.evaluateQuestionnaire.description']()
				}
			]
		},
		{
			title: m['permissionsEditor.groups.announcements'](),
			permissions: [
				{
					key: 'send_announcements',
					label: m['permissionsEditor.perms.sendAnnouncements.label'](),
					description: m['permissionsEditor.perms.sendAnnouncements.description']()
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
				{m['permissionsEditor.dialogDescription']()}
			</DialogDescription>
		</DialogHeader>

		<div class="space-y-6 py-4">
			{#each permissionGroups as group (group.title)}
				<div class="space-y-3">
					<h3 class="text-sm font-semibold text-foreground">{group.title}</h3>
					<div class="space-y-3">
						{#each group.permissions as perm (perm.key)}
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
				{isSaving ? m['permissionsEditor.saving']() : m['permissionsEditor.saveChanges']()}
			</Button>
		</DialogFooter>
	</DialogContent>
</Dialog>
