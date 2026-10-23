import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('$lib/api/generated/sdk.gen', () => ({
	organizationadmincoreUpdateBranding: vi.fn(),
	organizationadmincoreBrandThemePreview: vi.fn()
}));

import {
	organizationadmincoreUpdateBranding,
	organizationadmincoreBrandThemePreview
} from '$lib/api/generated/sdk.gen';
import { BrandColorsApiError, previewBrandTheme, saveBrandColors } from './brand-colors-api';

const detail422 = (items: unknown[]) => ({ detail: items });

describe('brand-colors-api (#1054)', () => {
	beforeEach(() => vi.clearAllMocks());

	it('saves the full branding body with explicit nulls on reset', async () => {
		const saved = { branding: { primary_color: null, accent_color: null }, brand_theme: null };
		vi.mocked(organizationadmincoreUpdateBranding).mockResolvedValue({ data: saved } as never);
		await expect(saveBrandColors('acme', null, null)).resolves.toEqual(saved);
		expect(organizationadmincoreUpdateBranding).toHaveBeenCalledWith({
			path: { slug: 'acme' },
			body: { primary_color: null, accent_color: null }
		});
	});

	it('maps 422 items to fields by the last loc segment, msg as-is', async () => {
		vi.mocked(organizationadmincoreUpdateBranding).mockResolvedValue({
			error: detail422([
				{ type: 'invalid_hex_color', loc: ['body', 'payload', 'accent_color'], msg: 'Nope' },
				{ type: 'invalid_hex_color', loc: ['body', 'payload', 'primary_color'], msg: 'Bad' }
			]),
			response: { status: 422 }
		} as never);
		const error = await saveBrandColors('acme', '#112233', 'x').catch((e: unknown) => e);
		expect(error).toBeInstanceOf(BrandColorsApiError);
		expect((error as BrandColorsApiError).fieldErrors).toEqual({ accent: 'Nope', primary: 'Bad' });
	});

	it('gives no field errors for other locs, extra_forbidden, non-array detail or non-422', async () => {
		const cases: Array<[unknown, number]> = [
			[detail422([{ type: 'x', loc: ['body', 'payload', 'other'], msg: 'm' }]), 422],
			[
				detail422([
					{ type: 'extra_forbidden', loc: ['body', 'payload', 'accent_color'], msg: 'm' }
				]),
				422
			],
			[{ detail: 'plain' }, 422],
			[detail422([{ type: 'x', loc: ['body', 'payload', 'accent_color'], msg: 'm' }]), 400]
		];
		for (const [error, status] of cases) {
			vi.mocked(organizationadmincoreUpdateBranding).mockResolvedValue({
				error,
				response: { status }
			} as never);
			const caught = await saveBrandColors('acme', null, null).catch((e: unknown) => e);
			expect((caught as BrandColorsApiError).fieldErrors).toEqual({});
		}
	});

	it('preview: skips the call without a primary and surfaces a 400 detail string', async () => {
		await expect(previewBrandTheme('acme', null, '#112233')).resolves.toBeNull();
		expect(organizationadmincoreBrandThemePreview).not.toHaveBeenCalled();

		vi.mocked(organizationadmincoreBrandThemePreview).mockResolvedValue({
			error: { detail: 'Bad color' },
			response: { status: 400 }
		} as never);
		const caught = await previewBrandTheme('acme', '#112233', null).catch((e: unknown) => e);
		expect((caught as BrandColorsApiError).detail).toBe('Bad color');
	});
});
