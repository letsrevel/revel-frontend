import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const order: string[] = [];
let releaseSettle: () => void = () => undefined;
vi.mock('$lib/stores/auth.svelte', () => ({
	authStore: {
		waitForAuthSettled: vi.fn(() => {
			order.push('settle-start');
			return new Promise<void>((r) => {
				releaseSettle = () => {
					order.push('settled');
					r();
				};
			});
		})
	}
}));

import { postLogout } from './logout';

describe('postLogout', () => {
	let submit: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		order.length = 0;
		document.body.innerHTML = '';
		submit = vi.spyOn(HTMLFormElement.prototype, 'submit').mockImplementation(() => {
			order.push('submit');
		});
	});
	afterEach(() => submit.mockRestore());

	it('settles first, then runs onBeforeSubmit, then submits a POST form on body', async () => {
		const p = postLogout('/oauth/authorize?x=1', () => order.push('before'));
		await Promise.resolve();
		expect(submit).not.toHaveBeenCalled();
		expect(document.body.querySelector('form')).toBeNull();

		releaseSettle();
		await p;

		expect(order).toEqual(['settle-start', 'settled', 'before', 'submit']);
		const form = document.body.querySelector('form') as HTMLFormElement;
		expect(form.parentElement).toBe(document.body);
		expect(form).toHaveAttribute('method', 'POST');
		expect(form).toHaveAttribute('action', '/logout');
		expect(form.querySelector('input[name="returnUrl"]')).toHaveValue('/oauth/authorize?x=1');
	});

	it('defaults returnUrl to empty', async () => {
		const p = postLogout();
		releaseSettle();
		await p;
		expect(document.body.querySelector('input[name="returnUrl"]')).toHaveValue('');
		expect(submit).toHaveBeenCalledTimes(1);
	});
});
