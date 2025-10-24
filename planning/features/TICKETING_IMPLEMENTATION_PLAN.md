# Ticketing System Implementation Plan

**Branch**: `feature/ticketing-system`
**Start Date**: 2025-10-24
**Status**: 🚧 In Progress

## Related GitHub Issues
- #16 - Event ticketing (attendee-facing) - UPDATED
- #115 - Ticket tier creation in event wizard (organizer) - NEW
- #116 - Admin offline payment management - NEW
- #61 - Stripe integration (FUTURE PHASE)
- #22 - QR code check-in system (SEPARATE FEATURE)
- #14 - User dashboard with tickets (SEPARATE FEATURE)

---

## Executive Summary

This plan implements a comprehensive ticketing system for the Revel event platform in 3 phases:

- **Phase 1: MVP (FREE tickets)** - FREE ticket claiming with QR codes
- **Phase 2: Paid Tickets** - OFFLINE and AT_THE_DOOR payment methods with admin management
- **Phase 3: Advanced Features** - PWYC pricing, tier restrictions, sales windows

**Stripe integration (ONLINE payment)** is deferred to Phase 4 (future).

---

## Backend API Reference

### Ticket Tier Endpoints (Admin)
```
GET    /api/event-admin/{event_id}/ticket-tiers
POST   /api/event-admin/{event_id}/ticket-tier
PATCH  /api/event-admin/{event_id}/ticket-tier/{tier_id}
DELETE /api/event-admin/{event_id}/ticket-tier/{tier_id}
```

**Authentication**: Requires `manage_tickets` permission or event ownership

**TicketTierCreateSchema**:
```typescript
{
  name: string;                    // 1-150 chars
  description?: string | null;     // Markdown supported
  payment_method: 'free' | 'offline' | 'at_the_door' | 'online';
  visibility: 'public' | 'private' | 'members-only' | 'staff-only';
  purchasable_by: 'public' | 'members' | 'invited' | 'invited_and_members';
  price_type: 'fixed' | 'pwyc';
  price: number;                   // Decimal, ≥ 0 (≥ 1 for ONLINE)
  pwyc_min?: number;               // Decimal, ≥ 1 (for PWYC)
  pwyc_max?: number | null;        // Decimal, ≥ pwyc_min (for PWYC)
  currency: string;                // ISO 4217 code (default: "USD")
  sales_start_at?: string | null;  // ISO datetime
  sales_end_at?: string | null;    // ISO datetime
  total_quantity?: number | null;  // Positive int or null (unlimited)
  manual_payment_instructions?: string | null; // For OFFLINE tiers
}
```

**TicketTierUpdateSchema**: Same as Create, but all fields optional

**TicketTierDetailSchema**: Returned from API, includes:
```typescript
{
  id: string;                      // UUID
  event_id: string;                // UUID
  total_available: number | null;  // Calculated: total_quantity - quantity_sold
  quantity_sold: number;           // Count of sold tickets
  created_at: string;              // ISO datetime
  updated_at: string;              // ISO datetime
  ...all fields from CreateSchema
}
```

### Ticket Endpoints (Attendee)
```
GET  /api/events/{event_id}/tickets/tiers
POST /api/events/{event_id}/tickets/{tier_id}/checkout
POST /api/events/{event_id}/tickets/{tier_id}/checkout/pwyc
GET  /api/events/{event_id}/my-status
```

**Authentication**: Requires valid access token

**List Tiers Response**:
```typescript
{
  results: TicketTierDetailSchema[];
}
```

**Checkout Request** (Fixed Price):
```typescript
{
  // No body required - creates ticket immediately
}
```

**Checkout Request** (PWYC):
```typescript
{
  amount: number; // Must be between pwyc_min and pwyc_max
}
```

**Checkout Response**:
```typescript
{
  id: string;           // Ticket UUID
  status: 'pending' | 'active';
  tier: TierSchema;
  event_id: string;
  checked_in_at: string | null;
}
```

**My Status Response**:
```typescript
// Returns ONE of:
EventRSVPSchema | EventTicketSchema | EventUserEligibility

// EventTicketSchema:
{
  id: string;
  event_id: string;
  status: 'pending' | 'active' | 'checked_in' | 'cancelled';
  tier: {
    id: string;
    name: string;
    payment_method: string;
    price: number;
    currency: string;
    manual_payment_instructions?: string | null;
  };
  checked_in_at: string | null;
}
```

### Admin Ticket Management
```
GET  /api/event-admin/{event_id}/pending-tickets
POST /api/event-admin/{event_id}/tickets/{ticket_id}/confirm-payment
DELETE /api/event-admin/{event_id}/tickets/{ticket_id}
```

**Authentication**: Requires `manage_tickets` permission or event ownership

**PendingTicketSchema**:
```typescript
{
  id: string;
  status: 'pending';
  tier: {
    id: string;
    name: string;
    payment_method: 'offline' | 'at_the_door';
    price: number;
    currency: string;
  };
  user: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
  };
  created_at: string;
}
```

---

## Phase 1: MVP (FREE Tickets Only)

**Goal**: Ship basic ticketing with FREE tickets and QR codes

**Estimated Time**: 8-10 hours

### 1.1 Modify Event Wizard - Step 1 (Essentials)

**File**: `src/lib/components/events/admin/EssentialsStep.svelte`

**Changes**:
- Add "Requires Ticket" toggle (default: OFF)
- When enabled, show payment method dropdown (default: FREE)
- Add info text: "You can configure ticket tiers in Step 4"

**Implementation**:
```svelte
<script lang="ts">
  let requiresTicket = $state(false);
  let defaultPaymentMethod = $state<'free' | 'offline' | 'at_the_door' | 'online'>('free');

  // Expose to parent via props callback
  $effect(() => {
    onUpdate({ requiresTicket, defaultPaymentMethod });
  });
</script>

<div class="space-y-4">
  <!-- Existing fields: name, date, location... -->

  <div class="border rounded-lg p-4">
    <h3 class="font-semibold mb-3">Event Access</h3>

    <div class="space-y-3">
      <label class="flex items-center">
        <input
          type="radio"
          name="access-type"
          value="rsvp"
          checked={!requiresTicket}
          onchange={() => requiresTicket = false}
          class="mr-2"
        />
        RSVP Only (Free to attend, track attendance)
      </label>

      <label class="flex items-center">
        <input
          type="radio"
          name="access-type"
          value="ticket"
          checked={requiresTicket}
          onchange={() => requiresTicket = true}
          class="mr-2"
        />
        Requires Ticket
      </label>

      {#if requiresTicket}
        <div class="ml-6 space-y-2">
          <label for="payment-method" class="text-sm font-medium">
            Default Payment Method
          </label>
          <select
            id="payment-method"
            bind:value={defaultPaymentMethod}
            class="w-full rounded-md border px-3 py-2"
          >
            <option value="free">FREE (No payment required)</option>
            <option value="offline">OFFLINE (Manual payment confirmation)</option>
            <option value="at_the_door">AT THE DOOR (Pay at event entrance)</option>
            <option value="online" disabled={!organization.is_stripe_connected}>
              ONLINE (Stripe) {#if !organization.is_stripe_connected}⚠️ Not connected{/if}
            </option>
          </select>

          <p class="text-sm text-muted-foreground">
            💡 You can configure ticket tiers in Step 4
          </p>
        </div>
      {/if}
    </div>
  </div>
</div>
```

**State to track**: `requiresTicket`, `defaultPaymentMethod`

### 1.2 Create Ticketing Step (Step 4)

**File**: `src/lib/components/events/admin/TicketingStep.svelte`

**Props**:
```typescript
interface Props {
  eventId: string;                    // Existing event ID (for edit mode)
  defaultPaymentMethod: 'free' | 'offline' | 'at_the_door' | 'online';
  onBack: () => void;
  onNext: () => void;
}
```

**Features (Phase 1)**:
- Fetch existing tiers: `GET /api/event-admin/{event_id}/ticket-tiers`
- Display "General Admission" tier (auto-created by backend)
- Edit tier button opens modal
- Show tier summary: name, price, payment method, visibility, quantity

**Implementation**:
```svelte
<script lang="ts">
  import { createQuery } from '@tanstack/svelte-query';
  import { eventadminListTicketTiers } from '$lib/api/generated/sdk.gen';
  import TierCard from './TierCard.svelte';
  import TierForm from './TierForm.svelte';

  let { eventId, defaultPaymentMethod, onBack, onNext }: Props = $props();

  let tiersQuery = createQuery({
    queryKey: ['event-admin', eventId, 'ticket-tiers'],
    queryFn: () => eventadminListTicketTiers({ path: { event_id: eventId } })
  });

  let editingTier = $state<TicketTierDetailSchema | null>(null);
  let showTierForm = $state(false);

  let tiers = $derived($tiersQuery.data?.data?.results ?? []);
</script>

<div class="space-y-6">
  <div>
    <h2 class="text-2xl font-bold">Configure Ticket Tiers</h2>
    <p class="text-muted-foreground">
      Tiers let you offer different ticket types (e.g., VIP, Student, General)
    </p>
  </div>

  <div class="space-y-4">
    {#each tiers as tier (tier.id)}
      <TierCard
        {tier}
        onEdit={() => { editingTier = tier; showTierForm = true; }}
      />
    {/each}
  </div>

  <!-- Phase 1: Hide "Add Another Tier" button -->
  <!-- Phase 2: Show button -->

  <div class="flex justify-between pt-6">
    <Button variant="outline" onclick={onBack}>
      ← Back
    </Button>
    <Button onclick={onNext}>
      Finish & Publish →
    </Button>
  </div>
</div>

{#if showTierForm}
  <TierForm
    tier={editingTier}
    {eventId}
    onClose={() => { showTierForm = false; editingTier = null; }}
  />
{/if}
```

### 1.3 Create TierCard Component

**File**: `src/lib/components/events/admin/TierCard.svelte`

**Props**:
```typescript
interface Props {
  tier: TicketTierDetailSchema;
  onEdit: () => void;
  onDelete?: () => void; // Phase 2
}
```

**Features**:
- Display tier summary
- Edit button
- Visual status indicators (quantity, payment method)

**Implementation**:
```svelte
<script lang="ts">
  import { Button } from '$lib/components/ui/button';
  import { Card } from '$lib/components/ui/card';
  import { Edit } from 'lucide-svelte';

  let { tier, onEdit }: Props = $props();

  let priceDisplay = $derived(() => {
    if (tier.payment_method === 'free') return 'Free';
    if (tier.price_type === 'pwyc') {
      return `Pay What You Can ($${tier.pwyc_min} - ${tier.pwyc_max ? `$${tier.pwyc_max}` : 'any'})`;
    }
    return `$${tier.price.toFixed(2)}`;
  });

  let quantityDisplay = $derived(() => {
    if (tier.total_quantity === null) return 'Unlimited';
    return `${tier.total_available} of ${tier.total_quantity} remaining`;
  });
</script>

<Card class="p-4">
  <div class="flex items-start justify-between">
    <div class="flex-1">
      <div class="flex items-center gap-2">
        <h3 class="text-lg font-semibold">🎟️ {tier.name}</h3>
        {#if tier.name === 'General Admission'}
          <span class="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">Default</span>
        {/if}
      </div>

      <dl class="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <div>
          <dt class="text-muted-foreground">Price</dt>
          <dd class="font-medium">{priceDisplay()}</dd>
        </div>
        <div>
          <dt class="text-muted-foreground">Payment</dt>
          <dd class="font-medium capitalize">{tier.payment_method.replace('_', ' ')}</dd>
        </div>
        <div>
          <dt class="text-muted-foreground">Visibility</dt>
          <dd class="font-medium capitalize">{tier.visibility.replace('-', ' ')}</dd>
        </div>
        <div>
          <dt class="text-muted-foreground">Available to</dt>
          <dd class="font-medium capitalize">{tier.purchasable_by.replace('_', ' ')}</dd>
        </div>
        <div class="col-span-2">
          <dt class="text-muted-foreground">Quantity</dt>
          <dd class="font-medium">{quantityDisplay()}</dd>
        </div>
      </dl>

      {#if tier.description}
        <p class="mt-2 text-sm text-muted-foreground">{tier.description}</p>
      {/if}
    </div>

    <Button variant="ghost" size="icon" onclick={onEdit}>
      <Edit class="h-4 w-4" />
      <span class="sr-only">Edit {tier.name}</span>
    </Button>
  </div>
</Card>
```

### 1.4 Create TierForm Component (Phase 1: Edit Only)

**File**: `src/lib/components/events/admin/TierForm.svelte`

**Props**:
```typescript
interface Props {
  tier: TicketTierDetailSchema | null; // null = create new (Phase 2)
  eventId: string;
  onClose: () => void;
}
```

**Features (Phase 1)**:
- Edit existing tier only (create mode in Phase 2)
- Fields: name, description
- Payment method locked in Phase 1 (show as read-only)
- Save mutation

**Implementation**:
```svelte
<script lang="ts">
  import { createMutation, useQueryClient } from '@tanstack/svelte-query';
  import { eventadminUpdateTicketTier } from '$lib/api/generated/sdk.gen';
  import { Dialog } from '$lib/components/ui/dialog';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';
  import { Textarea } from '$lib/components/ui/textarea';

  let { tier, eventId, onClose }: Props = $props();

  const queryClient = useQueryClient();

  // Form state
  let name = $state(tier?.name ?? '');
  let description = $state(tier?.description ?? '');

  const updateMutation = createMutation({
    mutationFn: (data: TicketTierUpdateSchema) =>
      eventadminUpdateTicketTier({
        path: { event_id: eventId, tier_id: tier!.id },
        body: data
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event-admin', eventId, 'ticket-tiers'] });
      onClose();
    }
  });

  function handleSubmit(e: Event) {
    e.preventDefault();
    $updateMutation.mutate({ name, description });
  }
</script>

<Dialog open onOpenChange={onClose}>
  <form onsubmit={handleSubmit} class="space-y-4">
    <h2 class="text-xl font-bold">Edit Ticket Tier</h2>

    <div>
      <Label for="tier-name">Tier Name *</Label>
      <Input
        id="tier-name"
        bind:value={name}
        required
        maxlength={150}
        placeholder="e.g., General Admission, VIP Pass"
      />
    </div>

    <div>
      <Label for="tier-description">Description (optional)</Label>
      <Textarea
        id="tier-description"
        bind:value={description}
        rows={3}
        placeholder="What's included in this tier?"
      />
    </div>

    <!-- Phase 1: Show payment method as read-only -->
    <div>
      <Label>Payment Method</Label>
      <div class="p-3 bg-muted rounded-md text-sm capitalize">
        {tier?.payment_method.replace('_', ' ')}
      </div>
      <p class="text-xs text-muted-foreground mt-1">
        Payment method cannot be changed after tier is created
      </p>
    </div>

    <div class="flex justify-end gap-2">
      <Button type="button" variant="outline" onclick={onClose}>
        Cancel
      </Button>
      <Button type="submit" disabled={$updateMutation.isPending}>
        {$updateMutation.isPending ? 'Saving...' : 'Save Changes'}
      </Button>
    </div>

    {#if $updateMutation.isError}
      <p class="text-sm text-destructive" role="alert">
        Error saving tier. Please try again.
      </p>
    {/if}
  </form>
</Dialog>
```

### 1.5 Integrate Step 4 into EventWizard

**File**: `src/lib/components/events/admin/EventWizard.svelte`

**Changes**:
- Add Step 4 after resources step (if `requiresTicket === true`)
- Update step indicator (1/4, 2/4, 3/4, 4/4)
- Pass eventId to TicketingStep

**Implementation**:
```svelte
<script lang="ts">
  // Existing imports...
  import TicketingStep from './TicketingStep.svelte';

  let currentStep = $state<1 | 2 | 3 | 4>(1);
  let requiresTicket = $state(false);
  let defaultPaymentMethod = $state<'free' | 'offline' | 'at_the_door' | 'online'>('free');

  // Determine max step based on requires_ticket
  let maxStep = $derived(requiresTicket ? 4 : 3);
</script>

<div class="max-w-4xl mx-auto">
  <!-- Step indicator -->
  <div class="mb-8">
    <div class="text-sm text-muted-foreground">
      Step {currentStep} of {maxStep}
    </div>
    <div class="flex gap-2 mt-2">
      {#each Array.from({ length: maxStep }) as _, i}
        <div
          class="h-2 flex-1 rounded-full {i < currentStep ? 'bg-primary' : 'bg-muted'}"
        />
      {/each}
    </div>
  </div>

  <!-- Steps -->
  {#if currentStep === 1}
    <EssentialsStep
      onUpdate={(data) => {
        requiresTicket = data.requiresTicket;
        defaultPaymentMethod = data.defaultPaymentMethod;
      }}
      onNext={() => currentStep = 2}
    />
  {:else if currentStep === 2}
    <DetailsStep
      onBack={() => currentStep = 1}
      onNext={() => currentStep = 3}
    />
  {:else if currentStep === 3}
    <ResourcesStep
      onBack={() => currentStep = 2}
      onNext={() => {
        if (requiresTicket) {
          currentStep = 4;
        } else {
          handlePublish();
        }
      }}
    />
  {:else if currentStep === 4 && requiresTicket}
    <TicketingStep
      eventId={eventId!}
      {defaultPaymentMethod}
      onBack={() => currentStep = 3}
      onNext={handlePublish}
    />
  {/if}
</div>
```

### 1.6 Display Ticket Tiers on Event Detail Page

**File**: `src/routes/(public)/events/[org_slug]/[event_slug]/+page.svelte`

**Changes**:
- Fetch ticket tiers: `GET /api/events/{event_id}/tickets/tiers`
- Fetch user status: `GET /api/events/{event_id}/my-status`
- Display tiers IF event requires tickets
- Show "Get Ticket" button for FREE tiers
- Show "My Ticket" section if user already has ticket

**Implementation**:
```svelte
<script lang="ts">
  import { createQuery } from '@tanstack/svelte-query';
  import { eventListTicketTiers, eventGetMyEventStatus } from '$lib/api/generated/sdk.gen';
  import TicketTierList from '$lib/components/tickets/TicketTierList.svelte';
  import MyTicket from '$lib/components/tickets/MyTicket.svelte';

  let { data } = $props(); // From +page.server.ts
  const event = data.event;

  // Only fetch if event requires tickets
  let tiersQuery = createQuery({
    queryKey: ['event', event.id, 'ticket-tiers'],
    queryFn: () => eventListTicketTiers({ path: { event_id: event.id } }),
    enabled: event.requires_ticket
  });

  let statusQuery = createQuery({
    queryKey: ['event', event.id, 'my-status'],
    queryFn: () => eventGetMyEventStatus({ path: { event_id: event.id } }),
    enabled: event.requires_ticket && data.user !== null
  });

  let hasTicket = $derived(
    $statusQuery.data?.data && 'tier' in $statusQuery.data.data
  );
</script>

<div class="container mx-auto px-4 py-8">
  <!-- Event header, image, description... -->

  {#if event.requires_ticket}
    <div class="mt-12">
      {#if hasTicket}
        <MyTicket ticket={$statusQuery.data!.data} {event} />
      {:else}
        <TicketTierList
          tiers={$tiersQuery.data?.data?.results ?? []}
          {event}
          userStatus={$statusQuery.data?.data}
        />
      {/if}
    </div>
  {:else}
    <!-- RSVP section (existing code) -->
  {/if}
</div>
```

### 1.7 Create TicketTierList Component

**File**: `src/lib/components/tickets/TicketTierList.svelte`

**Props**:
```typescript
interface Props {
  tiers: TicketTierDetailSchema[];
  event: EventDetailSchema;
  userStatus: EventUserEligibility | null;
}
```

**Features (Phase 1)**:
- Display FREE tiers only
- "Get Ticket" button
- One-click claim (no modal)
- Sold out states

**Implementation**:
```svelte
<script lang="ts">
  import { createMutation, useQueryClient } from '@tanstack/svelte-query';
  import { eventCheckoutTicket } from '$lib/api/generated/sdk.gen';
  import TierCard from './TierCard.svelte';

  let { tiers, event, userStatus }: Props = $props();

  const queryClient = useQueryClient();

  const checkoutMutation = createMutation({
    mutationFn: (tierId: string) =>
      eventCheckoutTicket({
        path: { event_id: event.id, tier_id: tierId }
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event', event.id, 'my-status'] });
      queryClient.invalidateQueries({ queryKey: ['event', event.id, 'ticket-tiers'] });
    }
  });

  let visibleTiers = $derived(
    tiers.filter(tier => {
      // Phase 1: Show only FREE tiers
      if (tier.payment_method !== 'free') return false;

      // Filter by visibility (public only for now)
      if (tier.visibility !== 'public') return false;

      // Don't show sold out tiers
      if (tier.total_available === 0) return false;

      return true;
    })
  );
</script>

<div>
  <h2 class="text-2xl font-bold mb-4">🎟️ Get Your Ticket</h2>

  {#if visibleTiers.length === 0}
    <p class="text-muted-foreground">
      Tickets are not currently available for this event.
    </p>
  {:else}
    <div class="space-y-4">
      {#each visibleTiers as tier (tier.id)}
        <TierCard
          {tier}
          onPurchase={() => $checkoutMutation.mutate(tier.id)}
          isLoading={$checkoutMutation.isPending}
        />
      {/each}
    </div>
  {/if}

  {#if $checkoutMutation.isError}
    <div class="mt-4 p-4 bg-destructive/10 text-destructive rounded-lg" role="alert">
      Unable to claim ticket. Please try again.
    </div>
  {/if}
</div>
```

### 1.8 Create TierCard Component (Attendee-Facing)

**File**: `src/lib/components/tickets/TierCard.svelte`

**Props**:
```typescript
interface Props {
  tier: TicketTierDetailSchema;
  onPurchase: () => void;
  isLoading: boolean;
}
```

**Implementation**:
```svelte
<script lang="ts">
  import { Button } from '$lib/components/ui/button';
  import { Card } from '$lib/components/ui/card';

  let { tier, onPurchase, isLoading }: Props = $props();

  let availabilityText = $derived(() => {
    if (tier.total_quantity === null) return 'Available';
    const remaining = tier.total_available ?? 0;
    if (remaining === 0) return 'Sold Out';
    return `${remaining} of ${tier.total_quantity} remaining`;
  });
</script>

<Card class="p-6 hover:shadow-lg transition-shadow">
  <div class="flex items-start justify-between gap-4">
    <div class="flex-1">
      <h3 class="text-xl font-semibold">{tier.name}</h3>

      <div class="mt-2">
        <span class="text-3xl font-bold">Free</span>
      </div>

      {#if tier.description}
        <p class="mt-3 text-muted-foreground">{tier.description}</p>
      {/if}

      <div class="mt-4 flex items-center gap-3 text-sm">
        <span class="text-muted-foreground">{availabilityText()}</span>
        <span class="text-muted-foreground">·</span>
        <span class="text-muted-foreground">Public</span>
      </div>
    </div>

    <Button
      onclick={onPurchase}
      disabled={isLoading || tier.total_available === 0}
      class="min-w-[140px]"
    >
      {#if isLoading}
        Claiming...
      {:else if tier.total_available === 0}
        Sold Out
      {:else}
        Get Ticket →
      {/if}
    </Button>
  </div>
</Card>
```

### 1.9 Create MyTicket Component

**File**: `src/lib/components/tickets/MyTicket.svelte`

**Props**:
```typescript
interface Props {
  ticket: EventTicketSchema;
  event: EventDetailSchema;
}
```

**Features (Phase 1)**:
- Display ticket info
- QR code (using static server-generated image for now)
- Status badge

**Implementation**:
```svelte
<script lang="ts">
  import { Card } from '$lib/components/ui/card';
  import { Button } from '$lib/components/ui/button';
  import TicketStatusBadge from './TicketStatusBadge.svelte';

  let { ticket, event }: Props = $props();

  // Phase 1: Use static QR code URL from backend
  // Phase 2: Generate client-side using qrcode library
  let qrCodeUrl = $derived(`/api/tickets/${ticket.id}/qr`);

  let purchaseDate = $derived(() => {
    const date = new Date(ticket.created_at || '');
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  });
</script>

<div>
  <h2 class="text-2xl font-bold mb-4">🎟️ Your Ticket</h2>

  <Card class="p-8">
    <div class="text-center space-y-4">
      {#if ticket.status === 'active' || ticket.status === 'checked_in'}
        <!-- QR Code -->
        <div class="inline-block p-4 bg-white rounded-lg">
          <img
            src={qrCodeUrl}
            alt="Ticket QR code: {ticket.id}"
            class="w-64 h-64 mx-auto"
          />
        </div>
      {/if}

      <div>
        <h3 class="text-xl font-semibold">{ticket.tier?.name}</h3>
        <p class="text-sm text-muted-foreground">
          Claimed {purchaseDate()}
        </p>
      </div>

      <TicketStatusBadge status={ticket.status} />

      {#if ticket.status === 'pending'}
        <div class="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-left">
          <h4 class="font-semibold text-yellow-900">Payment Pending</h4>
          <p class="text-sm text-yellow-800 mt-1">
            Your ticket is reserved. Payment confirmation is in progress.
          </p>
        </div>
      {/if}

      <div class="flex justify-center gap-2 mt-6">
        <Button variant="outline">View Details</Button>
        <Button variant="outline">Download</Button>
      </div>
    </div>
  </Card>
</div>
```

### 1.10 Create TicketStatusBadge Component

**File**: `src/lib/components/tickets/TicketStatusBadge.svelte`

**Props**:
```typescript
interface Props {
  status: 'pending' | 'active' | 'checked_in' | 'cancelled';
}
```

**Implementation**:
```svelte
<script lang="ts">
  let { status }: Props = $props();

  let badgeClass = $derived(() => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'active': return 'bg-green-100 text-green-800';
      case 'checked_in': return 'bg-blue-100 text-blue-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  });

  let badgeIcon = $derived(() => {
    switch (status) {
      case 'pending': return '⏳';
      case 'active': return '✅';
      case 'checked_in': return '🎉';
      case 'cancelled': return '❌';
      default: return '●';
    }
  });

  let badgeText = $derived(() => {
    switch (status) {
      case 'pending': return 'Awaiting Payment';
      case 'active': return 'Active';
      case 'checked_in': return 'Checked In';
      case 'cancelled': return 'Cancelled';
      default: return status;
    }
  });
</script>

<span
  class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium {badgeClass()}"
  role="status"
  aria-label="Ticket status: {badgeText()}"
>
  <span aria-hidden="true">{badgeIcon()}</span>
  {badgeText()}
</span>
```

### 1.11 Testing Phase 1

**Manual Testing Checklist**:
- [ ] Create new event with "Requires Ticket" enabled
- [ ] Verify Step 4 appears in wizard
- [ ] Edit "General Admission" tier name and description
- [ ] Publish event
- [ ] View event detail page as attendee
- [ ] Verify tier displayed with "Get Ticket" button
- [ ] Click "Get Ticket" → Ticket claimed
- [ ] Verify "My Ticket" section appears
- [ ] Verify QR code displayed (or placeholder)
- [ ] Test on mobile viewport (responsive design)
- [ ] Test keyboard navigation
- [ ] Run accessibility audit (use accessibility-checker subagent)

**E2E Test** (create later):
```typescript
// tests/e2e/ticketing/free-tickets.spec.ts
test('organizer creates event with free tickets', async ({ page }) => {
  // Login as organizer
  await page.goto('/org/test-org/admin/events/new');

  // Step 1: Enable tickets
  await page.check('input[value="ticket"]');
  await page.selectOption('#payment-method', 'free');
  await page.click('button:has-text("Next")');

  // Steps 2-3...

  // Step 4: Ticketing
  await expect(page.locator('h2:has-text("Configure Ticket Tiers")')).toBeVisible();
  await page.click('button:has-text("Edit")');
  await page.fill('#tier-name', 'Free Entry');
  await page.click('button:has-text("Save")');

  // Publish
  await page.click('button:has-text("Finish & Publish")');

  // Verify event published
  await expect(page).toHaveURL(/\/events\/.+/);
});

test('attendee claims free ticket', async ({ page }) => {
  // Navigate to event
  await page.goto('/events/test-org/test-event');

  // Claim ticket
  await page.click('button:has-text("Get Ticket")');

  // Verify success
  await expect(page.locator('h2:has-text("Your Ticket")')).toBeVisible();
  await expect(page.locator('img[alt*="QR code"]')).toBeVisible();
});
```

---

## Phase 2: Paid Tickets (OFFLINE & AT_THE_DOOR)

**Goal**: Support paid events with offline/at-door payment methods

**Estimated Time**: 12-14 hours

### 2.1 Extend TierForm - Create New Tiers

**File**: `src/lib/components/events/admin/TierForm.svelte`

**Changes**:
- Support create mode (`tier === null`)
- Add all payment method options
- Add price input (for non-FREE)
- Add manual payment instructions field (for OFFLINE)
- Add visibility selector
- Add purchasable_by selector
- Add quantity limit input
- Create mutation

**New Fields**:
```svelte
<script lang="ts">
  let paymentMethod = $state<'free' | 'offline' | 'at_the_door' | 'online'>(
    tier?.payment_method ?? 'free'
  );
  let price = $state(tier?.price ?? 0);
  let visibility = $state(tier?.visibility ?? 'public');
  let purchasableBy = $state(tier?.purchasable_by ?? 'public');
  let totalQuantity = $state<number | null>(tier?.total_quantity ?? null);
  let isUnlimited = $state(totalQuantity === null);
  let manualPaymentInstructions = $state(tier?.manual_payment_instructions ?? '');

  // Validation
  let showPaymentInstructions = $derived(paymentMethod === 'offline');
  let showPrice = $derived(paymentMethod !== 'free');

  const createMutation = createMutation({
    mutationFn: (data: TicketTierCreateSchema) =>
      eventadminCreateTicketTier({
        path: { event_id: eventId },
        body: data
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event-admin', eventId, 'ticket-tiers'] });
      onClose();
    }
  });

  function handleSubmit(e: Event) {
    e.preventDefault();

    const data: TicketTierCreateSchema | TicketTierUpdateSchema = {
      name,
      description: description || null,
      payment_method: paymentMethod,
      visibility,
      purchasable_by: purchasableBy,
      price_type: 'fixed', // Phase 3: Add PWYC
      price,
      currency: 'USD',
      total_quantity: isUnlimited ? null : totalQuantity,
      manual_payment_instructions: paymentMethod === 'offline' ? manualPaymentInstructions : null
    };

    if (tier) {
      $updateMutation.mutate(data);
    } else {
      $createMutation.mutate(data);
    }
  }
</script>

<!-- Add fields -->
<div>
  <Label for="payment-method">Payment Method *</Label>
  <select
    id="payment-method"
    bind:value={paymentMethod}
    disabled={tier !== null} <!-- Cannot change after creation -->
    class="w-full rounded-md border px-3 py-2"
    required
  >
    <option value="free">FREE (No payment required)</option>
    <option value="offline">OFFLINE (Manual payment confirmation)</option>
    <option value="at_the_door">AT THE DOOR (Pay at event entrance)</option>
    <option value="online" disabled={!orgStripeConnected}>
      ONLINE (Stripe) {#if !orgStripeConnected}⚠️ Not connected{/if}
    </option>
  </select>
  {#if tier}
    <p class="text-xs text-muted-foreground mt-1">
      Payment method cannot be changed after tier is created
    </p>
  {/if}
</div>

{#if showPrice}
  <div>
    <Label for="price">Price *</Label>
    <div class="flex items-center gap-2">
      <span class="text-lg">$</span>
      <Input
        id="price"
        type="number"
        bind:value={price}
        min={paymentMethod === 'online' ? 1 : 0}
        step="0.01"
        required
      />
    </div>
    {#if paymentMethod === 'online'}
      <p class="text-xs text-muted-foreground mt-1">
        Minimum $1.00 for online payments
      </p>
    {/if}
  </div>
{/if}

{#if showPaymentInstructions}
  <div>
    <Label for="payment-instructions">Payment Instructions *</Label>
    <Textarea
      id="payment-instructions"
      bind:value={manualPaymentInstructions}
      rows={4}
      required
      maxlength={1000}
      placeholder="Example: Bank transfer to Account 1234-5678, Reference: [Your Name]"
    />
    <p class="text-xs text-muted-foreground mt-1">
      Attendees will see these instructions after reserving a ticket
    </p>
  </div>
{/if}

<div>
  <Label for="visibility">Visibility</Label>
  <select id="visibility" bind:value={visibility} class="w-full rounded-md border px-3 py-2">
    <option value="public">Public (Everyone can see)</option>
    <option value="members-only">Members Only</option>
    <option value="staff-only">Staff Only</option>
    <option value="private">Private (Invisible)</option>
  </select>
</div>

<div>
  <Label for="purchasable-by">Available To</Label>
  <select id="purchasable-by" bind:value={purchasableBy} class="w-full rounded-md border px-3 py-2">
    <option value="public">Everyone</option>
    <option value="members">Members Only</option>
    <option value="invited">Invited Only</option>
    <option value="invited_and_members">Invited & Members</option>
  </select>
</div>

<div>
  <Label>Quantity Limit</Label>
  <div class="space-y-2">
    <label class="flex items-center">
      <input
        type="radio"
        name="quantity-type"
        checked={isUnlimited}
        onchange={() => { isUnlimited = true; totalQuantity = null; }}
        class="mr-2"
      />
      Unlimited
    </label>
    <label class="flex items-center">
      <input
        type="radio"
        name="quantity-type"
        checked={!isUnlimited}
        onchange={() => { isUnlimited = false; totalQuantity = 100; }}
        class="mr-2"
      />
      Limited
    </label>
    {#if !isUnlimited}
      <Input
        type="number"
        bind:value={totalQuantity}
        min={1}
        required={!isUnlimited}
        class="ml-6"
      />
    {/if}
  </div>
</div>
```

### 2.2 Add "Add Another Tier" Button

**File**: `src/lib/components/events/admin/TicketingStep.svelte`

**Changes**:
- Unhide "Add Another Tier" button
- Click opens TierForm in create mode

```svelte
<button
  type="button"
  onclick={() => { editingTier = null; showTierForm = true; }}
  class="w-full border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 hover:border-muted-foreground/50 transition-colors"
>
  <span class="text-lg">+ Add Another Tier</span>
  <p class="text-sm text-muted-foreground mt-1">
    Create VIP, Student, Early Bird, or other ticket types
  </p>
</button>
```

### 2.3 Display OFFLINE/AT_THE_DOOR Tiers

**File**: `src/lib/components/tickets/TierCard.svelte` (attendee-facing)

**Changes**:
- Show price for non-FREE tiers
- Different CTA text: "Reserve Ticket" instead of "Get Ticket"
- Open modal for OFFLINE/AT_THE_DOOR tiers

```svelte
<script lang="ts">
  let priceDisplay = $derived(() => {
    if (tier.payment_method === 'free') return 'Free';
    return `$${tier.price.toFixed(2)}`;
  });

  let ctaText = $derived(() => {
    if (tier.payment_method === 'free') return 'Get Ticket →';
    if (tier.payment_method === 'offline') return 'Reserve Ticket →';
    if (tier.payment_method === 'at_the_door') return 'Reserve Now →';
    return 'Buy Ticket →'; // ONLINE
  });
</script>

<div class="mt-2">
  <span class="text-3xl font-bold">{priceDisplay()}</span>
</div>

<Button onclick={onPurchase}>
  {ctaText()}
</Button>
```

### 2.4 Create PurchaseModal Component

**File**: `src/lib/components/tickets/PurchaseModal.svelte`

**Props**:
```typescript
interface Props {
  tier: TicketTierDetailSchema;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading: boolean;
}
```

**Features**:
- OFFLINE: Show payment instructions
- AT_THE_DOOR: Explain payment at entrance
- Confirm button

**Implementation**:
```svelte
<script lang="ts">
  import { Dialog } from '$lib/components/ui/dialog';
  import { Button } from '$lib/components/ui/button';

  let { tier, onConfirm, onCancel, isLoading }: Props = $props();

  let modalTitle = $derived(() => {
    if (tier.payment_method === 'offline') return 'Reserve Ticket - Offline Payment';
    if (tier.payment_method === 'at_the_door') return 'Reserve Ticket - Pay at the Door';
    return tier.name;
  });
</script>

<Dialog open onOpenChange={onCancel}>
  <div class="space-y-4">
    <h2 class="text-xl font-bold">{modalTitle()}</h2>

    <div>
      <p class="text-sm text-muted-foreground">Tier</p>
      <p class="font-semibold">{tier.name}</p>
    </div>

    <div>
      <p class="text-sm text-muted-foreground">Price</p>
      <p class="text-2xl font-bold">${tier.price.toFixed(2)}</p>
    </div>

    {#if tier.payment_method === 'offline'}
      <div class="p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h3 class="font-semibold text-blue-900 flex items-center gap-2">
          <span>ℹ️</span> Payment Instructions
        </h3>
        <div class="mt-2 text-sm text-blue-800 whitespace-pre-wrap">
          {tier.manual_payment_instructions}
        </div>
        <p class="mt-3 text-sm text-blue-800">
          Your ticket will be confirmed once payment is received.
        </p>
      </div>
    {:else if tier.payment_method === 'at_the_door'}
      <div class="p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h3 class="font-semibold text-blue-900 flex items-center gap-2">
          <span>ℹ️</span> How It Works
        </h3>
        <ul class="mt-2 text-sm text-blue-800 space-y-1 list-disc list-inside">
          <li>Your ticket will be reserved</li>
          <li>Pay ${tier.price.toFixed(2)} at event entrance</li>
          <li>Show your QR code to check in</li>
        </ul>
        <p class="mt-3 text-sm text-blue-800">
          Your reservation is held until the event starts.
        </p>
      </div>
    {/if}

    <div class="flex justify-end gap-2 pt-4">
      <Button type="button" variant="outline" onclick={onCancel}>
        Cancel
      </Button>
      <Button onclick={onConfirm} disabled={isLoading}>
        {isLoading ? 'Reserving...' : 'Reserve Ticket →'}
      </Button>
    </div>
  </div>
</Dialog>
```

### 2.5 Update TicketTierList - Show Purchase Modal

**File**: `src/lib/components/tickets/TicketTierList.svelte`

**Changes**:
- Filter to show OFFLINE and AT_THE_DOOR tiers
- Click tier → Open modal
- Confirm → Call checkout API

```svelte
<script lang="ts">
  let selectedTier = $state<TicketTierDetailSchema | null>(null);
  let showPurchaseModal = $state(false);

  function handleTierClick(tier: TicketTierDetailSchema) {
    if (tier.payment_method === 'free') {
      // Immediate claim (no modal)
      $checkoutMutation.mutate(tier.id);
    } else {
      // Show modal for OFFLINE/AT_THE_DOOR
      selectedTier = tier;
      showPurchaseModal = true;
    }
  }

  function handleConfirmPurchase() {
    if (selectedTier) {
      $checkoutMutation.mutate(selectedTier.id);
      showPurchaseModal = false;
      selectedTier = null;
    }
  }

  let visibleTiers = $derived(
    tiers.filter(tier => {
      // Phase 2: Show FREE, OFFLINE, AT_THE_DOOR
      if (!['free', 'offline', 'at_the_door'].includes(tier.payment_method)) {
        return false;
      }

      // ... rest of filtering logic
    })
  );
</script>

{#each visibleTiers as tier (tier.id)}
  <TierCard
    {tier}
    onPurchase={() => handleTierClick(tier)}
    isLoading={$checkoutMutation.isPending}
  />
{/each}

{#if showPurchaseModal && selectedTier}
  <PurchaseModal
    tier={selectedTier}
    onConfirm={handleConfirmPurchase}
    onCancel={() => { showPurchaseModal = false; selectedTier = null; }}
    isLoading={$checkoutMutation.isPending}
  />
{/if}
```

### 2.6 Update MyTicket - Show Payment Instructions for PENDING

**File**: `src/lib/components/tickets/MyTicket.svelte`

**Changes**:
- Show payment instructions if status === 'pending'
- Hide QR code for pending tickets

```svelte
{#if ticket.status === 'pending'}
  <div class="mt-6 p-6 bg-yellow-50 border border-yellow-200 rounded-lg text-left space-y-3">
    <h4 class="font-semibold text-yellow-900 flex items-center gap-2">
      <span>⏳</span> Payment Pending
    </h4>

    {#if ticket.tier?.payment_method === 'offline' && ticket.tier.manual_payment_instructions}
      <div class="text-sm text-yellow-800">
        <p class="font-medium mb-2">Payment Instructions:</p>
        <div class="whitespace-pre-wrap bg-yellow-100 p-3 rounded">
          {ticket.tier.manual_payment_instructions}
        </div>
      </div>
      <p class="text-sm text-yellow-800">
        Once payment is received, your ticket will be activated and QR code will be available.
      </p>
    {:else if ticket.tier?.payment_method === 'at_the_door'}
      <p class="text-sm text-yellow-800">
        Your ticket is reserved. Pay ${ticket.tier.price.toFixed(2)} at the event entrance.
      </p>
    {/if}

    <Button variant="outline" size="sm">Contact Organizer</Button>
  </div>
{/if}
```

### 2.7 Create Admin Pending Tickets Page

**File**: `src/routes/(auth)/org/[slug]/admin/events/[event_slug]/tickets/+page.svelte`

**Route**: `/org/[slug]/admin/events/[event_slug]/tickets`

**Authentication**: Check permissions in `+page.server.ts`

**Features**:
- List pending tickets
- Confirm payment
- Cancel ticket
- Search/filter

**Implementation**:
```svelte
<script lang="ts">
  import { createQuery, createMutation, useQueryClient } from '@tanstack/svelte-query';
  import {
    eventadminListPendingTickets,
    eventadminConfirmPayment,
    eventadminCancelTicket
  } from '$lib/api/generated/sdk.gen';
  import { page } from '$app/stores';
  import PendingTicketRow from '$lib/components/tickets/admin/PendingTicketRow.svelte';
  import ConfirmPaymentDialog from '$lib/components/tickets/admin/ConfirmPaymentDialog.svelte';

  let { data } = $props();
  const eventId = data.event.id;

  const queryClient = useQueryClient();

  let pendingQuery = createQuery({
    queryKey: ['event-admin', eventId, 'pending-tickets'],
    queryFn: () => eventadminListPendingTickets({ path: { event_id: eventId } })
  });

  let confirmingTicket = $state<PendingTicketSchema | null>(null);
  let showConfirmDialog = $state(false);

  const confirmMutation = createMutation({
    mutationFn: (ticketId: string) =>
      eventadminConfirmPayment({ path: { event_id: eventId, ticket_id: ticketId } }),
    onMutate: async (ticketId) => {
      await queryClient.cancelQueries({ queryKey: ['event-admin', eventId, 'pending-tickets'] });
      const previousTickets = queryClient.getQueryData(['event-admin', eventId, 'pending-tickets']);

      queryClient.setQueryData(['event-admin', eventId, 'pending-tickets'], (old) =>
        old?.data?.results?.filter(t => t.id !== ticketId)
      );

      return { previousTickets };
    },
    onError: (err, variables, context) => {
      queryClient.setQueryData(['event-admin', eventId, 'pending-tickets'], context?.previousTickets);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['event-admin', eventId, 'pending-tickets'] });
      showConfirmDialog = false;
      confirmingTicket = null;
    }
  });

  function handleConfirmClick(ticket: PendingTicketSchema) {
    confirmingTicket = ticket;
    showConfirmDialog = true;
  }

  function handleConfirm() {
    if (confirmingTicket) {
      $confirmMutation.mutate(confirmingTicket.id);
    }
  }

  let pendingTickets = $derived($pendingQuery.data?.data?.results ?? []);
</script>

<div class="container mx-auto px-4 py-8">
  <div class="flex items-center justify-between mb-6">
    <div>
      <h1 class="text-3xl font-bold">Ticket Management</h1>
      <p class="text-muted-foreground">{data.event.name}</p>
    </div>
    <a href="/org/{data.organization.slug}/admin/events/{data.event.slug}">
      <Button variant="outline">← Back to Event</Button>
    </a>
  </div>

  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <h2 class="text-xl font-semibold">
        Pending Payments ({pendingTickets.length})
      </h2>
    </div>

    {#if pendingTickets.length === 0}
      <div class="text-center py-12 text-muted-foreground">
        No pending tickets
      </div>
    {:else}
      <!-- Desktop: Table -->
      <div class="hidden md:block">
        <table class="w-full">
          <thead>
            <tr class="border-b">
              <th class="text-left p-3">User</th>
              <th class="text-left p-3">Tier</th>
              <th class="text-left p-3">Amount</th>
              <th class="text-left p-3">Date Requested</th>
              <th class="text-right p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {#each pendingTickets as ticket (ticket.id)}
              <PendingTicketRow
                {ticket}
                onConfirm={() => handleConfirmClick(ticket)}
                layout="table"
              />
            {/each}
          </tbody>
        </table>
      </div>

      <!-- Mobile: Cards -->
      <div class="md:hidden space-y-4">
        {#each pendingTickets as ticket (ticket.id)}
          <PendingTicketRow
            {ticket}
            onConfirm={() => handleConfirmClick(ticket)}
            layout="card"
          />
        {/each}
      </div>
    {/if}
  </div>
</div>

{#if showConfirmDialog && confirmingTicket}
  <ConfirmPaymentDialog
    ticket={confirmingTicket}
    onConfirm={handleConfirm}
    onCancel={() => { showConfirmDialog = false; confirmingTicket = null; }}
    isLoading={$confirmMutation.isPending}
  />
{/if}
```

### 2.8 Add +page.server.ts for Permission Check

**File**: `src/routes/(auth)/org/[slug]/admin/events/[event_slug]/tickets/+page.server.ts`

```typescript
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals, parent }) => {
  const { event, organization } = await parent();

  // Check permissions
  const user = locals.user;
  if (!user) {
    throw error(401, 'Unauthorized');
  }

  // Check if user is owner or has manage_tickets permission
  const isOwner = organization.owner_id === user.id;
  const hasPermission = user.permissions?.[organization.id]?.includes('manage_tickets');

  if (!isOwner && !hasPermission) {
    throw error(403, 'You do not have permission to manage tickets for this event');
  }

  return {
    event,
    organization
  };
};
```

### 2.9 Create PendingTicketRow Component

**File**: `src/lib/components/tickets/admin/PendingTicketRow.svelte`

**Props**:
```typescript
interface Props {
  ticket: PendingTicketSchema;
  onConfirm: () => void;
  layout: 'table' | 'card';
}
```

**Implementation**:
```svelte
<script lang="ts">
  import { Button } from '$lib/components/ui/button';
  import { Card } from '$lib/components/ui/card';

  let { ticket, onConfirm, layout }: Props = $props();

  let dateDisplay = $derived(() => {
    const date = new Date(ticket.created_at);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  });
</script>

{#if layout === 'table'}
  <tr class="border-b hover:bg-muted/50">
    <td class="p-3">
      <div>
        <p class="font-medium">{ticket.user.first_name} {ticket.user.last_name}</p>
        <p class="text-sm text-muted-foreground">{ticket.user.email}</p>
      </div>
    </td>
    <td class="p-3">
      <p class="font-medium">{ticket.tier.name}</p>
      {#if ticket.tier.payment_method === 'offline'}
        <p class="text-xs text-muted-foreground">OFFLINE</p>
      {:else}
        <p class="text-xs text-muted-foreground">AT THE DOOR</p>
      {/if}
    </td>
    <td class="p-3">
      ${ticket.tier.price.toFixed(2)}
    </td>
    <td class="p-3 text-sm text-muted-foreground">
      {dateDisplay()}
    </td>
    <td class="p-3 text-right">
      <div class="flex justify-end gap-2">
        <Button size="sm" onclick={onConfirm}>
          Confirm
        </Button>
        <Button size="sm" variant="outline">
          Cancel
        </Button>
        <Button size="sm" variant="ghost">
          Contact
        </Button>
      </div>
    </td>
  </tr>
{:else}
  <Card class="p-4">
    <div class="space-y-3">
      <div>
        <p class="font-semibold">{ticket.user.first_name} {ticket.user.last_name}</p>
        <p class="text-sm text-muted-foreground">{ticket.user.email}</p>
      </div>

      <div class="flex items-center justify-between">
        <div>
          <p class="font-medium">{ticket.tier.name}</p>
          <p class="text-sm text-muted-foreground capitalize">
            {ticket.tier.payment_method.replace('_', ' ')}
          </p>
        </div>
        <p class="text-lg font-bold">${ticket.tier.price.toFixed(2)}</p>
      </div>

      <p class="text-sm text-muted-foreground">{dateDisplay()}</p>

      <div class="flex flex-col gap-2">
        <Button size="sm" onclick={onConfirm} class="w-full">
          Confirm Payment
        </Button>
        <div class="flex gap-2">
          <Button size="sm" variant="outline" class="flex-1">
            Cancel
          </Button>
          <Button size="sm" variant="outline" class="flex-1">
            Contact
          </Button>
        </div>
      </div>
    </div>
  </Card>
{/if}
```

### 2.10 Create ConfirmPaymentDialog Component

**File**: `src/lib/components/tickets/admin/ConfirmPaymentDialog.svelte`

**Props**:
```typescript
interface Props {
  ticket: PendingTicketSchema;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading: boolean;
}
```

**Implementation**:
```svelte
<script lang="ts">
  import { Dialog } from '$lib/components/ui/dialog';
  import { Button } from '$lib/components/ui/button';

  let { ticket, onConfirm, onCancel, isLoading }: Props = $props();
</script>

<Dialog open onOpenChange={onCancel}>
  <div class="space-y-4">
    <h2 class="text-xl font-bold">Confirm Payment Received</h2>

    <p>Mark {ticket.user.first_name} {ticket.user.last_name}'s payment as received?</p>

    <dl class="grid grid-cols-2 gap-2 text-sm">
      <dt class="text-muted-foreground">Tier</dt>
      <dd class="font-medium">{ticket.tier.name}</dd>

      <dt class="text-muted-foreground">Amount</dt>
      <dd class="font-medium">${ticket.tier.price.toFixed(2)}</dd>
    </dl>

    <div class="p-3 bg-blue-50 border border-blue-200 rounded text-sm">
      <p class="font-medium">This will:</p>
      <ul class="mt-1 space-y-1 list-disc list-inside text-blue-800">
        <li>Change ticket status to ACTIVE</li>
        <li>Generate QR code for check-in</li>
        <li>Send confirmation email to {ticket.user.email}</li>
      </ul>
    </div>

    <div class="flex justify-end gap-2 pt-4">
      <Button variant="outline" onclick={onCancel} disabled={isLoading}>
        Cancel
      </Button>
      <Button onclick={onConfirm} disabled={isLoading}>
        {isLoading ? 'Confirming...' : 'Confirm Payment'}
      </Button>
    </div>
  </div>
</Dialog>
```

### 2.11 Add Pending Ticket Badge to Event Dashboard

**File**: `src/routes/(auth)/org/[slug]/admin/events/[event_slug]/+page.svelte`

**Changes**:
- Fetch pending tickets count
- Show badge if count > 0
- Link to tickets page

```svelte
<script lang="ts">
  let pendingQuery = createQuery({
    queryKey: ['event-admin', event.id, 'pending-tickets'],
    queryFn: () => eventadminListPendingTickets({ path: { event_id: event.id } })
  });

  let pendingCount = $derived($pendingQuery.data?.data?.results?.length ?? 0);
</script>

<!-- Event dashboard -->
<div class="space-y-4">
  {#if pendingCount > 0}
    <div class="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
      <div class="flex items-center justify-between">
        <div>
          <h3 class="font-semibold text-yellow-900">
            Pending Tickets: {pendingCount} ⚠️
          </h3>
          <p class="text-sm text-yellow-800">
            {pendingCount} {pendingCount === 1 ? 'ticket' : 'tickets'} awaiting payment confirmation
          </p>
        </div>
        <a href="/org/{organization.slug}/admin/events/{event.slug}/tickets">
          <Button>Review Payments →</Button>
        </a>
      </div>
    </div>
  {/if}

  <!-- Rest of dashboard -->
</div>
```

### 2.12 Testing Phase 2

**Manual Testing Checklist**:
- [ ] Create event with OFFLINE payment tier
- [ ] Add payment instructions
- [ ] Reserve OFFLINE ticket as attendee
- [ ] Verify modal shows payment instructions
- [ ] Verify ticket status is PENDING
- [ ] Verify payment instructions displayed on My Ticket
- [ ] Login as admin
- [ ] Verify pending ticket appears in admin panel
- [ ] Confirm payment
- [ ] Verify ticket status changes to ACTIVE
- [ ] Verify QR code now visible
- [ ] Test AT_THE_DOOR payment method
- [ ] Test on mobile (table → cards)
- [ ] Run accessibility audit

---

## Phase 3: Advanced Features (PWYC, Restrictions, Sales Windows)

**Goal**: Add pay-what-you-can pricing, tier restrictions, and sales windows

**Estimated Time**: 8-10 hours

### 3.1 Add PWYC Support to TierForm

**File**: `src/lib/components/events/admin/TierForm.svelte`

**Changes**:
- Add price type radio buttons (Fixed / PWYC)
- Show PWYC min/max inputs when PWYC selected

```svelte
<div>
  <Label>Price Type</Label>
  <div class="space-y-3">
    <label class="flex items-center">
      <input
        type="radio"
        name="price-type"
        value="fixed"
        bind:group={priceType}
        class="mr-2"
      />
      Fixed Price
    </label>

    {#if priceType === 'fixed' && showPrice}
      <div class="ml-6">
        <Label for="price">Price *</Label>
        <div class="flex items-center gap-2">
          <span class="text-lg">$</span>
          <Input
            id="price"
            type="number"
            bind:value={price}
            min={paymentMethod === 'online' ? 1 : 0}
            step="0.01"
            required
          />
        </div>
      </div>
    {/if}

    <label class="flex items-center">
      <input
        type="radio"
        name="price-type"
        value="pwyc"
        bind:group={priceType}
        class="mr-2"
      />
      Pay What You Can (PWYC)
    </label>

    {#if priceType === 'pwyc'}
      <div class="ml-6 space-y-3">
        <div>
          <Label for="pwyc-min">Minimum Amount *</Label>
          <div class="flex items-center gap-2">
            <span class="text-lg">$</span>
            <Input
              id="pwyc-min"
              type="number"
              bind:value={pwycMin}
              min={1}
              step="0.01"
              required
            />
          </div>
        </div>

        <div>
          <Label for="pwyc-max">Maximum Amount (optional)</Label>
          <div class="flex items-center gap-2">
            <span class="text-lg">$</span>
            <Input
              id="pwyc-max"
              type="number"
              bind:value={pwycMax}
              min={pwycMin || 1}
              step="0.01"
            />
          </div>
          <p class="text-xs text-muted-foreground mt-1">
            Leave empty for no maximum
          </p>
        </div>
      </div>
    {/if}
  </div>
</div>
```

### 3.2 Add Sales Window to TierForm

**File**: `src/lib/components/events/admin/TierForm.svelte`

**Changes**:
- Add collapsible "Sales Window" section
- Date/time pickers for sales_start_at and sales_end_at

```svelte
<details class="border rounded-lg p-4">
  <summary class="font-medium cursor-pointer">
    Sales Window (Optional)
  </summary>

  <div class="mt-4 space-y-3">
    <div>
      <Label for="sales-start">Sales Start Date & Time</Label>
      <input
        id="sales-start"
        type="datetime-local"
        bind:value={salesStartAt}
        class="w-full rounded-md border px-3 py-2"
      />
      <p class="text-xs text-muted-foreground mt-1">
        When ticket sales begin for this tier
      </p>
    </div>

    <div>
      <Label for="sales-end">Sales End Date & Time</Label>
      <input
        id="sales-end"
        type="datetime-local"
        bind:value={salesEndAt}
        min={salesStartAt}
        class="w-full rounded-md border px-3 py-2"
      />
      <p class="text-xs text-muted-foreground mt-1">
        When ticket sales end for this tier
      </p>
    </div>
  </div>
</details>
```

### 3.3 Add PWYC Purchase Modal

**File**: `src/lib/components/tickets/PurchaseModal.svelte`

**Changes**:
- Detect PWYC tier
- Show price slider + input
- Validate amount is between min and max

```svelte
{#if tier.price_type === 'pwyc'}
  <div class="space-y-4">
    <div>
      <Label for="pwyc-amount">Choose Amount</Label>
      <p class="text-sm text-muted-foreground">
        Choose an amount between ${tier.pwyc_min.toFixed(2)}
        {#if tier.pwyc_max} and ${tier.pwyc_max.toFixed(2)}{/if}
      </p>
    </div>

    <div class="space-y-2">
      <div class="flex items-center gap-2">
        <span class="text-lg">$</span>
        <Input
          id="pwyc-amount"
          type="number"
          bind:value={pwycAmount}
          min={tier.pwyc_min}
          max={tier.pwyc_max ?? undefined}
          step="0.01"
          required
        />
      </div>

      <input
        type="range"
        bind:value={pwycAmount}
        min={tier.pwyc_min}
        max={tier.pwyc_max ?? tier.pwyc_min * 5}
        step="0.01"
        class="w-full"
        aria-label="Choose amount slider"
      />

      <div class="flex justify-between text-xs text-muted-foreground">
        <span>${tier.pwyc_min.toFixed(2)}</span>
        {#if tier.pwyc_max}
          <span>${tier.pwyc_max.toFixed(2)}</span>
        {/if}
      </div>
    </div>

    {#if tier.price}
      <p class="text-sm text-muted-foreground">
        Suggested: ${tier.price.toFixed(2)}
      </p>
    {/if}
  </div>
{/if}
```

### 3.4 Update Checkout to Support PWYC

**File**: `src/lib/components/tickets/TicketTierList.svelte`

**Changes**:
- Use `/checkout/pwyc` endpoint for PWYC tiers
- Pass amount in request body

```svelte
<script lang="ts">
  import { eventCheckoutTicketPwyc } from '$lib/api/generated/sdk.gen';

  const checkoutMutation = createMutation({
    mutationFn: ({ tierId, amount }: { tierId: string, amount?: number }) => {
      if (amount !== undefined) {
        // PWYC checkout
        return eventCheckoutTicketPwyc({
          path: { event_id: event.id, tier_id: tierId },
          body: { amount }
        });
      } else {
        // Fixed-price checkout
        return eventCheckoutTicket({
          path: { event_id: event.id, tier_id: tierId }
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event', event.id, 'my-status'] });
      queryClient.invalidateQueries({ queryKey: ['event', event.id, 'ticket-tiers'] });
    }
  });

  function handleConfirmPurchase() {
    if (selectedTier) {
      if (selectedTier.price_type === 'pwyc') {
        $checkoutMutation.mutate({ tierId: selectedTier.id, amount: pwycAmount });
      } else {
        $checkoutMutation.mutate({ tierId: selectedTier.id });
      }
      showPurchaseModal = false;
      selectedTier = null;
    }
  }
</script>
```

### 3.5 Display Tier Sales Window States

**File**: `src/lib/components/tickets/TierCard.svelte` (attendee-facing)

**Changes**:
- Check if sales have started
- Check if sales have ended
- Show appropriate button state

```svelte
<script lang="ts">
  let now = $state(new Date());

  // Update "now" every minute
  $effect(() => {
    const interval = setInterval(() => {
      now = new Date();
    }, 60000);

    return () => clearInterval(interval);
  });

  let salesStatus = $derived(() => {
    if (tier.sales_start_at && new Date(tier.sales_start_at) > now) {
      return 'not-started';
    }
    if (tier.sales_end_at && new Date(tier.sales_end_at) < now) {
      return 'ended';
    }
    return 'active';
  });

  let isAvailable = $derived(
    salesStatus() === 'active' && (tier.total_available === null || tier.total_available > 0)
  );

  let buttonText = $derived(() => {
    if (salesStatus() === 'not-started') {
      const startDate = new Date(tier.sales_start_at!);
      return `Available ${startDate.toLocaleDateString()}`;
    }
    if (salesStatus() === 'ended') {
      return 'Sales Ended';
    }
    if (tier.total_available === 0) {
      return 'Sold Out';
    }
    return ctaText();
  });
</script>

<Button
  onclick={onPurchase}
  disabled={!isAvailable || isLoading}
  class="min-w-[140px]"
>
  {#if isLoading}
    Processing...
  {:else}
    {buttonText()}
  {/if}
</Button>
```

### 3.6 Filter Tiers by Visibility and Purchasable_By

**File**: `src/lib/components/tickets/TicketTierList.svelte`

**Changes**:
- Filter based on user's membership status
- Filter based on invitation status
- Check visibility settings

```svelte
<script lang="ts">
  let visibleTiers = $derived(
    tiers.filter(tier => {
      // Check visibility
      if (tier.visibility === 'private') return false;
      if (tier.visibility === 'staff-only' && !userStatus?.is_staff) return false;
      if (tier.visibility === 'members-only' && !userStatus?.is_member) return false;

      // Check purchasable_by
      if (tier.purchasable_by === 'members' && !userStatus?.is_member) return false;
      if (tier.purchasable_by === 'invited' && !userStatus?.is_invited) return false;
      if (tier.purchasable_by === 'invited_and_members' &&
          !userStatus?.is_member && !userStatus?.is_invited) {
        return false;
      }

      // Check sales window
      const now = new Date();
      if (tier.sales_start_at && new Date(tier.sales_start_at) > now) return false;
      if (tier.sales_end_at && new Date(tier.sales_end_at) < now) return false;

      // Check sold out
      if (tier.total_available === 0) return false;

      return true;
    })
  );
</script>
```

### 3.7 Testing Phase 3

**Manual Testing Checklist**:
- [ ] Create PWYC tier with min=$10, max=$50
- [ ] Purchase PWYC ticket as attendee
- [ ] Verify slider works (synced with input)
- [ ] Verify cannot submit amount < min
- [ ] Verify cannot submit amount > max
- [ ] Create tier with sales window (starts tomorrow)
- [ ] Verify tier shows "Available Tomorrow" button
- [ ] Create members-only tier
- [ ] Login as non-member
- [ ] Verify tier not visible
- [ ] Login as member
- [ ] Verify tier visible and purchasable
- [ ] Test quantity limits (create tier with quantity=5, buy 5, verify sold out)
- [ ] Run accessibility audit

---

## Install Dependencies

Before starting implementation, install QR code library:

```bash
pnpm add qrcode
pnpm add -D @types/qrcode
```

---

## Testing Strategy

### Unit Tests
- Tier form validation logic
- Price calculation functions
- Date formatting utilities
- Eligibility filtering logic

### Component Tests
- TierCard rendering
- TierForm submission
- PurchaseModal interactions
- MyTicket QR display

### E2E Tests (Playwright)
1. **FREE Ticket Flow**:
   - Create event with FREE tier
   - Claim ticket
   - Verify QR code displayed

2. **OFFLINE Payment Flow**:
   - Create event with OFFLINE tier
   - Reserve ticket
   - Admin confirms payment
   - Verify ticket activated

3. **PWYC Flow**:
   - Create event with PWYC tier
   - Purchase with custom amount
   - Verify ticket created

4. **Sold Out Scenario**:
   - Create tier with quantity=1
   - Purchase as user A
   - Login as user B
   - Verify "Sold Out" shown

### Accessibility Testing
- Use accessibility-checker subagent before each PR
- Manual keyboard navigation testing
- Screen reader testing (VoiceOver/NVDA)
- Color contrast validation
- Focus indicator visibility

---

## Deployment Checklist

Before merging to main:

- [ ] All unit tests passing
- [ ] All component tests passing
- [ ] All E2E tests passing
- [ ] Accessibility audit complete (WCAG 2.1 AA)
- [ ] Mobile testing complete (iOS Safari, Android Chrome)
- [ ] Code reviewed by team
- [ ] Documentation updated (if needed)
- [ ] No console errors or warnings
- [ ] Performance metrics acceptable (< 2s page load on 3G)

---

## Future Enhancements (Phase 4+)

**Phase 4: Stripe Integration**
- ONLINE payment method
- Stripe Checkout Session
- Webhook handling
- Refund support
- See issue #61

**Phase 5: Check-In System**
- QR code scanning
- Manual ticket lookup
- Check-in history
- Offline mode
- See issue #22

**Phase 6: Dashboard Integration**
- My Tickets page
- Past events
- Ticket downloads
- Calendar integration
- See issue #14

**Phase 7: Advanced Features**
- Waitlist for sold-out tiers
- Ticket transfers
- Group tickets
- Ticket add-ons (merchandise, food)
- Discount codes
- Early bird pricing automation

---

## Notes for Future Me

1. **QR Code Generation**: Phase 1 uses static server-generated QR codes. Phase 2+ should generate client-side using `qrcode` library for better performance.

2. **Payment Instructions**: The `manual_payment_instructions` field is per-tier, not organization-wide. Each OFFLINE tier can have different payment methods (e.g., "VIP Pass" accepts wire transfer, "General" accepts Venmo).

3. **Permissions**: Always check `manage_tickets` permission in `+page.server.ts` for admin routes. Don't rely on client-side checks alone.

4. **Optimistic Updates**: Use optimistic updates for admin payment confirmation to provide instant feedback. Always include rollback logic in `onError`.

5. **Mobile-First**: Design all components for mobile first, then enhance for desktop. Ticket purchasing on mobile is the primary use case.

6. **Accessibility**: Don't skip the accessibility-checker subagent. WCAG AA compliance is mandatory, not optional.

7. **API Client**: If backend changes ticket schemas, regenerate client with `pnpm generate:api`.

8. **Error Handling**: Always handle race conditions (e.g., tier sold out between display and purchase). Backend validates, frontend shows clear error messages.

---

**End of Implementation Plan**
