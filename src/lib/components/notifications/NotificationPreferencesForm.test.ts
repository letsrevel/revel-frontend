import { render, screen, waitFor } from '@testing-library/svelte';
import { userEvent } from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/svelte-query';
import NotificationPreferencesForm from './NotificationPreferencesForm.svelte';
import type { NotificationPreferenceSchema } from '$lib/api/generated/types.gen.js';

// Mock the API
vi.mock('$lib/api', () => ({
	notificationpreferenceUpdatePreferences: vi.fn()
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

	it('renders all form sections', () => {
		render(QueryClientProvider, {
			props: {
				client: queryClient,
				children: NotificationPreferencesForm,
				childProps: {
					preferences: mockPreferences,
					authToken: 'test-token'
				}
			}
		});

		expect(screen.getByText('Master Controls')).toBeInTheDocument();
		expect(screen.getByText('Notification Channels')).toBeInTheDocument();
		expect(screen.getByText('Digest Settings')).toBeInTheDocument();
		expect(screen.getByText('Privacy Settings')).toBeInTheDocument();
	});

	it('displays current preferences correctly', () => {
		render(QueryClientProvider, {
			props: {
				client: queryClient,
				children: NotificationPreferencesForm,
				childProps: {
					preferences: mockPreferences,
					authToken: 'test-token'
				}
			}
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
		const inAppCheckbox = screen.getByRole('checkbox', { name: /enable in-app notifications/i });
		expect(inAppCheckbox).toBeChecked();

		// Check email channel is enabled
		const emailCheckbox = screen.getByRole('checkbox', { name: /enable email notifications/i });
		expect(emailCheckbox).toBeChecked();
	});

	it('disables all controls when silence_all is enabled', async () => {
		const user = userEvent.setup();

		render(QueryClientProvider, {
			props: {
				client: queryClient,
				children: NotificationPreferencesForm,
				childProps: {
					preferences: mockPreferences,
					authToken: 'test-token'
				}
			}
		});

		const silenceAllCheckbox = screen.getByRole('checkbox', {
			name: /silence all notifications/i
		});

		// Enable silence all
		await user.click(silenceAllCheckbox);

		// Check that other controls are disabled
		const eventRemindersCheckbox = screen.getByRole('checkbox', { name: /event reminders/i });
		expect(eventRemindersCheckbox).toBeDisabled();

		const inAppCheckbox = screen.getByRole('checkbox', { name: /enable in-app notifications/i });
		expect(inAppCheckbox).toBeDisabled();
	});

	it('shows time picker only for daily and weekly digest frequencies', async () => {
		const user = userEvent.setup();

		render(QueryClientProvider, {
			props: {
				client: queryClient,
				children: NotificationPreferencesForm,
				childProps: {
					preferences: { ...mockPreferences, digest_frequency: 'immediate' },
					authToken: 'test-token'
				}
			}
		});

		// Time picker should not be visible for immediate
		expect(screen.queryByLabelText('Send time')).not.toBeInTheDocument();

		// Change to daily
		const frequencySelect = screen.getByRole('combobox', { name: /digest frequency/i });
		await user.click(frequencySelect);

		const dailyOption = screen.getByRole('option', { name: /daily/i });
		await user.click(dailyOption);

		// Time picker should now be visible
		await waitFor(() => {
			expect(screen.getByLabelText('Send time')).toBeInTheDocument();
		});
	});

	it('validates that at least one channel is selected', async () => {
		const user = userEvent.setup();

		render(QueryClientProvider, {
			props: {
				client: queryClient,
				children: NotificationPreferencesForm,
				childProps: {
					preferences: mockPreferences,
					authToken: 'test-token'
				}
			}
		});

		// Uncheck all channels
		const inAppCheckbox = screen.getByRole('checkbox', { name: /enable in-app notifications/i });
		const emailCheckbox = screen.getByRole('checkbox', { name: /enable email notifications/i });

		await user.click(inAppCheckbox);
		await user.click(emailCheckbox);

		// Try to save
		const saveButton = screen.getByRole('button', { name: /save preferences/i });
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

		render(QueryClientProvider, {
			props: {
				client: queryClient,
				children: NotificationPreferencesForm,
				childProps: {
					preferences: mockPreferences,
					authToken: 'test-token'
				}
			}
		});

		const saveButton = screen.getByRole('button', { name: /save preferences/i });

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

		render(QueryClientProvider, {
			props: {
				client: queryClient,
				children: NotificationPreferencesForm,
				childProps: {
					preferences: mockPreferences,
					onSave: mockOnSave,
					authToken: 'test-token'
				}
			}
		});

		// Make a change
		const eventRemindersCheckbox = screen.getByRole('checkbox', { name: /event reminders/i });
		await user.click(eventRemindersCheckbox);

		// Save
		const saveButton = screen.getByRole('button', { name: /save preferences/i });
		await user.click(saveButton);

		// Wait for mutation to complete
		await waitFor(() => {
			expect(mockOnSave).toHaveBeenCalledWith(
				expect.objectContaining({
					event_reminders_enabled: false
				})
			);
		});
	});

	it('resets changes when reset button is clicked', async () => {
		const user = userEvent.setup();

		render(QueryClientProvider, {
			props: {
				client: queryClient,
				children: NotificationPreferencesForm,
				childProps: {
					preferences: mockPreferences,
					authToken: 'test-token'
				}
			}
		});

		// Make a change
		const eventRemindersCheckbox = screen.getByRole('checkbox', { name: /event reminders/i });
		await user.click(eventRemindersCheckbox);

		// Checkbox should be unchecked
		expect(eventRemindersCheckbox).not.toBeChecked();

		// Click reset
		const resetButton = screen.getByRole('button', { name: /reset changes/i });
		await user.click(resetButton);

		// Checkbox should be checked again (back to original state)
		await waitFor(() => {
			expect(eventRemindersCheckbox).toBeChecked();
		});
	});

	it('is keyboard accessible', async () => {
		const user = userEvent.setup();

		render(QueryClientProvider, {
			props: {
				client: queryClient,
				children: NotificationPreferencesForm,
				childProps: {
					preferences: mockPreferences,
					authToken: 'test-token'
				}
			}
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
		render(QueryClientProvider, {
			props: {
				client: queryClient,
				children: NotificationPreferencesForm,
				childProps: {
					preferences: mockPreferences,
					disabled: true,
					authToken: 'test-token'
				}
			}
		});

		// All interactive elements should be disabled
		expect(screen.getByRole('checkbox', { name: /silence all notifications/i })).toBeDisabled();
		expect(screen.getByRole('checkbox', { name: /event reminders/i })).toBeDisabled();
		expect(screen.getByRole('button', { name: /save preferences/i })).toBeDisabled();
	});

	it('handles null preferences gracefully', () => {
		render(QueryClientProvider, {
			props: {
				client: queryClient,
				children: NotificationPreferencesForm,
				childProps: {
					preferences: null,
					authToken: 'test-token'
				}
			}
		});

		// Should render with default values
		expect(screen.getByText('Master Controls')).toBeInTheDocument();
		expect(screen.getByRole('checkbox', { name: /silence all notifications/i })).not.toBeChecked();
	});
});
