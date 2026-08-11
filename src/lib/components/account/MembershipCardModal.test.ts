import { render, screen, waitFor } from '@testing-library/svelte';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MembershipCardModal from './MembershipCardModal.svelte';
import type { MyMembershipSchema } from '$lib/api/generated/types.gen';

const toDataURL = vi.hoisted(() => vi.fn());
vi.mock('qrcode', () => ({ default: { toDataURL } }));

vi.mock('$lib/api', () => ({ membershipwalletDownloadPdf: vi.fn() }));
vi.mock('$lib/api/generated/sdk.gen', () => ({
	membershipwalletDownloadApplePass: vi.fn(),
	membershipwalletGoogleWalletSaveLink: vi.fn(),
	ticketwalletDownloadApplePass: vi.fn(),
	seriespassDownloadSeriesPassPkpass: vi.fn(),
	ticketwalletGoogleWalletSaveLink: vi.fn(),
	seriespassGoogleWalletSaveLink: vi.fn()
}));

vi.mock('$lib/stores/auth.svelte', () => ({
	authStore: {
		get user() {
			return {
				preferred_name: 'Bella Distefano',
				pronouns: 'they/them',
				first_name: 'Bella',
				last_name: 'Distefano',
				email: 'bella@example.com',
				display_name: 'Bella Distefano',
				bio: ''
			};
		},
		get accessToken() {
			return 'token';
		}
	}
}));

const QR_PAYLOAD = 'member:3f1b8b9a-1c2d-4e5f-8a9b-0c1d2e3f4a5b';

function membership(overrides: Partial<MyMembershipSchema> = {}): MyMembershipSchema {
	return {
		id: '3f1b8b9a-1c2d-4e5f-8a9b-0c1d2e3f4a5b',
		qr_payload: QR_PAYLOAD,
		organization_id: 'org-1',
		organization_name: 'Acme Collective',
		organization_slug: 'acme-collective',
		organization_logo_url: null,
		member_since: '2025-03-14T10:00:00Z',
		status: 'active',
		tier: { name: 'Founding Member' },
		apple_pass_available: true,
		google_pass_available: true,
		...overrides
	};
}

describe('MembershipCardModal', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		toDataURL.mockResolvedValue('data:image/png;base64,QR');
	});

	/**
	 * The single most important assertion in this file. The backend owns the
	 * `member:` namespace; a card whose QR the frontend assembled would break
	 * silently the day that contract changes.
	 */
	it('encodes the backend qr_payload verbatim', async () => {
		render(MembershipCardModal, {
			props: { open: true, membership: membership(), onClose: vi.fn() }
		});
		await waitFor(() => expect(toDataURL).toHaveBeenCalled());
		expect(toDataURL.mock.calls[0][0]).toBe(QR_PAYLOAD);
	});

	it('does not generate a QR while closed', () => {
		render(MembershipCardModal, {
			props: { open: false, membership: membership(), onClose: vi.fn() }
		});
		expect(toDataURL).not.toHaveBeenCalled();
	});

	it('names the organization and the tier', () => {
		render(MembershipCardModal, {
			props: { open: true, membership: membership(), onClose: vi.fn() }
		});
		expect(screen.getByText('Acme Collective')).toBeInTheDocument();
		expect(screen.getByText('Founding Member')).toBeInTheDocument();
	});

	it("shows the member's own name and pronouns", () => {
		render(MembershipCardModal, {
			props: { open: true, membership: membership(), onClose: vi.fn() }
		});
		expect(screen.getByText(/Bella Distefano/)).toBeInTheDocument();
		expect(screen.getByText(/they\/them/)).toBeInTheDocument();
	});

	it('renders member-since with a textual month, never an ambiguous numeric one', () => {
		render(MembershipCardModal, {
			props: { open: true, membership: membership(), onClose: vi.fn() }
		});
		expect(screen.queryByText(/\d{1,2}\/\d{1,2}\/\d{4}/)).not.toBeInTheDocument();
		expect(screen.getByText(/Mar/i)).toBeInTheDocument();
	});

	// Matched on the CONSEQUENCE clause, not the bare status word: the badge next
	// to it already says "Paused", and a loose /paused/i would pass on the badge
	// alone while the notice this test exists for was missing.
	it.each([
		['paused', /Organizers will see it as paused/i],
		['cancelled', /This membership has ended/i],
		['banned', /This membership has been revoked/i]
	] as const)('states the consequence of a %s membership in words', (status, copy) => {
		render(MembershipCardModal, {
			props: { open: true, membership: membership({ status }), onClose: vi.fn() }
		});
		expect(screen.getByText(copy)).toBeInTheDocument();
	});

	it('adds no status notice for an active membership', () => {
		render(MembershipCardModal, {
			props: { open: true, membership: membership(), onClose: vi.fn() }
		});
		expect(screen.queryByText(/Organizers will see it as/i)).not.toBeInTheDocument();
	});

	/**
	 * A door needs to read "banned" rather than find no card at all, so the QR is
	 * rendered for every status. The status notice above is what keeps that honest.
	 */
	it('still renders the QR for a banned membership', async () => {
		render(MembershipCardModal, {
			props: { open: true, membership: membership({ status: 'banned' }), onClose: vi.fn() }
		});
		await waitFor(() => expect(toDataURL).toHaveBeenCalledWith(QR_PAYLOAD, expect.anything()));
		expect(screen.getByRole('img', { name: 'Membership card QR code' })).toBeInTheDocument();
	});

	it('falls back to organization initials when there is no logo', () => {
		render(MembershipCardModal, {
			props: { open: true, membership: membership(), onClose: vi.fn() }
		});
		expect(screen.getByText('AC')).toBeInTheDocument();
	});

	it('tolerates a membership with no tier', () => {
		render(MembershipCardModal, {
			props: { open: true, membership: membership({ tier: null }), onClose: vi.fn() }
		});
		expect(screen.getByText('Acme Collective')).toBeInTheDocument();
	});
});
