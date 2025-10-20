import { render, screen, fireEvent } from '@testing-library/svelte';
import { describe, it, expect, vi } from 'vitest';
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

	it('renders all accordion sections', () => {
		render(DetailsStep, { props: mockProps });

		expect(screen.getByText('Basic Details')).toBeInTheDocument();
		expect(screen.getByText('RSVP Options')).toBeInTheDocument();
		expect(screen.getByText('Capacity')).toBeInTheDocument();
		expect(screen.getByText('Advanced')).toBeInTheDocument();
		expect(screen.getByText('Media')).toBeInTheDocument();
	});

	it('opens Basic Details section by default', () => {
		render(DetailsStep, { props: mockProps });

		expect(screen.getByLabelText('Description')).toBeInTheDocument();
	});

	it('toggles accordion sections', async () => {
		render(DetailsStep, { props: mockProps });

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

	it('shows ticketing section when requires_ticket is true', () => {
		render(DetailsStep, {
			props: {
				...mockProps,
				formData: {
					...mockProps.formData,
					requires_ticket: true
				}
			}
		});

		expect(screen.getByText('Ticketing')).toBeInTheDocument();
		expect(screen.queryByText('RSVP Options')).not.toBeInTheDocument();
	});

	it('shows RSVP section when requires_ticket is false', () => {
		render(DetailsStep, { props: mockProps });

		expect(screen.getByText('RSVP Options')).toBeInTheDocument();
		expect(screen.queryByText('Ticketing')).not.toBeInTheDocument();
	});

	it('calls onUpdate when description changes', async () => {
		const onUpdate = vi.fn();
		render(DetailsStep, {
			props: {
				...mockProps,
				onUpdate
			}
		});

		const descriptionTextarea = screen.getByLabelText('Description');
		await fireEvent.input(descriptionTextarea, { target: { value: 'Test description' } });

		expect(onUpdate).toHaveBeenCalledWith({ description: 'Test description' });
	});

	it('handles tag input', async () => {
		const onUpdate = vi.fn();
		render(DetailsStep, {
			props: {
				...mockProps,
				onUpdate
			}
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
		render(DetailsStep, { props: mockProps });

		const descriptionTextarea = screen.getByLabelText('Description');
		descriptionTextarea.focus();
		expect(document.activeElement).toBe(descriptionTextarea);
	});
});
