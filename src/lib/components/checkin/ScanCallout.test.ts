import { render, screen } from '@testing-library/svelte';
import { describe, it, expect } from 'vitest';
import ScanCallout from './ScanCallout.svelte';
import { scanNoteFrom } from './scan-note';

describe('ScanCallout', () => {
	it('renders the title and markdown body', () => {
		render(ScanCallout, { props: { title: 'Staff note', body: 'Needs **step-free** access' } });
		const callout = screen.getByRole('complementary', { name: 'Staff note' });
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

	it('sanitizes script content', () => {
		render(ScanCallout, {
			props: { title: 'Staff note', body: 'hi <script>window.__x = 1</script>' }
		});
		expect(screen.getByTestId('scan-callout').querySelector('script')).toBeNull();
	});
});

describe('scanNoteFrom', () => {
	it('returns null without a note', () => {
		expect(scanNoteFrom({ user: { first_name: 'A' }, private_note: null } as never)).toBeNull();
	});

	it('names the person and carries the body', () => {
		const result = scanNoteFrom({
			user: { first_name: 'Ada', last_name: 'L' },
			private_note: 'VIP'
		} as never);
		expect(result).toEqual({ name: 'Ada L', body: 'VIP' });
	});
});
