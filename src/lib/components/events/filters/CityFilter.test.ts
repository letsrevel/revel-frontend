import { render, screen } from '@testing-library/svelte';
import { userEvent } from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { QueryClient } from '@tanstack/svelte-query';
import QueryClientTestWrapper from '$lib/test-utils/QueryClientTestWrapper.svelte';
import CityFilter from './CityFilter.svelte';
import { shouldRetry } from '$lib/api/query-retry';

const { cityGetCity, cityListCities } = vi.hoisted(() => ({
	cityGetCity: vi.fn(),
	cityListCities: vi.fn()
}));
vi.mock('$lib/api', () => ({ cityGetCity, cityListCities }));

// Same retry policy as the app's root QueryClient.
function makeClient(): QueryClient {
	return new QueryClient({ defaultOptions: { queries: { retry: shouldRetry, retryDelay: 0 } } });
}

function renderFilter(props: Record<string, unknown>, client = makeClient()) {
	return render(QueryClientTestWrapper, {
		props: { client, component: CityFilter, componentProps: props }
	});
}

describe('CityFilter', () => {
	beforeEach(() => {
		cityGetCity.mockReset();
		cityListCities.mockReset();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('shows the name of the city the list is filtered by', async () => {
		cityGetCity.mockResolvedValue({ data: { id: 7, name: 'Vienna', country: 'Austria' } });
		renderFilter({ selectedCityId: 7, onChangeCity: vi.fn() });

		expect(await screen.findByText('Vienna')).toBeInTheDocument();
		expect(screen.getByText('Austria')).toBeInTheDocument();
		expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
		expect(cityGetCity).toHaveBeenCalledWith(expect.objectContaining({ path: { city_id: 7 } }));
	});

	it('shows the search input when no city is selected', () => {
		renderFilter({ selectedCityId: undefined, onChangeCity: vi.fn() });

		expect(screen.getByRole('textbox')).toBeInTheDocument();
		expect(cityGetCity).not.toHaveBeenCalled();
	});

	it('clears the city filter', async () => {
		cityGetCity.mockResolvedValue({ data: { id: 7, name: 'Vienna', country: 'Austria' } });
		const onChangeCity = vi.fn();
		renderFilter({ selectedCityId: 7, onChangeCity });

		await userEvent.click(await screen.findByRole('button', { name: /clear/i }));
		expect(onChangeCity).toHaveBeenCalledWith(null);
	});

	it('reports the picked city and seeds it so the name needs no extra request', async () => {
		vi.useFakeTimers();
		cityListCities.mockResolvedValue({
			data: { results: [{ id: 9, name: 'Graz', country: 'Austria' }] }
		});
		const client = makeClient();
		const onChangeCity = vi.fn();
		renderFilter({ selectedCityId: undefined, onChangeCity }, client);

		const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
		await user.type(screen.getByRole('textbox'), 'gr');
		await vi.advanceTimersByTimeAsync(400);
		await user.click(screen.getByRole('button', { name: /Graz/ }));

		expect(onChangeCity).toHaveBeenCalledWith({ id: 9, name: 'Graz', country: 'Austria' });
		expect(client.getQueryData(['city', 9])).toEqual({ id: 9, name: 'Graz', country: 'Austria' });
	});

	it('shows "Unknown city" at once when the city does not exist', async () => {
		cityGetCity.mockResolvedValue({ data: undefined, response: { status: 404 } });
		renderFilter({ selectedCityId: 999, onChangeCity: vi.fn() });

		expect(await screen.findByText('Unknown city')).toBeInTheDocument();
		// A 404 is not retried.
		expect(cityGetCity).toHaveBeenCalledTimes(1);
		expect(screen.getByRole('button', { name: /clear/i })).toBeInTheDocument();
	});

	it('tells screen readers that the city is loading', () => {
		cityGetCity.mockReturnValue(new Promise<never>(() => undefined));
		renderFilter({ selectedCityId: 7, onChangeCity: vi.fn() });

		expect(screen.getByRole('status')).toHaveTextContent('Loading city');
	});

	it('stays neutral when the lookup fails for another reason', async () => {
		cityGetCity.mockResolvedValue({ data: undefined, response: { status: 503 } });
		renderFilter({ selectedCityId: 7, onChangeCity: vi.fn() });

		expect(await screen.findByText('Location', { selector: 'div' })).toBeInTheDocument();
		expect(screen.queryByText('Unknown city')).not.toBeInTheDocument();
	});
});
