import { render, screen, fireEvent } from '@testing-library/svelte';
import { describe, it, expect } from 'vitest';
import AppLogo from './AppLogo.svelte';

describe('AppLogo', () => {
	it('renders a decorative image when a logo URL is given', () => {
		const { container } = render(AppLogo, {
			props: { name: 'Acme', logoUrl: 'https://api.example/logo.png' }
		});
		const img = container.querySelector('img') as HTMLImageElement;
		expect(img).not.toBeNull();
		expect(img.getAttribute('alt')).toBe('');
		expect(img.src).toBe('https://api.example/logo.png');
		expect(screen.queryByText('A')).toBeNull();
	});

	it('renders the initial chip when there is no logo', () => {
		const { container } = render(AppLogo, { props: { name: 'acme tool', logoUrl: null } });
		expect(container.querySelector('img')).toBeNull();
		const chip = screen.getByText('A');
		expect(chip.getAttribute('aria-hidden')).toBe('true');
	});

	it('falls back to the chip when the image fails to load', async () => {
		const { container } = render(AppLogo, {
			props: { name: 'Acme', logoUrl: 'https://api.example/gone.png' }
		});
		await fireEvent.error(container.querySelector('img') as HTMLImageElement);
		expect(container.querySelector('img')).toBeNull();
		expect(screen.getByText('A')).toBeInTheDocument();
	});

	it('uses ? for an empty name', () => {
		render(AppLogo, { props: { name: '   ', logoUrl: null } });
		expect(screen.getByText('?')).toBeInTheDocument();
	});

	it('retries a new logo URL after an earlier one failed', async () => {
		const { container, rerender } = render(AppLogo, {
			props: { name: 'Acme', logoUrl: 'https://api.example/expired.png' }
		});
		await fireEvent.error(container.querySelector('img') as HTMLImageElement);
		expect(container.querySelector('img')).toBeNull();

		await rerender({ name: 'Acme', logoUrl: 'https://api.example/fresh.png' });
		const img = container.querySelector('img') as HTMLImageElement;
		expect(img).not.toBeNull();
		expect(img.src).toBe('https://api.example/fresh.png');
	});
});
