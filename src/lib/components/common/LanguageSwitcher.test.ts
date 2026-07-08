import { render, screen } from '@testing-library/svelte';
import { userEvent } from '@testing-library/user-event';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import LanguageSwitcher from './LanguageSwitcher.svelte';

// Paraglide's setLocale skips its page reload when getLocale() already
// resolves to the target locale (cookie strategy reads document.cookie
// fresh). These tests pin the contract that the component must NOT write
// the canonical PARAGLIDE_LOCALE cookie before calling setLocale — doing
// so cancels the reload and the UI silently stays in the old language.
const { setLocaleSpy, cookieWhenSetLocaleCalled } = vi.hoisted(() => {
	const state = { value: null as string | null };
	return {
		cookieWhenSetLocaleCalled: state,
		setLocaleSpy: vi.fn(() => {
			state.value = document.cookie;
		})
	};
});

vi.mock('$lib/paraglide/runtime.js', async (importOriginal) => {
	const actual = await importOriginal<typeof import('$lib/paraglide/runtime.js')>();
	return {
		...actual,
		getLocale: () => 'en',
		setLocale: setLocaleSpy
	};
});

function clearCookies() {
	for (const cookie of document.cookie.split(';')) {
		const name = cookie.split('=')[0]?.trim();
		if (name) {
			document.cookie = `${name}=; path=/; max-age=0`;
		}
	}
}

describe('LanguageSwitcher', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		cookieWhenSetLocaleCalled.value = null;
		clearCookies();
	});

	async function openAndPick(language: string) {
		const user = userEvent.setup();
		render(LanguageSwitcher);
		await user.click(screen.getByRole('button', { expanded: false }));
		await user.click(screen.getByRole('menuitem', { name: new RegExp(language, 'i') }));
	}

	it('calls setLocale with the picked language on non-SEO pages', async () => {
		await openAndPick('Deutsch');
		expect(setLocaleSpy).toHaveBeenCalledWith('de');
	});

	it('writes the legacy user_language cookie for the backend detector', async () => {
		await openAndPick('Deutsch');
		expect(document.cookie).toContain('user_language=de');
	});

	it('does not pre-write the canonical paraglide cookie before setLocale (would cancel the reload)', async () => {
		await openAndPick('Deutsch');
		expect(setLocaleSpy).toHaveBeenCalledWith('de');
		expect(cookieWhenSetLocaleCalled.value).not.toContain('PARAGLIDE_LOCALE=de');
	});
});
