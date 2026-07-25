/**
 * Type overrides for generated API types that are too narrow because of
 * backend OpenAPI *schema-name collisions* introduced by the membership-
 * subscriptions feature (BE #776-779, `feature/subscriptions-integration`).
 *
 * Two backend enum classes were added with the same class name as existing,
 * unrelated enums in other modules. django-ninja/pydantic dedupes OpenAPI
 * `components.schemas` entries by class name, so only one definition survives
 * per generated build — the runtime API still accepts/returns the wider set
 * of literal values below, but `src/lib/api/generated/types.gen.ts` no longer
 * says so.
 *
 * Collisions (verified against `revel-backend@feature/subscriptions-integration`):
 *
 * - `PaymentMethod`: `MembershipSubscriptionPlan.PaymentMethod`
 *   (`'online' | 'offline'`, `revel-backend/src/events/models/subscription.py`)
 *   wins over `TicketTier.PaymentMethod`
 *   (`'online' | 'offline' | 'at_the_door' | 'free'`,
 *   `revel-backend/src/events/models/ticket.py`). Affects every generated type
 *   whose `payment_method` field is actually backed by `TicketTier.PaymentMethod`:
 *   `CancellationPreviewSchema`, `SeriesPassSchema`/`SeriesPassAdminSchema`/
 *   `SeriesPassCreateSchema`/`SeriesPassUpdateSchema`, `BoxOfficeSellRequest`,
 *   `TicketTierCreateSchema`/`TicketTierUpdateSchema`, and the
 *   `tier__payment_method` ticket-list filter param.
 *
 * - `ReasonCode`: `membership_manager.enums.ReasonCode`
 *   (`revel-backend/src/events/service/membership_manager/enums.py`) wins over
 *   `event_manager.enums.ReasonCode`
 *   (`revel-backend/src/events/service/event_manager/enums.py`). Affects
 *   `EventUserEligibility.reason_code`.
 *
 * These are read/write-boundary casts, not new business logic — do not add
 * runtime branches here. TODO: file a BE issue to give each schema a distinct
 * OpenAPI component name (e.g. a ninja/pydantic schema `title`/alias) and
 * delete this file once the generated types are correct on their own.
 */

/** True `payment_method` union for ticket/series-pass/box-office fields — see file doc. */
export type TicketPaymentMethod = 'online' | 'offline' | 'at_the_door' | 'free';

/** True `reason_code` union for event eligibility (`EventUserEligibility`) — see file doc. */
export type EventReasonCode =
	| 'members_only'
	| 'membership_inactive'
	| 'requires_full_profile'
	| 'event_is_full'
	| 'spots_reserved_for_waitlist'
	| 'on_waitlist_waiting_for_batch'
	| 'sold_out'
	| 'questionnaire_missing'
	| 'questionnaire_failed'
	| 'questionnaire_pending_review'
	| 'questionnaire_retake_cooldown'
	| 'requires_ticket'
	| 'must_rsvp'
	| 'requires_invitation'
	| 'invitation_request_pending'
	| 'invitation_request_rejected'
	| 'requires_purchase'
	| 'nothing_to_purchase'
	| 'event_is_not_open'
	| 'event_has_finished'
	| 'rsvp_deadline_passed'
	| 'application_deadline_passed'
	| 'no_tickets_on_sale'
	| 'membership_tier_required'
	| 'blacklisted'
	| 'verification_required'
	| 'whitelist_pending'
	| 'whitelist_rejected';
