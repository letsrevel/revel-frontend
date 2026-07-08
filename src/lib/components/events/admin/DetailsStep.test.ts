import { render, screen, fireEvent } from '@testing-library/svelte';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient } from '@tanstack/svelte-query';
import QueryClientTestWrapper from '$lib/test-utils/QueryClientTestWrapper.svelte';
import DetailsStep from './DetailsStep.svelte';

describe('DetailsStep', () => {
	const mockProps = {
		formData: {
			name: 'Test Event',
			start: '2025-12-01T18:00:00',
			city_id: 1,
			visibility: 'public' as const,
			event_type: 'public' as const,
			requires_ticket: false
		},
		eventSeries: [],
		questionnaires: [],
		onUpdate: vi.fn(),
		onUpdateImages: vi.fn()
	};

	// The Capacity section mounts WaitlistAdvancedSection → WaitlistSettingsModal,
	// which resolves a QueryClient from Svelte context, so every render needs a
	// real QueryClientProvider around the component under test.
	let queryClient: QueryClient;

	beforeEach(() => {
		queryClient = new QueryClient({
			defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
		});
	});

	function renderStep(props: typeof mockProps = mockProps) {
		return render(QueryClientTestWrapper, {
			props: { client: queryClient, component: DetailsStep, props }
		});
	}

	it('renders all accordion sections', () => {
		renderStep();

		expect(screen.getByText('Basic Details')).toBeInTheDocument();
		expect(screen.getByText('RSVP Options')).toBeInTheDocument();
		expect(screen.getByText('Capacity and waitlist')).toBeInTheDocument();
		expect(screen.getByText('Advanced')).toBeInTheDocument();
		expect(screen.getByText('Media')).toBeInTheDocument();
	});

	it('opens Basic Details section by default', () => {
		renderStep();

		expect(screen.getByLabelText('Description')).toBeInTheDocument();
	});

	it('toggles accordion sections', async () => {
		renderStep();

		const capacityButton = screen.getByRole('button', { name: /Capacity/i });

		// Section should be closed initially
		expect(screen.queryByLabelText('Maximum Attendees')).not.toBeInTheDocument();

		// Open section
		await fireEvent.click(capacityButton);
		expect(screen.getByLabelText('Maximum Attendees')).toBeInTheDocument();

		// Close section
		await fireEvent.click(capacityButton);
		expect(screen.queryByLabelText('Maximum Attendees')).not.toBeInTheDocument();
	});

	it('hides RSVP options when requires_ticket is true (ticketing lives in the tickets step)', () => {
		renderStep({
			...mockProps,
			formData: {
				...mockProps.formData,
				requires_ticket: true
			}
		});

		// Ticketing configuration moved to the dedicated TicketingStep (step 3),
		// so DetailsStep renders neither an RSVP nor a Ticketing section here.
		expect(screen.queryByText('RSVP Options')).not.toBeInTheDocument();
		expect(screen.queryByText('Ticketing')).not.toBeInTheDocument();
	});

	it('shows RSVP section when requires_ticket is false', () => {
		renderStep();

		expect(screen.getByText('RSVP Options')).toBeInTheDocument();
		expect(screen.queryByText('Ticketing')).not.toBeInTheDocument();
	});

	it('calls onUpdate when description changes', async () => {
		const onUpdate = vi.fn();
		renderStep({
			...mockProps,
			onUpdate
		});

		const descriptionTextarea = screen.getByLabelText('Description');
		await fireEvent.input(descriptionTextarea, { target: { value: 'Test description' } });

		expect(onUpdate).toHaveBeenCalledWith({ description: 'Test description' });
	});

	it('handles tag input', async () => {
		const onUpdate = vi.fn();
		renderStep({
			...mockProps,
			onUpdate
		});

		// Open Advanced section
		const advancedButton = screen.getByRole('button', { name: /Advanced/i });
		await fireEvent.click(advancedButton);

		const tagInput = screen.getByPlaceholderText('Add tags...');
		const addButton = screen.getByRole('button', { name: 'Add' });

		await fireEvent.input(tagInput, { target: { value: 'social' } });
		await fireEvent.click(addButton);

		expect(onUpdate).toHaveBeenCalledWith({ tags: ['social'] });
	});

	it('is keyboard accessible', async () => {
		renderStep();

		const descriptionTextarea = screen.getByLabelText('Description');
		descriptionTextarea.focus();
		expect(document.activeElement).toBe(descriptionTextarea);
	});
});
