import { describe, it, expect } from 'vitest';
import {
	isOwner,
	getOrgPermissions,
	canPerformAction,
	canPerformActionOnEvent,
	getAllowedActions,
	hasAnyAdminPermission,
	getPermissionDeniedMessage
} from './permissions';
import type { OrganizationPermissionsSchema } from '$lib/types/auth';

describe('Permission Utilities', () => {
	const mockPermissions: OrganizationPermissionsSchema = {
		organization_permissions: {
			'org-owner': 'owner',
			'org-staff': {
				default: {
					create_event: true,
					edit_event: true,
					delete_event: false,
					manage_members: false,
					check_in_attendees: true
				},
				event_overrides: {
					'event-1': {
						edit_event: false, // Override: can't edit this specific event
						delete_event: true // Override: can delete this specific event
					}
				}
			},
			'org-no-perms': {
				default: {}
			}
		}
	};

	describe('isOwner', () => {
		it('should return true for owner', () => {
			expect(isOwner(mockPermissions, 'org-owner')).toBe(true);
		});

		it('should return false for staff', () => {
			expect(isOwner(mockPermissions, 'org-staff')).toBe(false);
		});

		it('should return false for non-existent org', () => {
			expect(isOwner(mockPermissions, 'org-nonexistent')).toBe(false);
		});

		it('should return false for null permissions', () => {
			expect(isOwner(null, 'org-owner')).toBe(false);
		});
	});

	describe('getOrgPermissions', () => {
		it('should return null for owner (has all permissions)', () => {
			expect(getOrgPermissions(mockPermissions, 'org-owner')).toBeNull();
		});

		it('should return permission schema for staff', () => {
			const perms = getOrgPermissions(mockPermissions, 'org-staff');
			expect(perms).toBeDefined();
			expect(perms?.default?.create_event).toBe(true);
		});

		it('should return null for non-existent org', () => {
			expect(getOrgPermissions(mockPermissions, 'org-nonexistent')).toBeNull();
		});

		it('should return null for null permissions', () => {
			expect(getOrgPermissions(null, 'org-staff')).toBeNull();
		});
	});

	describe('canPerformAction', () => {
		it('should return true for owner on any action', () => {
			expect(canPerformAction(mockPermissions, 'org-owner', 'create_event')).toBe(true);
			expect(canPerformAction(mockPermissions, 'org-owner', 'delete_event')).toBe(true);
			expect(canPerformAction(mockPermissions, 'org-owner', 'manage_members')).toBe(true);
		});

		it('should return true for allowed actions', () => {
			expect(canPerformAction(mockPermissions, 'org-staff', 'create_event')).toBe(true);
			expect(canPerformAction(mockPermissions, 'org-staff', 'edit_event')).toBe(true);
			expect(canPerformAction(mockPermissions, 'org-staff', 'check_in_attendees')).toBe(true);
		});

		it('should return false for denied actions', () => {
			expect(canPerformAction(mockPermissions, 'org-staff', 'delete_event')).toBe(false);
			expect(canPerformAction(mockPermissions, 'org-staff', 'manage_members')).toBe(false);
		});

		it('should return false for undefined permissions', () => {
			expect(canPerformAction(mockPermissions, 'org-staff', 'manage_tickets')).toBe(false);
		});

		it('should return false for non-existent org', () => {
			expect(canPerformAction(mockPermissions, 'org-nonexistent', 'create_event')).toBe(false);
		});

		it('should return false for null permissions', () => {
			expect(canPerformAction(null, 'org-staff', 'create_event')).toBe(false);
		});
	});

	describe('canPerformActionOnEvent', () => {
		it('should return true for owner on any event', () => {
			expect(canPerformActionOnEvent(mockPermissions, 'org-owner', 'event-1', 'edit_event')).toBe(
				true
			);
			expect(
				canPerformActionOnEvent(mockPermissions, 'org-owner', 'event-1', 'delete_event')
			).toBe(true);
		});

		it('should use event override when available', () => {
			// Override says edit_event = false for event-1
			expect(canPerformActionOnEvent(mockPermissions, 'org-staff', 'event-1', 'edit_event')).toBe(
				false
			);

			// Override says delete_event = true for event-1 (even though default is false)
			expect(
				canPerformActionOnEvent(mockPermissions, 'org-staff', 'event-1', 'delete_event')
			).toBe(true);
		});

		it('should fall back to default permissions when no override', () => {
			// No override for event-2, use default
			expect(canPerformActionOnEvent(mockPermissions, 'org-staff', 'event-2', 'create_event')).toBe(
				true
			);
			expect(
				canPerformActionOnEvent(mockPermissions, 'org-staff', 'event-2', 'delete_event')
			).toBe(false);
		});

		it('should fall back to default when override does not specify action', () => {
			// event-1 override doesn't mention create_event, use default
			expect(canPerformActionOnEvent(mockPermissions, 'org-staff', 'event-1', 'create_event')).toBe(
				true
			);
		});

		it('should return false for null permissions', () => {
			expect(canPerformActionOnEvent(null, 'org-staff', 'event-1', 'edit_event')).toBe(false);
		});
	});

	describe('getAllowedActions', () => {
		it('should return all actions for owner', () => {
			const actions = getAllowedActions(mockPermissions, 'org-owner');
			expect(actions).toContain('create_event');
			expect(actions).toContain('edit_event');
			expect(actions).toContain('delete_event');
			expect(actions).toContain('manage_members');
			expect(actions.length).toBeGreaterThan(10);
		});

		it('should return only allowed actions for staff', () => {
			const actions = getAllowedActions(mockPermissions, 'org-staff');
			expect(actions).toContain('create_event');
			expect(actions).toContain('edit_event');
			expect(actions).toContain('check_in_attendees');
			expect(actions).not.toContain('delete_event');
			expect(actions).not.toContain('manage_members');
		});

		it('should return empty array for org with no permissions', () => {
			const actions = getAllowedActions(mockPermissions, 'org-no-perms');
			expect(actions).toEqual([]);
		});

		it('should return empty array for non-existent org', () => {
			const actions = getAllowedActions(mockPermissions, 'org-nonexistent');
			expect(actions).toEqual([]);
		});

		it('should return empty array for null permissions', () => {
			const actions = getAllowedActions(null, 'org-staff');
			expect(actions).toEqual([]);
		});
	});

	describe('hasAnyAdminPermission', () => {
		it('should return true for owner', () => {
			expect(hasAnyAdminPermission(mockPermissions, 'org-owner')).toBe(true);
		});

		it('should return true for staff with permissions', () => {
			expect(hasAnyAdminPermission(mockPermissions, 'org-staff')).toBe(true);
		});

		it('should return false for org with no permissions', () => {
			expect(hasAnyAdminPermission(mockPermissions, 'org-no-perms')).toBe(false);
		});

		it('should return false for non-existent org', () => {
			expect(hasAnyAdminPermission(mockPermissions, 'org-nonexistent')).toBe(false);
		});

		it('should return false for null permissions', () => {
			expect(hasAnyAdminPermission(null, 'org-staff')).toBe(false);
		});
	});

	describe('getPermissionDeniedMessage', () => {
		it('should return auth message for null permissions', () => {
			const message = getPermissionDeniedMessage(null, 'org-staff', 'create_event');
			expect(message).toBe('You are not authenticated');
		});

		it('should return access message for non-existent org', () => {
			const message = getPermissionDeniedMessage(
				mockPermissions,
				'org-nonexistent',
				'create_event'
			);
			expect(message).toBe('You do not have access to this organization');
		});

		it('should return specific message for known actions', () => {
			let message = getPermissionDeniedMessage(mockPermissions, 'org-staff', 'create_event');
			expect(message).toBe('You do not have permission to create events');

			message = getPermissionDeniedMessage(mockPermissions, 'org-staff', 'manage_members');
			expect(message).toBe('You do not have permission to manage members');

			message = getPermissionDeniedMessage(mockPermissions, 'org-staff', 'check_in_attendees');
			expect(message).toBe('You do not have permission to check in attendees');
		});

		it('should return generic message for unknown actions', () => {
			const message = getPermissionDeniedMessage(
				mockPermissions,
				'org-staff',
				'some_unknown_action' as any
			);
			expect(message).toContain('some_unknown_action');
		});

		it('should return empty string for owner (should not happen)', () => {
			const message = getPermissionDeniedMessage(mockPermissions, 'org-owner', 'create_event');
			expect(message).toBe('');
		});
	});
});
