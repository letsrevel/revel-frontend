import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import MemberVerificationCard from './MemberVerificationCard.svelte';
import type { MemberVerificationSchema } from '$lib/api/generated/types.gen';

function member(overrides: Partial<MemberVerificationSchema> = {}): MemberVerificationSchema {
	return {
		member_id: '3f1b8b9a-1c2d-4e5f-8a9b-0c1d2e3f4a5b',
		status: 'active',
		member_since: '2025-03-14T10:00:00Z',
		tier: { id: 'e0c1f2a3-4b5c-6d7e-8f90-1a2b3c4d5e6f', name: 'Founding Member' },
		user: {
			preferred_name: 'Bella Distefano',
			pronouns: 'they/them',
			first_name: 'Bella',
			last_name: 'Distefano',
			email: 'bella@example.com',
			display_name: 'Bella Distefano',
			bio: '',
			profile_picture_thumbnail_url: '/media/profiles/bella-thumb.png',
			profile_picture_url: '/media/profiles/bella.png',
			profile_picture_preview_url: null
		},
		...overrides
	};
}

describe('MemberVerificationCard', () => {
	it('shows the member name, which is what door staff compare against the face', () => {
		render(MemberVerificationCard, { props: { member: member() } });
		expect(screen.getByText('Bella Distefano')).toBeInTheDocument();
	});

	it('shows pronouns when the member has set them', () => {
		render(MemberVerificationCard, { props: { member: member() } });
		expect(screen.getByText('they/them')).toBeInTheDocument();
	});

	it('renders the tier name', () => {
		render(MemberVerificationCard, { props: { member: member() } });
		expect(screen.getByText('Founding Member')).toBeInTheDocument();
	});

	// Identity, not decoration: the photo is the anti-impersonation measure, so it
	// must be a real <img> with the member's own thumbnail behind it.
	it('renders the profile photo from the thumbnail url', () => {
		render(MemberVerificationCard, { props: { member: member() } });
		const photo = screen.getByRole('img', { name: /bella distefano/i });
		expect(photo).toHaveAttribute('src', expect.stringContaining('bella-thumb.png'));
	});

	it('falls back to initials when the member has no photo', () => {
		render(MemberVerificationCard, {
			props: {
				member: member({
					user: { ...member().user, profile_picture_thumbnail_url: null, profile_picture_url: null }
				})
			}
		});
		expect(screen.queryByRole('img')).not.toBeInTheDocument();
		expect(screen.getByText('BD')).toBeInTheDocument();
	});

	// The whole point of the endpoint: it reports every status rather than 404ing,
	// so a door reads "banned" instead of a lookup failure.
	it.each([
		['active', /active/i],
		['paused', /paused/i],
		['cancelled', /cancelled/i],
		['banned', /banned/i]
	] as const)('renders the %s status as a badge', (status, label) => {
		render(MemberVerificationCard, { props: { member: member({ status }) } });
		expect(screen.getByTestId('status-badge')).toHaveTextContent(label);
	});

	// A non-active status must not be a quiet pill next to a smiling photo.
	it.each(['paused', 'cancelled', 'banned'] as const)(
		'surfaces an explicit warning line for %s',
		(status) => {
			render(MemberVerificationCard, { props: { member: member({ status }) } });
			expect(screen.getByRole('alert')).toBeInTheDocument();
		}
	);

	it('shows no warning line for an active member', () => {
		render(MemberVerificationCard, { props: { member: member() } });
		expect(screen.queryByRole('alert')).not.toBeInTheDocument();
	});

	it('renders member-since with a textual month, never an ambiguous numeric one', () => {
		render(MemberVerificationCard, { props: { member: member() } });
		// 2025-03-14 must not render as "14/03/2025" or "03/14/2025".
		expect(screen.queryByText(/\d{1,2}\/\d{1,2}\/\d{4}/)).not.toBeInTheDocument();
		expect(screen.getByText(/Mar/i)).toBeInTheDocument();
	});

	it('tolerates a member with no tier', () => {
		render(MemberVerificationCard, { props: { member: member({ tier: null }) } });
		expect(screen.getByText('Bella Distefano')).toBeInTheDocument();
	});
});
