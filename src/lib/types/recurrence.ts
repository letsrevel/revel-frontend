import type {
	CancelOccurrenceSchema,
	EventSeriesDriftSchema,
	EventSeriesRecurrenceDetailSchema,
	EventSeriesRecurrenceUpdateSchema,
	Frequency,
	GenerateSeriesEventsSchema,
	MonthlyType,
	PropagateScope,
	RecurrenceRuleCreateSchema,
	RecurrenceRuleSchema,
	RecurrenceRuleUpdateSchema,
	RecurringEventCreateSchema,
	TemplateEditSchema
} from '$lib/api/generated/types.gen';

export type RecurrenceRule = RecurrenceRuleSchema;
export type RecurrenceRuleCreate = RecurrenceRuleCreateSchema;
export type RecurrenceRuleUpdate = RecurrenceRuleUpdateSchema;
export type SeriesRecurrenceDetail = EventSeriesRecurrenceDetailSchema;
export type SeriesRecurrenceUpdate = EventSeriesRecurrenceUpdateSchema;
export type SeriesDrift = EventSeriesDriftSchema;
export type RecurringEventCreate = RecurringEventCreateSchema;
export type TemplateEdit = TemplateEditSchema;
export type CancelOccurrence = CancelOccurrenceSchema;
export type GenerateSeriesEvents = GenerateSeriesEventsSchema;

export type { Frequency, MonthlyType, PropagateScope };

export const FREQUENCIES: readonly Frequency[] = ['daily', 'weekly', 'monthly', 'yearly'] as const;
export const MONTHLY_TYPES: readonly MonthlyType[] = ['day', 'weekday'] as const;
export const PROPAGATE_SCOPES: readonly PropagateScope[] = [
	'none',
	'future_unmodified',
	'all_future'
] as const;

// Weekday codes follow the backend convention: 0=Mon … 6=Sun.
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;
export const WEEKDAYS: readonly Weekday[] = [0, 1, 2, 3, 4, 5, 6] as const;

// Ordinal position used by monthly nth-weekday (1..4, -1 for "last").
export type WeekdayOrdinal = 1 | 2 | 3 | 4 | -1;
export const WEEKDAY_ORDINALS: readonly WeekdayOrdinal[] = [1, 2, 3, 4, -1] as const;

export type BoundaryKind = 'none' | 'until' | 'count';

// Narrowed shape describing just the fields `formatRecurrence` actually reads.
// Accepts both `RecurrenceRuleSchema` (admin GET) and `RecurrenceRuleCreateSchema`
// (live wizard preview) — the shared subset.
export interface RecurrenceDescriptor {
	frequency: Frequency;
	interval?: number | null;
	weekdays?: readonly number[] | null;
	monthly_type?: MonthlyType | null;
	day_of_month?: number | null;
	nth_weekday?: number | null;
	weekday?: number | null;
	until?: string | null;
	count?: number | null;
}
