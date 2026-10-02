import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('$lib/api/generated/sdk.gen', () => ({
	organizationCreateOrganization: vi.fn()
}));

import { organizationCreateOrganization } from '$lib/api/generated/sdk.gen';
import { actions, load } from './+page.server';

const mockedCreate = vi.mocked(organizationCreateOrganization);

function actionArgs(search: string, user: object | null = { id: 'u1' }) {
	const formData = new FormData();
	formData.set('name', 'Acme Collective');
	formData.set('contact_email', 'hello@acme.example');
	// The real form always posts these, empty when untouched.
	formData.set('city_id', '');
	formData.set('address', '');
	formData.set('description', '');
	const url = new URL(`http://localhost:5173/create-org${search}`);
	return {
		request: new Request(url, { method: 'POST', body: formData }),
		locals: { user },
		cookies: { get: vi.fn().mockReturnValue('token') },
		url
	} as unknown as Parameters<typeof actions.default>[0];
}

/** Run `fn` and return the thrown redirect. */
async function thrownRedirect(fn: () => unknown): Promise<{ status: number; location: string }> {
	try {
		await fn();
	} catch (err) {
		const redirect = err as { status?: number; location?: string };
		if (typeof redirect.status === 'number' && typeof redirect.location === 'string') {
			return { status: redirect.status, location: redirect.location };
		}
		throw err;
	}
	throw new Error('did not redirect');
}

beforeEach(() => {
	mockedCreate.mockReset();
	mockedCreate.mockResolvedValue({
		data: { slug: 'acme-collective' },
		error: undefined,
		response: { ok: true, status: 201 }
	} as never);
});

describe('create-org attribution (#1002)', () => {
	it('sends the sanitised utm tags from the page URL as attribution', async () => {
		await thrownRedirect(() =>
			actions.default(
				actionArgs(
					'?utm_source=revel&utm_medium=landing&utm_campaign=home&utm_content=hero&utm_term=x&other=1'
				)
			)
		);

		expect(mockedCreate).toHaveBeenCalledWith(
			expect.objectContaining({
				body: expect.objectContaining({
					attribution: {
						utm_source: 'revel',
						utm_medium: 'landing',
						utm_campaign: 'home',
						utm_content: 'hero'
					}
				})
			})
		);
	});

	it('drops malformed tags and keeps the valid ones', async () => {
		await thrownRedirect(() =>
			actions.default(actionArgs('?utm_source=news%20letter&utm_campaign=spring'))
		);

		const body = mockedCreate.mock.calls[0]?.[0]?.body as Record<string, unknown>;
		expect(body.attribution).toEqual({ utm_campaign: 'spring' });
	});

	it('omits attribution when the URL carries no tags', async () => {
		await thrownRedirect(() => actions.default(actionArgs('')));

		const body = mockedCreate.mock.calls[0]?.[0]?.body as Record<string, unknown>;
		expect(body).not.toHaveProperty('attribution');
	});

	it('keeps the tags in returnUrl when the action bounces a guest to login', async () => {
		const search = '?utm_source=revel&utm_campaign=home';
		const redirect = await thrownRedirect(() => actions.default(actionArgs(search, null)));

		expect(redirect).toEqual({
			status: 303,
			location: `/login?returnUrl=${encodeURIComponent(`/create-org${search}`)}`
		});
		expect(mockedCreate).not.toHaveBeenCalled();
	});

	it('keeps the tags in returnUrl when load bounces a guest to login', async () => {
		const search = '?utm_source=revel&utm_campaign=home';
		const redirect = await thrownRedirect(() =>
			load({
				locals: { user: null },
				parent: vi.fn(),
				url: new URL(`http://localhost:5173/create-org${search}`)
			} as unknown as Parameters<typeof load>[0])
		);

		expect(redirect).toEqual({
			status: 303,
			location: `/login?returnUrl=${encodeURIComponent(`/create-org${search}`)}`
		});
	});
});
