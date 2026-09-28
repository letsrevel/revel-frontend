import { render, screen } from '@testing-library/svelte';
import { describe, it, expect } from 'vitest';
import Alert from './alert.svelte';

describe('Alert', () => {
	it('is always a live alert region', () => {
		render(Alert, { props: { variant: 'warning' } });
		expect(screen.getByRole('alert')).toBeInTheDocument();
	});

	it('warning variant uses the highlight border token, never a raw hue', () => {
		render(Alert, { props: { variant: 'warning' } });
		const el = screen.getByRole('alert');
		expect(el.className).toContain('border-highlight');
		expect(el.className).not.toMatch(/amber|yellow|orange/);
	});
});
