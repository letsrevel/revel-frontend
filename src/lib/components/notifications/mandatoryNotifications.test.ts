import { describe, it, expect } from 'vitest';
import { disablesStaffAlerts, isMandatoryType } from './mandatoryNotifications';

describe('isMandatoryType', () => {
	it('treats holder ticket receipts as mandatory', () => {
		expect(isMandatoryType('ticket_created')).toBe(true);
		expect(isMandatoryType('ticket_cancelled')).toBe(true);
		expect(isMandatoryType('ticket_refunded')).toBe(true);
	});

	it.each([
		'staff_ticket_created',
		'staff_ticket_cancelled',
		'staff_ticket_refunded',
		'staff_series_pass_purchased',
		'staff_series_pass_cancelled'
	])('never treats %s as mandatory', (type) => {
		expect(isMandatoryType(type)).toBe(false);
	});
});

describe('disablesStaffAlerts', () => {
	it('is false with no overrides', () => {
		expect(disablesStaffAlerts({})).toBe(false);
	});

	it.each(['staff_ticket_created', 'staff_series_pass_purchased'])(
		'is true when %s is disabled',
		(type) => {
			expect(disablesStaffAlerts({ [type]: { enabled: false, channels: ['in_app'] } })).toBe(true);
		}
	);

	it('is true when a staff type has no channels', () => {
		expect(disablesStaffAlerts({ staff_ticket_refunded: { enabled: true, channels: [] } })).toBe(
			true
		);
	});

	it('ignores the holder-only ticket_* / series_pass_* types', () => {
		expect(
			disablesStaffAlerts({
				ticket_created: { enabled: false, channels: [] },
				series_pass_purchased: { enabled: false, channels: [] }
			})
		).toBe(false);
	});
});
