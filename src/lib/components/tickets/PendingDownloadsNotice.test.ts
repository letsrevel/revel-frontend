import { render, screen } from '@testing-library/svelte';
import { describe, it, expect } from 'vitest';
import PendingDownloadsNotice from './PendingDownloadsNotice.svelte';

describe('PendingDownloadsNotice', () => {
	it('renders the pending-payment label as a note', () => {
		render(PendingDownloadsNotice);
		const note = screen.getByRole('note');
		expect(note.textContent).toContain('Pending payment confirmation');
	});
});
