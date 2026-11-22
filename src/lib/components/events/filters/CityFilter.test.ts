import { render, screen, fireEvent } from '@testing-library/svelte';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { QueryClient } from '@tanstack/svelte-query';
import QueryClientTestWrapper from '$lib/test-utils/QueryClientTestWrapper.svelte';
import CityFilter from './CityFilter.svelte';

const { cityGetCity, cityListCities } = vi.hoisted(() => ({
	cityGetCity: vi.fn(),
	cityListCities: vi.fn()
}));
vi.mock('$lib/api', () => ({ cityGetCity, cityListCities }));

function renderFilter(props: Record<string, unknown>, client = new QueryClient()) {
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

		await fireEvent.click(await screen.findByRole('button', { name: /clear/i }));
		expect(onChangeCity).toHaveBeenCalledWith(null);
	});

	it('reports the picked city and seeds it so the name needs no extra request', async () => {
		vi.useFakeTimers();
		cityListCities.mockResolvedValue({
			data: { results: [{ id: 9, name: 'Graz', country: 'Austria' }] }
		});
		const client = new QueryClient();
		const onChangeCity = vi.fn();
		renderFilter({ selectedCityId: undefined, onChangeCity }, client);

		await fireEvent.input(screen.getByRole('textbox'), { target: { value: 'gr' } });
		await vi.advanceTimersByTimeAsync(400);
		await fireEvent.click(screen.getByRole('button', { name: /Graz/ }));

		expect(onChangeCity).toHaveBeenCalledWith({ id: 9, name: 'Graz', country: 'Austria' });
		expect(client.getQueryData(['city', 9])).toEqual({ id: 9, name: 'Graz', country: 'Austria' });
	});
});
