# Backend Issues Discovered During Frontend Development

## Critical: TierSchema Missing `id` Field

**Discovered:** 2025-10-24
**Severity:** Critical - Blocks ticket purchasing functionality
**Status:** Needs Backend Fix

### Problem

The public `/api/events/{event_id}/tickets/tiers` endpoint returns `TierSchema` objects that do NOT include the `id` field. However, the checkout endpoint `/api/events/{event_id}/tickets/{tier_id}/checkout` requires a `tier_id` UUID parameter.

This creates an impossible situation: attendees can see available ticket tiers but cannot purchase them because they don't know the tier IDs.

### Current Backend Code

**File:** `src/events/schema.py`

```python
class TierSchema(ModelSchema):
    event_id: UUID
    price: Decimal
    currency: str
    total_available: int | None
    description_html: str = ""

    class Meta:
        model = TicketTier
        fields = [
            "name",
            "description",
            "price",
            "price_type",
            "pwyc_min",
            "pwyc_max",
            "currency",
            "sales_start_at",
            "sales_end_at",
            "purchasable_by",
            "payment_method",
        ]
        # ❌ MISSING: "id" field
```

### Required Fix

Add `"id"` to the `fields` list in `TierSchema.Meta`:

```python
class TierSchema(ModelSchema):
    event_id: UUID
    price: Decimal
    currency: str
    total_available: int | None
    description_html: str = ""

    class Meta:
        model = TicketTier
        fields = [
            "id",  # ✅ ADD THIS
            "name",
            "description",
            "price",
            "price_type",
            "pwyc_min",
            "pwyc_max",
            "currency",
            "sales_start_at",
            "sales_end_at",
            "purchasable_by",
            "payment_method",
        ]
```

### Security Considerations

Including the tier `id` in the public schema is NOT a security concern because:

1. The tier ID is already required for the checkout endpoint
2. Tier visibility is already controlled by `TicketTier.for_user()` which filters by user permissions
3. The checkout endpoint validates tier access again via `TicketTier.objects.for_user(self.user())`
4. Tier IDs are UUIDs, which are not guessable

### Impact

- **Current:** Ticket purchasing is completely blocked in the frontend
- **After Fix:** Attendees can claim free tickets and proceed with paid ticket flows

### Workaround

Frontend temporarily assumes `id` field exists (TypeScript type assertion) until backend is fixed.

---

## Other Issues

_(None discovered yet)_
