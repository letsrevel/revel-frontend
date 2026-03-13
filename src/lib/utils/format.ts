/**
 * Formatting utilities for prices and currencies.
 */

/**
 * Format a price with currency using Intl.NumberFormat.
 * Returns `freeLabel` when the price is zero, null, or undefined.
 */
export function formatPrice(
	price: number | string | undefined | null,
	currency?: string | null,
	freeLabel = 'Free'
): string {
	if (price === undefined || price === null) return freeLabel;
	const numPrice = typeof price === 'string' ? parseFloat(price) : price;
	if (numPrice === 0) return freeLabel;
	const currencyCode = currency?.toUpperCase() || 'USD';
	return new Intl.NumberFormat('en-US', {
		style: 'currency',
		currency: currencyCode
	}).format(numPrice);
}
