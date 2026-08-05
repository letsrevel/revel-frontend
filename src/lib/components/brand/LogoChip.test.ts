import { render } from '@testing-library/svelte';
import { describe, it, expect } from 'vitest';
import LogoChip from './LogoChip.svelte';

describe('LogoChip', () => {
	it('renders NOTHING when the organization has no logo (sticker-chip rule)', () => {
		const { container } = render(LogoChip, { props: {} });
		expect(container.querySelector('img')).toBeNull();
		expect(container.textContent?.trim()).toBe('');
	});

	it('renders nothing when both logo fields are explicitly null', () => {
		const { container } = render(LogoChip, { props: { logo: null, logoThumbnail: null } });
		expect(container.querySelector('img')).toBeNull();
	});

	it("shows the organization's logo, cover-fitted inside the sticker frame", () => {
		const { container } = render(LogoChip, { props: { logo: '/media/logos/acme.png' } });
		const img = container.querySelector('img') as HTMLImageElement;
		expect(img).not.toBeNull();
		expect(img.getAttribute('src')).toContain('/media/logos/acme.png');
		expect(img.className).toContain('object-cover');
	});

	it('prefers the thumbnail rendition when both are present', () => {
		const { container } = render(LogoChip, {
			props: { logo: '/media/logos/full.png', logoThumbnail: '/media/logos/thumb.png' }
		});
		const img = container.querySelector('img') as HTMLImageElement;
		expect(img.getAttribute('src')).toContain('thumb.png');
	});

	it('is decorative: aria-hidden chip and an empty alt', () => {
		const { container } = render(LogoChip, { props: { logo: '/media/logos/acme.png' } });
		const chip = container.querySelector('div') as HTMLElement;
		expect(chip.getAttribute('aria-hidden')).toBe('true');
		expect(container.querySelector('img')?.getAttribute('alt')).toBe('');
	});

	it('clamps rotation to [-10, 10]', () => {
		const { container } = render(LogoChip, {
			props: { logo: '/media/logos/acme.png', rotate: 45 }
		});
		expect((container.querySelector('div') as HTMLElement).style.transform).toBe('rotate(10deg)');
	});
});
