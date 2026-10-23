import { render, screen, fireEvent, waitFor, act } from '@testing-library/svelte';
import { userEvent } from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { QueryClient } from '@tanstack/svelte-query';
import QueryClientTestWrapper from '$lib/test-utils/QueryClientTestWrapper.svelte';
import type { BrandTheme, OrganizationAdminDetailSchema } from '$lib/api/generated/types.gen';

vi.mock('$lib/api/client', () => ({ client: {} }));
vi.mock('$app/navigation', () => ({ invalidateAll: vi.fn().mockResolvedValue(undefined) }));
vi.mock('svelte-sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('./brand-colors-api', async (importOriginal) => ({
	...(await importOriginal<typeof import('./brand-colors-api')>()),
	previewBrandTheme: vi.fn(),
	saveBrandColors: vi.fn()
}));

import BrandColorsCard from './BrandColorsCard.svelte';
import { BrandColorsApiError, previewBrandTheme, saveBrandColors } from './brand-colors-api';
import { toast } from 'svelte-sonner';
import { invalidateAll } from '$app/navigation';

// Golden vectors from the backend contract: the server shifts yellow for contrast.
const YELLOW_THEME: BrandTheme = {
	light: {
		primary: '#707000',
		primary_foreground: '#FFFFFF',
		accent: '#009E00',
		accent_foreground: '#000000'
	},
	dark: {
		primary: '#FFFF00',
		primary_foreground: '#000000',
		accent: '#00FF00',
		accent_foreground: '#000000'
	}
};
const PURPLE_THEME: BrandTheme = {
	light: {
		primary: '#8C3CDD',
		primary_foreground: '#FFFFFF',
		accent: null,
		accent_foreground: null
	},
	dark: { primary: '#A667E5', primary_foreground: '#000000', accent: null, accent_foreground: null }
};

type Org = Pick<OrganizationAdminDetailSchema, 'slug' | 'branding'> &
	Partial<Pick<OrganizationAdminDetailSchema, 'brand_theme'>>;

function setup(organization: Org = { slug: 'acme', branding: {} }) {
	const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
	render(QueryClientTestWrapper, {
		props: {
			client: new QueryClient({ defaultOptions: { queries: { retry: false } } }),
			component: BrandColorsCard,
			componentProps: { organization }
		}
	});
	return user;
}

const primaryText = () => screen.getByLabelText('Primary color') as HTMLInputElement;
const primaryPicker = () => screen.getByLabelText('Primary color picker') as HTMLInputElement;
const saveButton = () => screen.getByRole('button', { name: 'Save colors' });

async function flushDebounce() {
	await act(async () => {
		await vi.advanceTimersByTimeAsync(300);
	});
}

describe('BrandColorsCard (#1054)', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.clearAllMocks();
		vi.mocked(previewBrandTheme).mockResolvedValue(PURPLE_THEME);
		vi.mocked(saveBrandColors).mockResolvedValue({ branding: {}, brand_theme: null });
	});
	afterEach(() => {
		vi.useRealTimers();
	});

	it('keeps the hex input and the color picker in sync', async () => {
		const user = setup();
		await user.type(primaryText(), '#112233');
		expect(primaryPicker().value).toBe('#112233');

		await fireEvent.input(primaryPicker(), { target: { value: '#aabbcc' } });
		expect(primaryText().value).toBe('#AABBCC');
	});

	it('accepts a hex without the leading #', async () => {
		const user = setup();
		await user.type(primaryText(), 'aabbcc');
		expect(primaryPicker().value).toBe('#aabbcc');
		expect(saveButton()).toHaveAttribute('aria-disabled', 'false');
	});

	it('shows an error and disables Save for an invalid hex', async () => {
		const user = setup();
		await user.type(primaryText(), 'zzz');
		await user.tab();
		expect(await screen.findByRole('alert')).toHaveTextContent(/#RRGGBB/);
		expect(saveButton()).toHaveAttribute('aria-disabled', 'true');
	});

	it('requires a primary before an accent', async () => {
		const user = setup();
		await user.type(screen.getByLabelText('Accent color (optional)'), '#112233');
		expect(screen.getByRole('alert')).toHaveTextContent(/primary color first/i);
		expect(saveButton()).toHaveAttribute('aria-disabled', 'true');
	});

	it('fires one debounced preview call after rapid picker changes', async () => {
		setup();
		await fireEvent.input(primaryPicker(), { target: { value: '#111111' } });
		await fireEvent.input(primaryPicker(), { target: { value: '#222222' } });
		await fireEvent.input(primaryPicker(), { target: { value: '#333333' } });
		expect(previewBrandTheme).not.toHaveBeenCalled();

		await flushDebounce();
		expect(previewBrandTheme).toHaveBeenCalledTimes(1);
		expect(previewBrandTheme).toHaveBeenCalledWith(
			'acme',
			'#333333',
			null,
			expect.any(AbortSignal)
		);
	});

	it('keeps the last good theme on screen while a request is pending', async () => {
		let resolve: ((t: BrandTheme) => void) | undefined;
		vi.mocked(previewBrandTheme).mockReturnValue(
			new Promise<BrandTheme | null>((r) => (resolve = r))
		);
		setup({
			slug: 'acme',
			branding: { primary_color: '#FFFF00', accent_color: '#00FF00' },
			brand_theme: YELLOW_THEME
		});
		const light = screen.getByTestId('brand-swatches-light');
		expect(light).toHaveTextContent('#707000');

		await fireEvent.input(primaryPicker(), { target: { value: '#8c3cdd' } });
		await flushDebounce();
		expect(screen.getByText('Updating preview...')).toBeInTheDocument();
		expect(screen.getByTestId('brand-swatches-light')).toHaveTextContent('#707000');

		resolve?.(PURPLE_THEME);
		await waitFor(() =>
			expect(screen.getByTestId('brand-swatches-dark')).toHaveTextContent('#A667E5')
		);
		expect(screen.queryByText('Updating preview...')).not.toBeInTheDocument();
	});

	it('says in text when the server adjusted a color, and when it did not', () => {
		setup({
			slug: 'acme',
			branding: { primary_color: '#FFFF00', accent_color: '#00FF00' },
			brand_theme: YELLOW_THEME
		});
		const light = screen.getByTestId('brand-swatches-light');
		expect(light).toHaveTextContent('Adjusted for readability in light mode');
		const dark = screen.getByTestId('brand-swatches-dark');
		expect(dark).not.toHaveTextContent('Adjusted for readability');
		expect(dark).toHaveTextContent('Used as entered');
	});

	it('shows a preview 400 detail as one polite message and keeps the old theme', async () => {
		vi.mocked(previewBrandTheme).mockRejectedValue(
			new BrandColorsApiError('x', 'Primary color is not a valid hex color.', 400)
		);
		setup({
			slug: 'acme',
			branding: { primary_color: '#8C3CDD' },
			brand_theme: PURPLE_THEME
		});
		await fireEvent.input(primaryPicker(), { target: { value: '#123456' } });
		await flushDebounce();
		const status = await screen.findByRole('status');
		expect(status).toHaveTextContent('Primary color is not a valid hex color.');
		expect(status).toHaveAttribute('aria-live', 'polite');
		expect(screen.queryByRole('alert')).not.toBeInTheDocument();
		expect(screen.getByTestId('brand-swatches-dark')).toHaveTextContent('#A667E5');
	});

	it('saves both colors and refreshes page data', async () => {
		const user = setup();
		await user.type(primaryText(), '#112233');
		await flushDebounce();
		await user.click(saveButton());
		await waitFor(() => expect(saveBrandColors).toHaveBeenCalledWith('acme', '#112233', null));
		await waitFor(() => expect(invalidateAll).toHaveBeenCalled());
		expect(toast.success).toHaveBeenCalledWith('Brand colors saved.');
	});

	it('maps save-time field errors next to the offending field', async () => {
		vi.mocked(saveBrandColors).mockRejectedValue(
			new BrandColorsApiError('x', null, 422, { accent: 'Accent is not a valid hex color.' })
		);
		const user = setup();
		await user.type(primaryText(), '#112233');
		await user.type(screen.getByLabelText('Accent color (optional)'), '#445566');
		await flushDebounce();
		await user.click(saveButton());
		const alert = await screen.findByRole('alert');
		expect(alert).toHaveTextContent('Accent is not a valid hex color.');
		expect(screen.getByLabelText('Accent color (optional)')).toHaveAttribute(
			'aria-describedby',
			expect.stringContaining('brand-accent-error')
		);
	});

	it('reset sends nulls for both colors', async () => {
		const user = setup({
			slug: 'acme',
			branding: { primary_color: '#8C3CDD', accent_color: '#E6332A' },
			brand_theme: PURPLE_THEME
		});
		await user.click(screen.getByRole('button', { name: 'Reset to Revel defaults' }));
		await waitFor(() => expect(saveBrandColors).toHaveBeenCalledWith('acme', null, null));
		expect(primaryText().value).toBe('');
	});
});
