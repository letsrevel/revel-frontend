import { render } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import OrgBrandStyle from './OrgBrandStyle.svelte';
import type { BrandThemeInput } from '$lib/utils/brand-theme';

const theme: BrandThemeInput = {
	light: { primary: '#8C3CDD', primary_foreground: '#FFFFFF' },
	dark: {
		primary: '#AB82DB',
		primary_foreground: '#000000',
		accent: '#F9B233',
		accent_foreground: '#000000'
	}
};

const brandStyle = (): HTMLStyleElement | null =>
	document.head.querySelector<HTMLStyleElement>('style[data-org-brand]');

afterEach(() => {
	document.head.querySelectorAll('style[data-org-brand]').forEach((el) => el.remove());
});

describe('OrgBrandStyle', () => {
	it('renders a style tag with the token overrides in <head>', () => {
		render(OrgBrandStyle, { props: { theme } });
		const css = brandStyle()?.textContent ?? '';
		expect(css).toContain(':root:not(.dark){');
		expect(css).toContain(':root.dark{');
		expect(css).toContain('--primary:');
		expect(css).toContain('--ring:');
		expect(css).toContain('--accent:');
	});

	it('renders nothing when theme is null', () => {
		render(OrgBrandStyle, { props: { theme: null } });
		expect(brandStyle()).toBeNull();
	});

	it('removes the style on unmount', () => {
		const { unmount } = render(OrgBrandStyle, { props: { theme } });
		expect(brandStyle()).not.toBeNull();
		unmount();
		expect(brandStyle()).toBeNull();
	});

	it('swaps tokens across theme A -> B -> null on one instance (client-side navigation)', async () => {
		const themeA: BrandThemeInput = {
			light: { primary: '#FF0000', primary_foreground: '#FFFFFF' },
			dark: { primary: '#FF0000', primary_foreground: '#FFFFFF' }
		};
		const themeB: BrandThemeInput = {
			light: { primary: '#0000FF', primary_foreground: '#FFFFFF' },
			dark: { primary: '#0000FF', primary_foreground: '#FFFFFF' }
		};
		const tokensA = '--primary:0 100% 50%';
		const tokensB = '--primary:240 100% 50%';
		const styles = (): NodeListOf<HTMLStyleElement> =>
			document.head.querySelectorAll<HTMLStyleElement>('style[data-org-brand]');

		const { rerender } = render(OrgBrandStyle, { props: { theme: themeA } });
		expect(styles()).toHaveLength(1);
		expect(styles()[0].textContent).toContain(tokensA);

		await rerender({ theme: themeB });
		expect(styles()).toHaveLength(1);
		expect(styles()[0].textContent).toContain(tokensB);
		expect(styles()[0].textContent).not.toContain(tokensA);

		await rerender({ theme: null });
		expect(styles()).toHaveLength(0);
	});
});
