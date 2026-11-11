import { render, screen } from '@testing-library/svelte';
import { describe, it, expect } from 'vitest';
import ScanCallout from './ScanCallout.svelte';
import { checkInMembershipLine, scanNoteFrom } from './scan-note';

describe('ScanCallout', () => {
	it('renders the title and markdown body', () => {
		render(ScanCallout, { props: { title: 'Staff note', body: 'Needs **step-free** access' } });
		const callout = screen.getByRole('note', { name: 'Staff note' });
		expect(callout).toHaveTextContent('Staff note');
		expect(callout).toHaveTextContent('Needs step-free access');
		expect(callout.querySelector('strong')).toHaveTextContent('step-free');
	});

	it('renders nothing when the body is null', () => {
		render(ScanCallout, { props: { title: 'Staff note', body: null } });
		expect(screen.queryByTestId('scan-callout')).not.toBeInTheDocument();
	});

	it('renders nothing for a blank body', () => {
		render(ScanCallout, { props: { title: 'Staff note', body: '   ' } });
		expect(screen.queryByTestId('scan-callout')).not.toBeInTheDocument();
	});

	it('renders a plain body literally, in a paragraph, without markdown', () => {
		render(ScanCallout, {
			props: { title: 'Membership', body: 'Member: **VIP** _club_', plain: true }
		});
		const callout = screen.getByTestId('scan-callout');
		expect(callout).toHaveTextContent('Member: **VIP** _club_');
		expect(callout.querySelector('strong')).toBeNull();
		expect(callout.querySelector('em')).toBeNull();
	});

	it('sanitizes script content', () => {
		render(ScanCallout, {
			props: { title: 'Staff note', body: 'hi <script>window.__x = 1</script>' }
		});
		expect(screen.getByTestId('scan-callout').querySelector('script')).toBeNull();
	});
});

describe('scanNoteFrom', () => {
	it('returns null without a note or membership', () => {
		expect(scanNoteFrom({ user: { first_name: 'A' }, private_note: null } as never)).toBeNull();
	});

	it('uses the localized fallback when the person has no name', () => {
		const result = scanNoteFrom({ user: {}, private_note: ' VIP ' } as never);
		expect(result).toEqual({ name: 'Unknown member', body: 'VIP', membership: null });
	});

	it('names the person and carries the body', () => {
		const result = scanNoteFrom({
			user: { first_name: 'Ada', last_name: 'L' },
			private_note: 'VIP'
		} as never);
		expect(result).toEqual({ name: 'Ada L', body: 'VIP', membership: null });
	});

	it('returns null for a membership without a note (no blocking dialog)', () => {
		const result = scanNoteFrom({
			user: { first_name: 'Ada', last_name: 'L' },
			private_note: null,
			membership: { kind: 'standard', tier_name: 'Gold', valid_until: null }
		} as never);
		expect(result).toBeNull();
	});

	it('carries the membership alongside a note', () => {
		const result = scanNoteFrom({
			user: { first_name: 'Ada', last_name: 'L' },
			private_note: 'VIP',
			membership: { kind: 'standard', tier_name: 'Gold', valid_until: null }
		} as never);
		expect(result?.body).toBe('VIP');
		expect(result?.membership?.body).toBe('Member: Gold');
	});

	it('returns null when the note was already previewed, even with a membership', () => {
		const result = scanNoteFrom(
			{
				user: { first_name: 'Ada' },
				private_note: ' Needs step-free ',
				membership: { kind: 'standard', tier_name: 'Gold' }
			} as never,
			{ previewedNote: 'Needs step-free' }
		);
		expect(result).toBeNull();
	});

	it('returns null when the only content was already previewed', () => {
		expect(
			scanNoteFrom({ user: { first_name: 'Ada' }, private_note: 'VIP' } as never, {
				previewedNote: 'VIP'
			})
		).toBeNull();
	});

	it('shows a note that differs from the previewed one', () => {
		const result = scanNoteFrom({ user: { first_name: 'Ada' }, private_note: 'Updated' } as never, {
			previewedNote: 'VIP'
		});
		expect(result?.body).toBe('Updated');
	});
});

describe('checkInMembershipLine', () => {
	it('is the plain membership text, or null without a membership', () => {
		expect(
			checkInMembershipLine({ membership: { kind: 'standard', tier_name: 'Gold' } } as never)
		).toBe('Member: Gold');
		expect(checkInMembershipLine({ membership: null } as never)).toBeNull();
	});
});
