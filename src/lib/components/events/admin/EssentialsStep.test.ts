import { render, screen, fireEvent } from '@testing-library/svelte';
import { describe, it, expect, vi } from 'vitest';
import EssentialsStep from './EssentialsStep.svelte';

// Mock CityAutocomplete
vi.mock('$lib/components/forms/CityAutocomplete.svelte', () => ({
	default: vi.fn()
}));

describe('EssentialsStep', () => {
	const mockProps = {
		formData: {
			name: '',
			start: '',
			city_id: null,
			visibility: 'public',
			event_type: 'public',
			requires_ticket: false
		},
		validationErrors: {},
		isEditMode: false,
		onUpdate: vi.fn(),
		onSubmit: vi.fn(),
		isSaving: false
	};

	it('renders all required fields', () => {
		render(EssentialsStep, { props: mockProps });

		expect(screen.getByLabelText(/Event Name/i)).toBeInTheDocument();
		expect(screen.getByLabelText(/Start Date & Time/i)).toBeInTheDocument();
		expect(screen.getByText(/City/i)).toBeInTheDocument();
	});

	it('calls onUpdate when name input changes', async () => {
		const onUpdate = vi.fn();
		render(EssentialsStep, {
			props: {
				...mockProps,
				onUpdate
			}
		});

		const nameInput = screen.getByLabelText(/Event Name/i);
		await fireEvent.input(nameInput, { target: { value: 'Test Event' } });

		expect(onUpdate).toHaveBeenCalledWith({ name: 'Test Event' });
	});

	it('displays validation errors', () => {
		render(EssentialsStep, {
			props: {
				...mockProps,
				validationErrors: {
					name: 'Name is required',
					start: 'Start date is required'
				}
			}
		});

		expect(screen.getByText('Name is required')).toBeInTheDocument();
		expect(screen.getByText('Start date is required')).toBeInTheDocument();
	});

	it('shows all visibility options', () => {
		render(EssentialsStep, { props: mockProps });

		expect(screen.getByText('Public')).toBeInTheDocument();
		expect(screen.getByText('Private')).toBeInTheDocument();
		expect(screen.getByText('Members Only')).toBeInTheDocument();
		expect(screen.getByText('Staff Only')).toBeInTheDocument();
	});

	it('calls onSubmit when form is submitted', async () => {
		const onSubmit = vi.fn();
		render(EssentialsStep, {
			props: {
				...mockProps,
				onSubmit
			}
		});

		const form = screen.getByRole('button', { name: /Create Event/i }).closest('form');
		await fireEvent.submit(form!);

		expect(onSubmit).toHaveBeenCalled();
	});

	it('is keyboard accessible', () => {
		render(EssentialsStep, { props: mockProps });

		const nameInput = screen.getByLabelText(/Event Name/i);
		nameInput.focus();
		expect(document.activeElement).toBe(nameInput);
	});
});
