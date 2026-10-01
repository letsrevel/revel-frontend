import * as m from '$lib/paraglide/messages.js';
import type { NotificationType } from '$lib/api/generated/types.gen.js';

interface NotificationTypeCopy {
	label: () => string;
	description?: () => string;
}

/**
 * Human labels for notification types. Types missing here fall back to their
 * raw name with underscores turned into spaces (the per-type list capitalizes
 * it with CSS), so this map can grow one type at a time.
 */
const NOTIFICATION_TYPE_COPY: Partial<Record<NotificationType, NotificationTypeCopy>> = {
	org_setup_nudge: {
		label: () => m['notificationPreferences.typeOrgSetupNudge'](),
		description: () => m['notificationPreferences.typeOrgSetupNudgeDescription']()
	}
};

function getCopy(type: string): NotificationTypeCopy | undefined {
	// hasOwn, not `in`: the API may send a type this build doesn't know yet, and
	// `in` would also match prototype keys like `toString`.
	return Object.hasOwn(NOTIFICATION_TYPE_COPY, type)
		? NOTIFICATION_TYPE_COPY[type as NotificationType]
		: undefined;
}

/** Whether `type` has a translated label (vs. the raw-name fallback). */
export function hasNotificationTypeLabel(type: string): boolean {
	return getCopy(type) !== undefined;
}

export function getNotificationTypeLabel(type: string): string {
	return getCopy(type)?.label() ?? type.replace(/_/g, ' ');
}

export function getNotificationTypeDescription(type: string): string | undefined {
	return getCopy(type)?.description?.();
}
