import { expect, type Locator, type Page } from '@playwright/test';
import { ApiClient } from './api';
import type { ThrowawayUser } from './factories';

/**
 * Arrange helpers and shared locators for the member register epic (j31).
 *
 * The helpers wrap the staff-side register / note / tier endpoints so a spec can
 * set state up without clicking through unrelated dialogs; locators cover the
 * register list, which renders every entry twice (table from md up, cards below)
 * and so must always be narrowed to the VISIBLE copy.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/** ISO timestamp `days` from now (negative = past). */
export function daysFromNow(days: number): string {
	return new Date(Date.now() + days * DAY_MS).toISOString();
}

/** `<input type="datetime-local">` value (browser-local `YYYY-MM-DDTHH:mm`) for a date. */
export function toDatetimeLocal(date: Date): string {
	const pad = (n: number): string => String(n).padStart(2, '0');
	return (
		`${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
		`T${pad(date.getHours())}:${pad(date.getMinutes())}`
	);
}

export interface RegisterRecord {
	id: string;
	full_name: string;
	email: string | null;
	kind: 'standard' | 'temporary';
	source: string;
	user_id: string | null;
	has_account: boolean;
	invite_status: 'not_invited' | 'invited' | 'linked';
	can_invite: boolean;
	valid_from: string;
	valid_until: string | null;
	event_id: string | null;
	ticket_id: string | null;
}

// One login per owner per worker process: every arrange helper reuses it.
const ownerClients = new Map<string, Promise<ApiClient>>();

function loginOwner(owner: ThrowawayUser): Promise<ApiClient> {
	let client = ownerClients.get(owner.email);
	if (!client) {
		client = ApiClient.login(owner.email, owner.password);
		// Do not cache a failed login.
		client.catch(() => ownerClients.delete(owner.email));
		ownerClients.set(owner.email, client);
	}
	return client;
}

/**
 * Create an account-less register entry. `validFrom` defaults to 30 days ago
 * (so the entry has started and can be invited); pass a future value for a
 * not-yet-started one (such an entry cannot be invited).
 */
export async function createRegisterEntry(
	owner: ThrowawayUser,
	orgSlug: string,
	entry: {
		fullName: string;
		tierId: string;
		email?: string | null;
		validFrom?: string;
		validUntil?: string | null;
	}
): Promise<RegisterRecord> {
	const api = await loginOwner(owner);
	return api.post<RegisterRecord>(`/api/organization-admin/${orgSlug}/member-register`, {
		full_name: entry.fullName,
		email: entry.email ?? null,
		tier_id: entry.tierId,
		valid_from: entry.validFrom ?? daysFromNow(-30),
		...(entry.validUntil !== undefined ? { valid_until: entry.validUntil } : {})
	});
}

/** Send (or re-send) the claim invitation for one entry. */
export async function inviteRegisterEntry(
	owner: ThrowawayUser,
	orgSlug: string,
	recordId: string
): Promise<RegisterRecord> {
	const api = await loginOwner(owner);
	return api.post<RegisterRecord>(
		`/api/organization-admin/${orgSlug}/member-register/${recordId}/invite`
	);
}

/** Patch an entry (staff-editable fields only). */
export async function patchRegisterEntry(
	owner: ThrowawayUser,
	orgSlug: string,
	recordId: string,
	patch: Record<string, unknown>
): Promise<RegisterRecord> {
	const api = await loginOwner(owner);
	return api.patch<RegisterRecord>(
		`/api/organization-admin/${orgSlug}/member-register/${recordId}`,
		patch
	);
}

/** List register entries (first page), optionally narrowed by a raw query string. */
export async function listRegisterEntries(
	owner: ThrowawayUser,
	orgSlug: string,
	query = ''
): Promise<RegisterRecord[]> {
	const api = await loginOwner(owner);
	const page = await api.get<{ results: RegisterRecord[] }>(
		`/api/organization-admin/${orgSlug}/member-register?page_size=100${query ? `&${query}` : ''}`
	);
	return page.results;
}

/** Create a day-membership (temporary) tier. */
export async function createDayMembershipTier(
	owner: ThrowawayUser,
	orgSlug: string,
	name: string
): Promise<{ id: string }> {
	const api = await loginOwner(owner);
	return api.post<{ id: string }>(`/api/organization-admin/${orgSlug}/membership-tiers`, {
		name,
		kind: 'temporary'
	});
}

/**
 * The People tab of the Members area (the register's home since the Members
 * area was unified). `view` is the group chip; the default `everyone` lists
 * every entry, like the retired register page did.
 */
export function registerPath(orgSlug: string, view = 'everyone'): string {
	return `/org/${orgSlug}/admin/members?tab=people&view=${view}`;
}

/** The public claim page of an invite link (path only: the emailed host is the platform's). */
export function claimPathFromLink(link: string): string {
	const url = new URL(link);
	return `${url.pathname}${url.search}`;
}

/**
 * One register entry, wherever the layout renders it. The list is rendered as a
 * table (md and up) AND as cards (below md), both in the DOM, so the VISIBLE
 * copy is the one a user sees.
 */
export function registerEntry(page: Page, fullName: string): Locator {
	return page
		.locator('[data-testid="register-row"], [data-testid="register-card"]')
		.filter({ hasText: fullName })
		.filter({ visible: true });
}

/** The row-actions trigger of an entry (visible copy). */
export function registerEntryActions(page: Page, fullName: string): Locator {
	return page.getByRole('button', { name: `Actions for ${fullName}` }).filter({ visible: true });
}

/** Open an entry's action menu and pick an item by its visible name. */
export async function chooseEntryAction(
	page: Page,
	fullName: string,
	action: string
): Promise<void> {
	await registerEntryActions(page, fullName).click();
	await page.getByRole('menuitem', { name: action }).click();
}

/**
 * Open the person sheet of a People row (the visible copy of the row's name
 * button) and return the sheet: a modal dialog named exactly after the person.
 * The member actions (Manage membership), periods, staff note and account live
 * inside it.
 */
export async function openPersonSheet(page: Page, fullName: string): Promise<Locator> {
	await page
		.getByRole('button', { name: `Open ${fullName}` })
		.first()
		.click();
	const sheet = page.getByRole('dialog', { name: fullName, exact: true });
	await expect(sheet).toBeVisible();
	return sheet;
}

/** True when the document scrolls horizontally (the phone-width regression check). */
export async function hasHorizontalOverflow(page: Page): Promise<boolean> {
	return page.evaluate(() => {
		const el = document.documentElement;
		return el.scrollWidth > el.clientWidth;
	});
}
