import { render, screen, waitFor } from '@testing-library/svelte';
import { userEvent } from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient } from '@tanstack/svelte-query';
import ApplyDialog from './ApplyDialog.svelte';
import QueryClientTestWrapper from '$lib/test-utils/QueryClientTestWrapper.svelte';
import { memembershipapplicationsApply } from '$lib/api/generated/sdk.gen';
import { invalidateAll } from '$app/navigation';
import type {
	ApplyResponseSchema,
	MembershipApplicationSchema,
	MembershipEligibilitySchema
} from '$lib/api/generated/types.gen';

vi.mock('$lib/api/generated/sdk.gen', () => ({
	memembershipapplicationsApply: vi.fn()
}));

vi.mock('$lib/stores/auth.svelte', () => ({
	authStore: { accessToken: 'test-token' }
}));

vi.mock('$app/navigation', () => ({
	invalidateAll: vi.fn()
}));

function makeResult(
	application: Partial<MembershipApplicationSchema> = {},
	eligibility: Partial<MembershipEligibilitySchema> = {}
): ApplyResponseSchema {
	return {
		application: {
			organization_id: 'org-1',
			tier_id: null,
			plan_id: null,
			subscription_id: null,
			questionnaire_submission_id: null,
			status: 'pending',
			id: 'app-1',
			message: null,
			created_at: '2026-08-01T00:00:00Z',
			updated_at: '2026-08-01T00:00:00Z',
			...application
		},
		eligibility: {
			allowed: false,
			organization_id: 'org-1',
			tier_id: null,
			plan_id: null,
			reason: null,
			reason_code: null,
			next_step: null,
			questionnaire_id: null,
			application_id: 'app-1',
			retry_on: null,
			...eligibility
		}
	};
}

function mockApplySuccess(result: ApplyResponseSchema) {
	vi.mocked(memembershipapplicationsApply).mockResolvedValue({
		data: result,
		error: undefined,
		response: { ok: true } as unknown as Response
	} as unknown as Awaited<ReturnType<typeof memembershipapplicationsApply>>);
}

function mockApplyError(error: unknown) {
	vi.mocked(memembershipapplicationsApply).mockResolvedValue({
		data: undefined,
		error,
		response: { ok: false } as unknown as Response
	} as unknown as Awaited<ReturnType<typeof memembershipapplicationsApply>>);
}

describe('ApplyDialog', () => {
	let queryClient: QueryClient;

	beforeEach(() => {
		vi.clearAllMocks();
		queryClient = new QueryClient({
			defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
		});
	});

	/**
	 * bits-ui moves focus onto the dialog itself a beat after mount; keystrokes
	 * typed before that steal lands are dropped on the floor. Wait it out, then
	 * put the caret in the textarea.
	 */
	async function typeMessage(user: ReturnType<typeof userEvent.setup>, text: string) {
		await waitFor(() => expect(screen.getByRole('dialog')).toHaveFocus());
		const textarea = screen.getByLabelText(/message \(optional\)/i);
		await user.click(textarea);
		await user.type(textarea, text);
		return textarea;
	}

	function renderDialog(props: Record<string, unknown> = {}) {
		const onOpenChange = vi.fn();
		const result = render(QueryClientTestWrapper, {
			props: {
				client: queryClient,
				component: ApplyDialog,
				componentProps: {
					open: true,
					onOpenChange,
					organizationSlug: 'acme',
					organizationName: 'Acme',
					mode: 'join',
					...props
				}
			}
		});
		return { ...result, onOpenChange };
	}

	it('titles itself after the organization, per mode', () => {
		const { unmount } = renderDialog();
		expect(screen.getByRole('heading', { name: 'Join Acme' })).toBeInTheDocument();
		unmount();

		renderDialog({ mode: 'reapply' });
		expect(screen.getByRole('heading', { name: 'Re-apply to Acme' })).toBeInTheDocument();
	});

	it('describes the optional message field through its character counter', () => {
		renderDialog();

		const textarea = screen.getByLabelText(/message \(optional\)/i);
		expect(textarea).toHaveAttribute('maxlength', '500');
		const describedBy = textarea.getAttribute('aria-describedby');
		expect(describedBy).toBeTruthy();
		expect(document.getElementById(describedBy as string)).toHaveTextContent('0/500');
	});

	it('counts the characters typed into the message', async () => {
		const user = userEvent.setup();
		renderDialog();

		await typeMessage(user, 'hello');

		expect(screen.getByText('5/500')).toBeInTheDocument();
	});

	it('posts the trimmed message as notes', async () => {
		const user = userEvent.setup();
		mockApplySuccess(makeResult());
		renderDialog();

		await typeMessage(user, '  hello  ');
		await user.click(screen.getByRole('button', { name: /send application/i }));

		await waitFor(() => {
			expect(vi.mocked(memembershipapplicationsApply)).toHaveBeenCalledWith(
				expect.objectContaining({
					path: { slug: 'acme' },
					body: { notes: 'hello' }
				})
			);
		});
	});

	it('omits notes entirely when no message was written', async () => {
		const user = userEvent.setup();
		mockApplySuccess(makeResult());
		renderDialog();

		await user.click(screen.getByRole('button', { name: /send application/i }));

		await waitFor(() => {
			expect(vi.mocked(memembershipapplicationsApply)).toHaveBeenCalledWith(
				expect.objectContaining({ body: { notes: undefined } })
			);
		});
	});

	it('celebrates an instantly completed application and refreshes the page data', async () => {
		const user = userEvent.setup();
		const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
		mockApplySuccess(makeResult({ status: 'completed' }, { allowed: true }));
		renderDialog();

		await user.click(screen.getByRole('button', { name: /send application/i }));

		expect(await screen.findByText("You're in!")).toBeInTheDocument();
		expect(screen.getByText("You're now a member of Acme.")).toBeInTheDocument();
		expect(screen.queryByLabelText(/message \(optional\)/i)).toBeNull();

		await waitFor(() => {
			expect(vi.mocked(invalidateAll)).toHaveBeenCalled();
		});
		expect(invalidateSpy).toHaveBeenCalledWith({
			queryKey: ['org', 'acme', 'join-eligibility']
		});
	});

	it('explains what happens next for a pending application without reloading the page', async () => {
		const user = userEvent.setup();
		const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
		mockApplySuccess(
			makeResult(
				{ status: 'pending' },
				{ next_step: 'wait_for_approval', reason_code: 'requires_approval' }
			)
		);
		renderDialog();

		await user.click(screen.getByRole('button', { name: /send application/i }));

		expect(await screen.findByText('Application received')).toBeInTheDocument();
		// The wait copy, not the `requires_approval` policy line — this panel is
		// about THIS application, which has just been received.
		expect(
			screen.getByText(/your application is with the organization for review/i)
		).toBeInTheDocument();
		expect(
			screen.queryByText(/membership requests are approved by the organization/i)
		).not.toBeInTheDocument();
		expect(screen.getByRole('link', { name: /track your application/i })).toHaveAttribute(
			'href',
			'/account/memberships'
		);

		expect(invalidateSpy).toHaveBeenCalledWith({
			queryKey: ['org', 'acme', 'join-eligibility']
		});
		expect(vi.mocked(invalidateAll)).not.toHaveBeenCalled();
	});

	// A tier-less application clears every gate, so the verdict comes back
	// allowed with no next_step/reason_code/reason while the row stays PENDING
	// (staff assign the tier on approval). Reading that as a denial told a user
	// whose application had just been accepted that they "can't join right now".
	it('reads a tier-less pending verdict as awaiting approval, not as a denial', async () => {
		const user = userEvent.setup();
		mockApplySuccess(
			makeResult(
				{ status: 'pending' },
				{ allowed: true, next_step: null, reason_code: null, reason: null }
			)
		);
		renderDialog();

		await user.click(screen.getByRole('button', { name: /send application/i }));

		expect(await screen.findByText('Application received')).toBeInTheDocument();
		expect(
			screen.getByText(/your application is with the organization for review/i)
		).toBeInTheDocument();
		expect(screen.queryByText(/you can't join right now/i)).not.toBeInTheDocument();
	});

	it('surfaces a hard block from the backend in an alert and keeps the form usable', async () => {
		const user = userEvent.setup();
		mockApplyError({ message: 'You are blacklisted from this organization.' });
		renderDialog();

		await user.click(screen.getByRole('button', { name: /send application/i }));

		await waitFor(() => {
			expect(screen.getByRole('alert')).toHaveTextContent(
				'You are blacklisted from this organization.'
			);
		});
		expect(screen.getByLabelText(/message \(optional\)/i)).toBeInTheDocument();
		// The observer's pending→error flip lands a notify-batch after the
		// synchronously written error copy.
		await waitFor(() => {
			expect(screen.getByRole('button', { name: /send application/i })).toBeEnabled();
		});
	});

	it('falls back to generic error copy when the backend sends no message', async () => {
		const user = userEvent.setup();
		mockApplyError(undefined);
		renderDialog();

		await user.click(screen.getByRole('button', { name: /send application/i }));

		await waitFor(() => {
			expect(screen.getByRole('alert')).toHaveTextContent(/could not send your application/i);
		});
	});

	// The reset hangs off `open` becoming true, not false: resetting on close
	// blanked the outcome panel mid-way through the dialog's exit animation. That
	// flash is not observable here (jsdom runs no animations, so bits-ui drops the
	// content synchronously on close) — this pins the invariant the move must not
	// break: whichever edge resets, a reopened dialog starts from a blank form.
	it('starts blank when reopened after an outcome', async () => {
		const user = userEvent.setup();
		mockApplySuccess(makeResult({ status: 'pending' }, { next_step: 'wait_for_approval' }));
		const { rerender } = renderDialog();

		await typeMessage(user, 'let me in');
		await user.click(screen.getByRole('button', { name: /send application/i }));
		expect(await screen.findByText('Application received')).toBeInTheDocument();

		// `rerender` treats a top-level `props` key as its legacy call shape and
		// unwraps one level, so the wrapper's own props are nested under it. The
		// resulting deprecation warning is expected, not a signal.
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
		const childProps = {
			onOpenChange: vi.fn(),
			organizationSlug: 'acme',
			organizationName: 'Acme',
			mode: 'join'
		};
		await rerender({
			props: {
				client: queryClient,
				component: ApplyDialog,
				componentProps: { ...childProps, open: false }
			}
		});
		await waitFor(() => expect(screen.queryByText('Application received')).toBeNull());

		await rerender({
			props: {
				client: queryClient,
				component: ApplyDialog,
				componentProps: { ...childProps, open: true }
			}
		});
		warn.mockRestore();

		// The remounted content resubscribes to the mutation observer a tick after
		// it lands, so the submit button reads its stale in-flight label until then.
		await waitFor(() => {
			expect(screen.getByRole('button', { name: /send application/i })).toBeEnabled();
		});
		const textarea = screen.getByLabelText(/message \(optional\)/i);
		expect(textarea).toHaveValue('');
		expect(screen.getByText('0/500')).toBeInTheDocument();
		expect(screen.queryByText('Application received')).toBeNull();
	});

	it('asks the caller to close when Cancel is pressed', async () => {
		const user = userEvent.setup();
		const { onOpenChange } = renderDialog();

		await user.click(screen.getByRole('button', { name: /^cancel$/i }));

		expect(onOpenChange).toHaveBeenCalledWith(false);
	});

	describe('while the application is in flight', () => {
		/** Leaves the mutation pending forever so the guard stays engaged. */
		function renderPending() {
			// Definite assignment: the Promise executor runs synchronously.
			let release!: (value: unknown) => void;
			vi.mocked(memembershipapplicationsApply).mockReturnValue(
				new Promise((resolve) => {
					release = resolve;
				}) as unknown as ReturnType<typeof memembershipapplicationsApply>
			);
			const handles = renderDialog();
			return { ...handles, release };
		}

		async function submit(user: ReturnType<typeof userEvent.setup>) {
			await user.click(screen.getByRole('button', { name: /send application/i }));
			await waitFor(() => {
				expect(screen.getByRole('button', { name: /sending/i })).toBeDisabled();
			});
		}

		it('blocks every dismissal route until it settles', async () => {
			const user = userEvent.setup();
			const { onOpenChange, release } = renderPending();
			await submit(user);

			await user.keyboard('{Escape}');
			expect(onOpenChange).not.toHaveBeenCalled();
			expect(screen.queryByRole('button', { name: /close/i })).toBeNull();

			await user.click(screen.getByRole('button', { name: /^cancel$/i }));
			expect(onOpenChange).not.toHaveBeenCalled();

			release({
				data: undefined,
				error: { message: 'Nope.' },
				response: { ok: false }
			});
			await waitFor(() => {
				expect(screen.getByRole('alert')).toHaveTextContent('Nope.');
			});
			await waitFor(() => {
				expect(screen.getByRole('button', { name: /close/i })).toBeInTheDocument();
			});
		});
	});
});
