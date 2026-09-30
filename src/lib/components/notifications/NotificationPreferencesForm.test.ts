import { render, screen, waitFor } from '@testing-library/svelte';
import { userEvent } from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient } from '@tanstack/svelte-query';
import NotificationPreferencesForm from './NotificationPreferencesForm.svelte';
import QueryClientTestWrapper from '$lib/test-utils/QueryClientTestWrapper.svelte';
import type { NotificationPreferenceSchema } from '$lib/api/generated/types.gen.js';

// Mock the API
vi.mock('$lib/api', () => ({
	notificationpreferenceUpdatePreferences: vi.fn(),
	notificationpreferenceUnsubscribe: vi.fn(),
	telegramGetLinkStatus: vi.fn().mockResolvedValue({ data: { connected: false } }),
	notificationpreferenceGetAvailableNotificationTypes: vi.fn().mockResolvedValue({ data: [] })
}));

// Mock svelte-sonner
vi.mock('svelte-sonner', () => ({
	toast: {
		success: vi.fn(),
		error: vi.fn()
	}
}));

describe('NotificationPreferencesForm', () => {
	let queryClient: QueryClient;
	const mockPreferences: NotificationPreferenceSchema = {
		silence_all_notifications: false,
		event_reminders_enabled: true,
		enabled_channels: ['in_app', 'email'],
		digest_frequency: 'daily',
		digest_send_time: '09:00',
		show_me_on_attendee_list: 'to_both'
	};

	beforeEach(() => {
		queryClient = new QueryClient({
			defaultOptions: {
				queries: { retry: false },
				mutations: { retry: false }
			}
		});
		vi.clearAllMocks();
	});

	function renderForm(props: Record<string, unknown>) {
		return render(QueryClientTestWrapper, {
			props: { client: queryClient, component: NotificationPreferencesForm, componentProps: props }
		});
	}

	it('renders all form sections', () => {
		renderForm({
			preferences: mockPreferences,
			authToken: 'test-token'
		});

		expect(screen.getByText('Master Controls')).toBeInTheDocument();
		expect(screen.getByText('Notification Channels')).toBeInTheDocument();
		expect(screen.getByText('Digest Settings')).toBeInTheDocument();
		expect(screen.getByText('Advanced Settings')).toBeInTheDocument();
	});

	it('displays current preferences correctly', () => {
		renderForm({
			preferences: mockPreferences,
			authToken: 'test-token'
		});

		// Check silence all is not checked
		const silenceAllCheckbox = screen.getByRole('checkbox', {
			name: /silence all notifications/i
		});
		expect(silenceAllCheckbox).not.toBeChecked();

		// Check event reminders is checked
		const eventRemindersCheckbox = screen.getByRole('checkbox', { name: /event reminders/i });
		expect(eventRemindersCheckbox).toBeChecked();

		// Check in-app channel is enabled
		const inAppCheckbox = screen.getByRole('checkbox', { name: /^in-app$/i });
		expect(inAppCheckbox).toBeChecked();

		// Check email channel is enabled
		const emailCheckbox = screen.getByRole('checkbox', { name: /^email$/i });
		expect(emailCheckbox).toBeChecked();
	});

	it('disables all controls when silence_all is enabled', async () => {
		const user = userEvent.setup();

		renderForm({
			preferences: mockPreferences,
			authToken: 'test-token'
		});

		const silenceAllCheckbox = screen.getByRole('checkbox', {
			name: /silence all notifications/i
		});

		// Enable silence all
		await user.click(silenceAllCheckbox);

		// Check that other controls are disabled
		const eventRemindersCheckbox = screen.getByRole('checkbox', { name: /event reminders/i });
		expect(eventRemindersCheckbox).toBeDisabled();

		const inAppCheckbox = screen.getByRole('checkbox', { name: /^in-app$/i });
		expect(inAppCheckbox).toBeDisabled();
	});

	it('shows time picker only for daily and weekly digest frequencies', async () => {
		const user = userEvent.setup();

		renderForm({
			preferences: { ...mockPreferences, digest_frequency: 'immediate' },
			authToken: 'test-token'
		});

		// Time picker should not be visible for immediate
		expect(screen.queryByLabelText('Send time')).not.toBeInTheDocument();

		// Change to daily (digest frequency is a radio group)
		const dailyOption = screen.getByRole('radio', { name: /^daily$/i });
		await user.click(dailyOption);

		// Time picker should now be visible
		await waitFor(() => {
			expect(screen.getByLabelText('Send time')).toBeInTheDocument();
		});
	});

	it('validates that at least one channel is selected', async () => {
		const user = userEvent.setup();

		renderForm({
			preferences: mockPreferences,
			authToken: 'test-token'
		});

		// Uncheck all channels
		const inAppCheckbox = screen.getByRole('checkbox', { name: /^in-app$/i });
		const emailCheckbox = screen.getByRole('checkbox', { name: /^email$/i });

		await user.click(inAppCheckbox);
		await user.click(emailCheckbox);

		// Try to save
		const saveButton = screen.getByRole('button', { name: /save changes/i });
		await user.click(saveButton);

		// Should show validation error
		await waitFor(() => {
			expect(
				screen.getByText(/please select at least one notification channel/i)
			).toBeInTheDocument();
		});
	});

	it('enables save button when changes are made', async () => {
		const user = userEvent.setup();

		renderForm({
			preferences: mockPreferences,
			authToken: 'test-token'
		});

		const saveButton = screen.getByRole('button', { name: /save changes/i });

		// Initially disabled (no changes)
		expect(saveButton).toBeDisabled();

		// Make a change
		const eventRemindersCheckbox = screen.getByRole('checkbox', { name: /event reminders/i });
		await user.click(eventRemindersCheckbox);

		// Save button should now be enabled
		await waitFor(() => {
			expect(saveButton).not.toBeDisabled();
		});
	});

	it('calls onSave callback on successful save', async () => {
		const mockOnSave = vi.fn();
		const user = userEvent.setup();

		const { notificationpreferenceUpdatePreferences } = await import('$lib/api');
		vi.mocked(notificationpreferenceUpdatePreferences).mockResolvedValue({
			data: { ...mockPreferences, event_reminders_enabled: false },
			error: undefined,
			response: {} as Response
		});

		renderForm({
			preferences: mockPreferences,
			onSave: mockOnSave,
			authToken: 'test-token'
		});

		// Make a change
		const eventRemindersCheckbox = screen.getByRole('checkbox', { name: /event reminders/i });
		await user.click(eventRemindersCheckbox);

		// Save
		const saveButton = screen.getByRole('button', { name: /save changes/i });
		await user.click(saveButton);

		// Wait for mutation to complete
		await waitFor(() => {
			// Settings mode: no unsubscribe token accompanies the result
			expect(mockOnSave).toHaveBeenCalledWith(
				expect.objectContaining({
					event_reminders_enabled: false
				}),
				undefined
			);
		});
	});

	it('resets changes when reset button is clicked', async () => {
		const user = userEvent.setup();

		renderForm({
			preferences: mockPreferences,
			authToken: 'test-token'
		});

		// Make a change
		const eventRemindersCheckbox = screen.getByRole('checkbox', { name: /event reminders/i });
		await user.click(eventRemindersCheckbox);

		// Checkbox should be unchecked
		expect(eventRemindersCheckbox).not.toBeChecked();

		// Click reset (labelled "Cancel")
		const resetButton = screen.getByRole('button', { name: /^cancel$/i });
		await user.click(resetButton);

		// Checkbox should be checked again (back to original state)
		await waitFor(() => {
			expect(eventRemindersCheckbox).toBeChecked();
		});
	});

	it('is keyboard accessible', async () => {
		const user = userEvent.setup();

		renderForm({
			preferences: mockPreferences,
			authToken: 'test-token'
		});

		// Tab through form elements
		await user.tab();
		expect(screen.getByRole('checkbox', { name: /silence all notifications/i })).toHaveFocus();

		await user.tab();
		expect(screen.getByRole('checkbox', { name: /event reminders/i })).toHaveFocus();

		// Test keyboard interaction with checkbox
		const eventRemindersCheckbox = screen.getByRole('checkbox', { name: /event reminders/i });
		await user.keyboard(' '); // Space to toggle
		expect(eventRemindersCheckbox).not.toBeChecked();

		await user.keyboard(' '); // Space to toggle back
		expect(eventRemindersCheckbox).toBeChecked();
	});

	it('handles disabled prop correctly', () => {
		renderForm({
			preferences: mockPreferences,
			disabled: true,
			authToken: 'test-token'
		});

		// All interactive elements should be disabled
		expect(screen.getByRole('checkbox', { name: /silence all notifications/i })).toBeDisabled();
		expect(screen.getByRole('checkbox', { name: /event reminders/i })).toBeDisabled();
		expect(screen.getByRole('button', { name: /save changes/i })).toBeDisabled();
	});

	it('accepts the API\'s "HH:MM:SS" digest time without marking the form invalid (#889)', () => {
		// GET /api/notification-preferences returns a Django time string with
		// seconds; the form must normalise it instead of failing validation.
		renderForm({
			preferences: { ...mockPreferences, digest_send_time: '09:00:00' },
			authToken: 'test-token'
		});

		expect(screen.getByLabelText('Send time')).toHaveValue('09:00');
		expect(screen.queryByText(/please enter a valid time/i)).not.toBeInTheDocument();
		// Untouched form: no changes detected, so Save is disabled without error
		expect(screen.getByRole('button', { name: /save changes/i })).toBeDisabled();
	});

	it('does not truncate malformed digest times — validation still rejects them', () => {
		// toHHMM only normalises well-formed "HH:MM[:SS]" values; a corrupt
		// preference must NOT be silently truncated into something submittable.
		renderForm({
			preferences: { ...mockPreferences, digest_send_time: '99:99:00' },
			authToken: 'test-token'
		});

		expect(screen.getByText(/please enter a valid time/i)).toBeInTheDocument();
	});

	it('does not re-send an unchanged digest time seeded with seconds (#889, #982)', async () => {
		const user = userEvent.setup();

		const { notificationpreferenceUpdatePreferences } = await import('$lib/api');
		vi.mocked(notificationpreferenceUpdatePreferences).mockResolvedValue({
			data: mockPreferences,
			error: undefined,
			response: {} as Response
		});

		renderForm({
			preferences: { ...mockPreferences, digest_send_time: '09:00:00' },
			authToken: 'test-token'
		});

		// "HH:MM:SS" normalises to the same "HH:MM" value, so it isn't a change
		await user.click(screen.getByRole('checkbox', { name: /event reminders/i }));
		await user.click(screen.getByRole('button', { name: /save changes/i }));

		await waitFor(() => {
			expect(notificationpreferenceUpdatePreferences).toHaveBeenCalledWith(
				expect.objectContaining({ body: { event_reminders_enabled: false } })
			);
		});
	});

	it('sends only the changed fields, never stale per-type settings (#982)', async () => {
		const user = userEvent.setup();

		const { notificationpreferenceUpdatePreferences } = await import('$lib/api');
		vi.mocked(notificationpreferenceUpdatePreferences).mockResolvedValue({
			data: mockPreferences,
			error: undefined,
			response: {} as Response
		});

		renderForm({
			preferences: {
				...mockPreferences,
				enabled_channels: ['in_app'],
				notification_type_settings: {
					ticket_created: { enabled: true, channels: ['in_app'] }
				}
			},
			authToken: 'test-token'
		});

		// Turn email back on
		await user.click(screen.getByRole('checkbox', { name: /^email$/i }));
		await user.click(screen.getByRole('button', { name: /save changes/i }));

		await waitFor(() => {
			expect(notificationpreferenceUpdatePreferences).toHaveBeenCalledWith(
				expect.objectContaining({ body: { enabled_channels: ['in_app', 'email'] } })
			);
		});
	});

	describe('saved baseline (#985)', () => {
		it('diffs the next save against what the server stored, not the initial prop', async () => {
			const user = userEvent.setup();
			const { notificationpreferenceUpdatePreferences } = await import('$lib/api');
			vi.mocked(notificationpreferenceUpdatePreferences).mockResolvedValue({
				data: { ...mockPreferences, enabled_channels: ['in_app'] },
				error: undefined,
				response: {} as Response
			});

			renderForm({ preferences: mockPreferences, authToken: 'test-token' });
			const email = screen.getByRole('checkbox', { name: /^email$/i });
			const save = screen.getByRole('button', { name: /save changes/i });

			await user.click(email); // email off
			await user.click(save);
			await waitFor(() => expect(notificationpreferenceUpdatePreferences).toHaveBeenCalledOnce());

			// Saved: nothing left to save, even though the prop still has email on
			await waitFor(() => expect(save).toBeDisabled());

			await user.click(email); // email back on: a change relative to the SAVED state
			await user.click(save);
			await waitFor(() =>
				expect(notificationpreferenceUpdatePreferences).toHaveBeenLastCalledWith(
					expect.objectContaining({ body: { enabled_channels: ['in_app', 'email'] } })
				)
			);
		});

		it('keeps edits made while a save is in flight', async () => {
			const user = userEvent.setup();
			const { notificationpreferenceUpdatePreferences } = await import('$lib/api');
			let settle: ((value: unknown) => void) | undefined;
			vi.mocked(notificationpreferenceUpdatePreferences).mockReturnValue(
				new Promise((resolve) => {
					settle = resolve;
				}) as never
			);

			renderForm({ preferences: mockPreferences, authToken: 'test-token' });
			const email = screen.getByRole('checkbox', { name: /^email$/i });
			const reminders = screen.getByRole('checkbox', { name: /event reminders/i });

			await user.click(email); // email off, then save
			await user.click(screen.getByRole('button', { name: /save changes/i }));
			await user.click(reminders); // edit while the request is pending

			settle?.({
				data: { ...mockPreferences, enabled_channels: ['in_app'] },
				error: undefined,
				response: {} as Response
			});

			await waitFor(() => expect(notificationpreferenceUpdatePreferences).toHaveBeenCalledOnce());
			await new Promise((r) => setTimeout(r, 0));
			expect(reminders).not.toBeChecked(); // the in-flight edit survived
			expect(email).not.toBeChecked();
			// ...and is still a pending change against the new baseline
			expect(await screen.findByRole('button', { name: /save changes/i })).toBeEnabled();
		});

		it('cancel returns to the last saved state', async () => {
			const user = userEvent.setup();
			renderForm({ preferences: mockPreferences, authToken: 'test-token' });
			const reminders = screen.getByRole('checkbox', { name: /event reminders/i });

			await user.click(reminders);
			expect(reminders).not.toBeChecked();
			await user.click(screen.getByRole('button', { name: /cancel/i }));
			expect(reminders).toBeChecked();
		});
	});

	describe('unsubscribe mode', () => {
		const unsubscribeDefaults: NotificationPreferenceSchema = {
			silence_all_notifications: false,
			event_reminders_enabled: true,
			enabled_channels: ['in_app'],
			digest_frequency: 'immediate',
			digest_send_time: '09:00',
			notification_type_settings: {},
			muted_organization_ids: []
		};

		it('submits only the global switches by default (#982)', async () => {
			const user = userEvent.setup();
			const { notificationpreferenceUnsubscribe } = await import('$lib/api');
			vi.mocked(notificationpreferenceUnsubscribe).mockResolvedValue({
				data: { message: 'ok' },
				error: undefined,
				response: {} as Response
			});

			renderForm({ preferences: unsubscribeDefaults, unsubscribeToken: 'tok' });
			await user.click(screen.getByRole('button', { name: /save changes/i }));

			await waitFor(() => {
				expect(notificationpreferenceUnsubscribe).toHaveBeenCalledWith({
					body: {
						token: 'tok',
						preferences: { silence_all_notifications: false, enabled_channels: ['in_app'] }
					}
				});
			});
		});

		it('leaves success feedback to the page (no toast)', async () => {
			const user = userEvent.setup();
			const onSave = vi.fn();
			const { notificationpreferenceUnsubscribe } = await import('$lib/api');
			const { toast } = await import('svelte-sonner');
			vi.mocked(notificationpreferenceUnsubscribe).mockResolvedValue({
				data: { message: 'ok' },
				error: undefined,
				response: {} as Response
			});

			renderForm({ preferences: unsubscribeDefaults, unsubscribeToken: 'tok', onSave });
			await user.click(screen.getByRole('button', { name: /save changes/i }));

			await waitFor(() => expect(onSave).toHaveBeenCalled());
			expect(toast.success).not.toHaveBeenCalled();
		});

		it('includes event reminders only when the user changes them', async () => {
			const user = userEvent.setup();
			const { notificationpreferenceUnsubscribe } = await import('$lib/api');
			vi.mocked(notificationpreferenceUnsubscribe).mockResolvedValue({
				data: { message: 'ok' },
				error: undefined,
				response: {} as Response
			});

			renderForm({ preferences: unsubscribeDefaults, unsubscribeToken: 'tok' });
			await user.click(screen.getByRole('checkbox', { name: /event reminders/i }));
			await user.click(screen.getByRole('button', { name: /save changes/i }));

			await waitFor(() => {
				expect(notificationpreferenceUnsubscribe).toHaveBeenCalledWith({
					body: {
						token: 'tok',
						preferences: {
							silence_all_notifications: false,
							enabled_channels: ['in_app'],
							event_reminders_enabled: false
						}
					}
				});
			});
		});

		it('hands a rejected link to onInvalidToken instead of toasting', async () => {
			const user = userEvent.setup();
			const onInvalidToken = vi.fn();
			const { notificationpreferenceUnsubscribe } = await import('$lib/api');
			const { toast } = await import('svelte-sonner');
			vi.mocked(notificationpreferenceUnsubscribe).mockResolvedValue({
				data: undefined,
				error: { detail: 'This unsubscribe link is no longer valid.' },
				response: { status: 400 } as Response
			} as never);

			renderForm({ preferences: unsubscribeDefaults, unsubscribeToken: 'tok', onInvalidToken });
			await user.click(screen.getByRole('button', { name: /save changes/i }));

			await waitFor(() => expect(onInvalidToken).toHaveBeenCalledOnce());
			expect(toast.error).not.toHaveBeenCalled();
		});

		it('still toasts other failures', async () => {
			const user = userEvent.setup();
			const onInvalidToken = vi.fn();
			const { notificationpreferenceUnsubscribe } = await import('$lib/api');
			const { toast } = await import('svelte-sonner');
			vi.mocked(notificationpreferenceUnsubscribe).mockResolvedValue({
				data: undefined,
				error: { detail: 'Boom' },
				response: { status: 500 } as Response
			} as never);

			renderForm({ preferences: unsubscribeDefaults, unsubscribeToken: 'tok', onInvalidToken });
			await user.click(screen.getByRole('button', { name: /save changes/i }));

			await waitFor(() => expect(toast.error).toHaveBeenCalled());
			expect(onInvalidToken).not.toHaveBeenCalled();
		});
	});

	it('handles null preferences gracefully', () => {
		renderForm({
			preferences: null,
			authToken: 'test-token'
		});

		// Should render with default values
		expect(screen.getByText('Master Controls')).toBeInTheDocument();
		expect(screen.getByRole('checkbox', { name: /silence all notifications/i })).not.toBeChecked();
	});
});
