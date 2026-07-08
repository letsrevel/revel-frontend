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
			props: { client: queryClient, component: NotificationPreferencesForm, props }
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
			expect(mockOnSave).toHaveBeenCalledWith(
				expect.objectContaining({
					event_reminders_enabled: false
				})
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
