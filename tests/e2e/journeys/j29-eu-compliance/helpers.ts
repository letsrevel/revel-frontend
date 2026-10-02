import { expect, type Page } from '../../support/fixtures';
import { ApiClient } from '../../support/api';
import { PERSONAS } from '../../support/personas';
import { gotoHydrated, waitForClientAuth } from '../../support/navigation';

// Journey 29 (USER_JOURNEYS.md) fixtures come from the backend's
// create_compliance_fixtures (part of `make e2e-seed`): one org per country,
// all owned by `test.compliance@example.com`. They're shared by both
// Playwright projects, so specs here only READ them or make writes the
// backend refuses (422) — anything that has to succeed runs on an event the
// spec creates itself.

export function complianceApi(): Promise<ApiClient> {
	return ApiClient.login(PERSONAS.compliance.email, PERSONAS.compliance.password);
}

export interface FixtureEvent {
	id: string;
	slug: string;
	orgSlug: string;
	path: string;
}

/** A seeded event by org + event slug (ids differ per seed). */
export async function fixtureEvent(orgSlug: string, eventSlug: string): Promise<FixtureEvent> {
	const api = await complianceApi();
	const event = await api.get<{ id: string; slug: string }>(
		`/api/events/${orgSlug}/event/${eventSlug}`
	);
	return { id: event.id, slug: event.slug, orgSlug, path: `/events/${orgSlug}/${eventSlug}` };
}

/** The event's tiers by name, from the admin listing. */
export async function fixtureTiers(
	eventId: string
): Promise<Map<string, { id: string; payment_method: string; sales_paused: boolean }>> {
	const api = await complianceApi();
	const tiers = await api.get<{
		results: Array<{ id: string; name: string; payment_method: string; sales_paused: boolean }>;
	}>(`/api/event-admin/${eventId}/ticket-tiers`);
	return new Map(tiers.results.map((t) => [t.name, t]));
}

export async function openBilling(page: Page, orgSlug: string): Promise<void> {
	await gotoHydrated(page, `/org/${orgSlug}/admin/billing`);
	await waitForClientAuth(page);
	await expect(page.getByRole('heading', { name: 'Attendee Invoicing' })).toBeVisible({
		timeout: 15_000
	});
}

export async function openTicketing(page: Page, event: FixtureEvent): Promise<void> {
	await gotoHydrated(page, `/org/${event.orgSlug}/admin/events/${event.id}/edit?tab=ticketing`);
	await waitForClientAuth(page);
	await expect(page.getByRole('heading', { name: 'Ticket Tiers' })).toBeVisible({
		timeout: 15_000
	});
}

export const ITALY_ONLINE_DETAIL =
	"Online card payments aren't available for events in Italy. The law there requires paid tickets sold online to be issued by a ticketing system approved by the Agenzia delle Entrate, and Revel isn't approved yet. You can still sell paid tickets with payment at the door or by bank transfer, and confirm payments from your dashboard.";

export const NOTICE_TEXT = {
	at_registrierkasse:
		"Payments you take at the door go through your own registered cash register (Registrierkasse) once you pass the legal thresholds. Revel's online sales are exempt.",
	dk_sales_registration:
		'If your business must record sales digitally (for example cafés, bars and discos), record your Revel ticket and door sales there too.',
	pl_kasa_fiskalna:
		'Admission sold to consumers for discos, dance halls, amusement and theme parks, and circus performances must be recorded on your own fiscal cash register (kasa fiskalna), even when paid online. For other events, the online-payment exemption applies only if your records link each payment to its sale.'
} as const;
