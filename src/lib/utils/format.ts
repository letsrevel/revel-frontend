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
	return new Intl.NumberFormat(undefined, {
		style: 'currency',
		currency: currencyCode
	}).format(numPrice);
}

/**
 * Format a monetary amount with currency, always showing the numeric value
 * (including zero, e.g. "$0.00"). Unlike {@link formatPrice} it never
 * substitutes a "Free" label — use it for accounting figures (revenue, net,
 * refunds) where a zero amount is meaningful.
 */
export function formatMoney(
	amount: number | string | null | undefined,
	currency?: string | null
): string {
	const parsed = typeof amount === 'string' ? parseFloat(amount) : (amount ?? 0);
	const safe = Number.isFinite(parsed) ? parsed : 0;
	const currencyCode = currency?.toUpperCase() || 'USD';
	return new Intl.NumberFormat(undefined, {
		style: 'currency',
		currency: currencyCode
	}).format(safe);
}
