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
			props: { client: queryClient, component: DetailsStep, componentProps: props }
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

	it('renders the require-ticket-names toggle only for ticketed events and reports changes', async () => {
		const onUpdate = vi.fn();
		renderStep({
			...mockProps,
			formData: { ...mockProps.formData, requires_ticket: true },
			onUpdate
		});

		// The toggle lives in the collapsible Advanced section.
		await fireEvent.click(screen.getByRole('button', { name: /Advanced/i }));

		const checkbox = screen.getByRole('checkbox', { name: /Require ticket holder names/i });
		// Defaults to checked: the backend default is `true`.
		expect(checkbox).toBeChecked();

		await fireEvent.click(checkbox);
		expect(onUpdate).toHaveBeenCalledWith({ require_ticket_names: false });
	});

	it('hides the require-ticket-names toggle for non-ticketed events', async () => {
		renderStep({
			...mockProps,
			formData: { ...mockProps.formData, requires_ticket: false }
		});

		await fireEvent.click(screen.getByRole('button', { name: /Advanced/i }));

		expect(
			screen.queryByRole('checkbox', { name: /Require ticket holder names/i })
		).not.toBeInTheDocument();
	});

	it('is keyboard accessible', async () => {
		renderStep();

		const descriptionTextarea = screen.getByLabelText('Description');
		descriptionTextarea.focus();
		expect(document.activeElement).toBe(descriptionTextarea);
	});
});

// #830 (BE #869): place-of-supply fields — virtual toggle + VAT-country
// override — live in the Taxes section; the mismatch warning is server-computed
// (EventDetailSchema.vat_country_mismatch) and passed down as a prop.
describe('DetailsStep — Taxes section', () => {
	let queryClient: QueryClient;

	beforeEach(() => {
		queryClient = new QueryClient({
			defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
		});
	});

	const baseProps = {
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

	function renderStep(props: Record<string, unknown> = {}) {
		return render(QueryClientTestWrapper, {
			props: {
				client: queryClient,
				component: DetailsStep,
				componentProps: { ...baseProps, ...props }
			}
		});
	}

	it('renders the Taxes section (collapsed by default)', () => {
		renderStep();
		const toggle = screen.getByTestId('tax-section-toggle');
		expect(toggle).toBeInTheDocument();
		expect(toggle).toHaveAttribute('aria-expanded', 'false');
	});

	it('opens the section and calls onUpdate when toggling the virtual flag', async () => {
		const onUpdate = vi.fn();
		renderStep({ onUpdate });

		await fireEvent.click(screen.getByTestId('tax-section-toggle'));
		const checkbox = screen.getByRole('checkbox', { name: /Virtual event/i });
		expect(checkbox).not.toBeChecked();

		await fireEvent.click(checkbox);
		expect(onUpdate).toHaveBeenCalledWith({ is_virtual: true });
	});

	it('auto-opens the section when the event is already virtual', () => {
		renderStep({ formData: { ...baseProps.formData, is_virtual: true } });
		expect(screen.getByTestId('tax-section-toggle')).toHaveAttribute('aria-expanded', 'true');
		expect(screen.getByRole('checkbox', { name: /Virtual event/i })).toBeChecked();
	});

	it('uppercases and forwards the VAT-country override', async () => {
		const onUpdate = vi.fn();
		renderStep({ onUpdate, formData: { ...baseProps.formData, vat_country_code: '' } });

		await fireEvent.click(screen.getByTestId('tax-section-toggle'));
		const input = screen.getByLabelText(/VAT country override/i);
		await fireEvent.input(input, { target: { value: 'de' } });
		expect(onUpdate).toHaveBeenCalledWith({ vat_country_code: 'DE' });
	});

	it('shows the server-computed mismatch warning with the effective country', () => {
		renderStep({ effectiveVatCountry: 'DE', vatCountryMismatch: true });
		// Auto-opened: an active warning must not hide behind a collapsed section.
		expect(screen.getByTestId('tax-section-toggle')).toHaveAttribute('aria-expanded', 'true');
		expect(screen.getByText("VAT country differs from your organization's")).toBeInTheDocument();
		expect(screen.getByText(/taxed in DE/i)).toBeInTheDocument();
	});

	it('shows no warning when the flag is false', async () => {
		renderStep({ effectiveVatCountry: 'AT', vatCountryMismatch: false });
		await fireEvent.click(screen.getByTestId('tax-section-toggle'));
		expect(screen.getByText(/Effective VAT country: AT/i)).toBeInTheDocument();
		expect(screen.queryByText(/differs from your organization/i)).not.toBeInTheDocument();
	});
});
