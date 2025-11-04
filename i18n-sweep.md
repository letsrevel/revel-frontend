# i18n Translation Sweep - Complete Inventory

**Total Files**: 213
**Files with Hardcoded Strings**: 113
**Files Already Clean**: 100
**Total Strings to Translate**: ~723
**Status**: Initial scan complete - ready for systematic translation
**Created**: 2025-01-04

---

## How to Use This File

- [ ] = Not checked yet / needs translation
- [~] = In progress
- [x] = Completed (all strings translated)
- [SKIP] = No user-facing strings (e.g., test files, demos)

Mark findings with:
- 🔴 HIGH: User-facing UI strings
- 🟡 MED: Admin/staff strings
- 🟢 LOW: Debug/internal strings
- ⚪ NONE: No hardcoded strings found

---

## Summary Statistics

- 🔴 **HIGH Priority**: 51 files (~298 strings)
- 🟡 **MEDIUM Priority**: 59 files (~415 strings)
- 🟢 **LOW Priority**: 3 files (~10 strings)
- ⚪ **Clean**: 100 files

---

## Priority Files - Start Here!

### 🔴 TOP 10 HIGH PRIORITY FILES

1. **+page.svelte** (33 strings)
   - Path: `routes/(auth)/org/[slug]/admin/events/[event_id]/invitations/+page.svelte`
   - Examples: `Enter`, `Backspace`

2. **+page.svelte** (27 strings)
   - Path: `routes/(auth)/org/[slug]/admin/events/[event_id]/tickets/+page.svelte`
   - Examples: `Failed to confirm payment`, `Failed to confirm`

3. **EventWizard.svelte** (19 strings)
   - Path: `lib/components/events/admin/EventWizard.svelte`
   - Examples: `Failed to create event`, `Failed to create`

4. **PotluckSection.svelte** (17 strings)
   - Path: `lib/components/events/PotluckSection.svelte`
   - Examples: `Failed to fetch potluck items`, `Failed to fetch`

5. **IneligibilityMessage.svelte** (16 strings)
   - Path: `lib/components/events/IneligibilityMessage.svelte`
   - Examples: `Sold out`, `Only members`

6. **EventQuestionnaireAssignmentModal.svelte** (14 strings)
   - Path: `lib/components/events/admin/EventQuestionnaireAssignmentModal.svelte`
   - Examples: `Failed to load`, `Please try`

7. **PotluckItem.svelte** (12 strings)
   - Path: `lib/components/events/PotluckItem.svelte`
   - Examples: `Dessert`, `Drink`

8. **+page.svelte** (10 strings)
   - Path: `routes/(auth)/org/[slug]/admin/events/[event_id]/attendees/+page.svelte`
   - Examples: `Failed to update`, `Failed to delete`

9. **TagsFilter.svelte** (9 strings)
   - Path: `lib/components/events/filters/TagsFilter.svelte`
   - Examples: `Failed to load tags`, `Failed to load`

10. **+page.svelte** (9 strings)
   - Path: `routes/(public)/account/confirm-deletion/+page.svelte`
   - Examples: `Error Message `, `Account Deleted`

---

## Complete File List (Grouped by Directory)

### src/lib/components/common

- [ ] `ConfirmDialog.svelte` 🟡 MED (3 strings)
- [ ] `DemoCardInfo.svelte` 🟡 MED (2 strings)
- [ ] `LanguageSwitcher.svelte` 🟡 MED (3 strings)
- [ ] `MobileNav.svelte` 🟡 MED (1 strings)

### src/lib/components/event-series

- [ ] `SeriesQuestionnaireAssignmentModal.svelte` 🟡 MED (14 strings)
- [ ] `SeriesResourceAssignmentModal.svelte` 🟡 MED (7 strings)

### src/lib/components/events

- [ ] `ActionButton.svelte` 🔴 HIGH (1 strings)
- [ ] `AttendeeList.svelte` 🔴 HIGH (3 strings)
- [ ] `CityFilter.svelte` 🔴 HIGH (1 strings)
- [ ] `ClaimInvitationButton.svelte` 🔴 HIGH (3 strings)
- [ ] `DetailsStep.svelte` 🔴 HIGH (1 strings)
- [ ] `EventActionSidebar.svelte` 🔴 HIGH (5 strings)
- [ ] `EventBadges.svelte` 🔴 HIGH (2 strings)
- [ ] `EventHeader.svelte` 🔴 HIGH (2 strings)
- [ ] `EventQuestionnaireAssignmentModal.svelte` 🔴 HIGH (14 strings)
- [ ] `EventQuestionnaires.svelte` 🔴 HIGH (8 strings)
- [ ] `EventQuickInfo.svelte` 🔴 HIGH (1 strings)
- [ ] `EventRSVP.svelte` 🔴 HIGH (5 strings)
- [ ] `EventResources.svelte` 🔴 HIGH (2 strings)
- [ ] `EventWizard.svelte` 🔴 HIGH (19 strings)
- [ ] `IneligibilityActionButton.svelte` 🔴 HIGH (2 strings)
- [x] `IneligibilityMessage.svelte` ⚪ NONE (0 strings) - All translated
- [ ] `MobileFilterSheet.svelte` 🔴 HIGH (1 strings)
- [ ] `OrganizationFilter.svelte` 🔴 HIGH (1 strings)
- [ ] `PotluckItem.svelte` 🔴 HIGH (12 strings)
- [x] `PotluckSection.svelte` ⚪ NONE (0 strings) - All translated
- [ ] `RetryCountdown.svelte` 🔴 HIGH (3 strings)
- [ ] `TagsFilter.svelte` 🔴 HIGH (9 strings)
- [ ] `TierCard.svelte` 🔴 HIGH (5 strings)
- [ ] `TierForm.svelte` 🔴 HIGH (2 strings)

### src/lib/components/events/admin

- (No files with hardcoded strings)

### src/lib/components/forms

- [ ] `CityAutocomplete.svelte` 🟡 MED (2 strings)
- [ ] `ImageUploader.svelte` 🟡 MED (4 strings)
- [ ] `MarkdownEditor.svelte` 🟡 MED (3 strings)
- [ ] `PasswordStrengthIndicator.svelte` 🟡 MED (2 strings)
- [ ] `TagInput.svelte` 🟡 MED (5 strings)
- [ ] `TwoFactorInput.svelte` 🟡 MED (1 strings)

### src/lib/components/invitations

- [ ] `InvitationCard.svelte` 🟡 MED (3 strings)
- [ ] `InvitationRequestCard.svelte` 🟡 MED (9 strings)

### src/lib/components/members

- [ ] `MemberCard.svelte` 🟡 MED (1 strings)
- [ ] `PermissionsEditor.svelte` 🟡 MED (21 strings)
- [ ] `StaffCard.svelte` 🟡 MED (1 strings)

### src/lib/components/organization

- [ ] `RequestMembershipButton.svelte` 🟢 LOW (4 strings)
- [ ] `StripeConnect.svelte` 🟡 MED (4 strings)

### src/lib/components/organizations

- [ ] `ClaimMembershipButton.svelte` 🔴 HIGH (3 strings)
- [ ] `MobileOrganizationFilterSheet.svelte` 🔴 HIGH (1 strings)

### src/lib/components/questionnaires

- [ ] `AutoEvalRecommendation.svelte` 🟡 MED (2 strings)
- [ ] `QuestionAnswerDisplay.svelte` 🟡 MED (3 strings)
- [ ] `QuestionEditor.svelte` 🟡 MED (1 strings)
- [ ] `QuestionnaireAssignmentModal.svelte` 🟡 MED (10 strings)
- [ ] `QuestionnaireCard.svelte` 🟡 MED (13 strings)
- [ ] `SubmissionStatusBadge.svelte` 🟡 MED (4 strings)

### src/lib/components/resources

- [ ] `ResourceAssignment.svelte` 🟡 MED (4 strings)
- [ ] `ResourceCard.svelte` 🟡 MED (6 strings)
- [ ] `ResourceForm.svelte` 🟡 MED (5 strings)
- [ ] `ResourceModal.svelte` 🟡 MED (11 strings)

### src/lib/components/rsvps

- [ ] `RSVPCard.svelte` 🟡 MED (3 strings)

### src/lib/components/tickets

- [ ] `CheckInDialog.svelte` 🟡 MED (6 strings)
- [ ] `MyTicket.svelte` 🟡 MED (4 strings)
- [ ] `MyTicketModal.svelte` 🟡 MED (4 strings)
- [ ] `PWYCModal.svelte` 🟡 MED (5 strings)
- [ ] `QRScannerModal.svelte` 🟡 MED (7 strings)
- [ ] `TicketConfirmationDialog.svelte` 🟡 MED (4 strings)
- [ ] `TicketStatusBadge.svelte` 🟢 LOW (3 strings)
- [ ] `TicketTierModal.svelte` 🟡 MED (4 strings)
- [ ] `TierCard.svelte` 🟡 MED (3 strings)

### src/lib/components/tokens

- [ ] `EventTokenCard.svelte` 🟡 MED (3 strings)
- [ ] `EventTokenModal.svelte` 🟡 MED (1 strings)
- [ ] `OrganizationTokenCard.svelte` 🟡 MED (2 strings)
- [ ] `OrganizationTokenModal.svelte` 🟡 MED (1 strings)
- [ ] `TokenShareDialog.svelte` 🟡 MED (2 strings)
- [ ] `TokenStatusBadge.svelte` 🟢 LOW (3 strings)

### src/routes/

- [ ] `+error.svelte` 🟡 MED (17 strings)
- [ ] `+layout.svelte` 🟡 MED (2 strings)

### src/routes/(auth)/account

- (No files with hardcoded strings)

### src/routes/(auth)/account/privacy

- [ ] `+page.svelte` 🟡 MED (9 strings)

### src/routes/(auth)/account/profile

- [ ] `+page.svelte` 🟡 MED (7 strings)

### src/routes/(auth)/account/security

- [ ] `+page.svelte` 🟡 MED (16 strings)

### src/routes/(auth)/account/settings

- [ ] `+page.svelte` 🟡 MED (10 strings)

### src/routes/(auth)/dashboard

- [ ] `+page.svelte` 🔴 HIGH (1 strings)

### src/routes/(auth)/dashboard/rsvps

- [ ] `+page.svelte` 🔴 HIGH (3 strings)

### src/routes/(auth)/dashboard/tickets

- [ ] `+page.svelte` 🔴 HIGH (3 strings)

### src/routes/(auth)/org/[slug]/admin

- (No files with hardcoded strings)

### src/routes/(auth)/org/[slug]/admin/event-series/[series_id]/edit

- [ ] `+page.svelte` 🟡 MED (28 strings)

### src/routes/(auth)/org/[slug]/admin/event-series/new

- [ ] `+page.svelte` 🟡 MED (6 strings)

### src/routes/(auth)/org/[slug]/admin/events

- [ ] `+page.svelte` 🔴 HIGH (2 strings)

### src/routes/(auth)/org/[slug]/admin/events/[event_id]/attendees

- [ ] `+page.svelte` 🔴 HIGH (10 strings)

### src/routes/(auth)/org/[slug]/admin/events/[event_id]/edit

- [ ] `+page.svelte` 🔴 HIGH (8 strings)

### src/routes/(auth)/org/[slug]/admin/events/[event_id]/invitations

- [ ] `+page.svelte` 🔴 HIGH (33 strings)

### src/routes/(auth)/org/[slug]/admin/events/[event_id]/tickets

- [ ] `+page.svelte` 🔴 HIGH (27 strings)

### src/routes/(auth)/org/[slug]/admin/events/new

- [ ] `+page.svelte` 🔴 HIGH (1 strings)

### src/routes/(auth)/org/[slug]/admin/members

- [ ] `+page.svelte` 🟡 MED (15 strings)

### src/routes/(auth)/org/[slug]/admin/members/requests

- [ ] `+page.svelte` 🟡 MED (6 strings)

### src/routes/(auth)/org/[slug]/admin/questionnaires/[id]

- [ ] `+page.svelte` 🟡 MED (42 strings)

### src/routes/(auth)/org/[slug]/admin/questionnaires/[id]/submissions

- [ ] `+page.svelte` 🟡 MED (10 strings)

### src/routes/(auth)/org/[slug]/admin/questionnaires/[id]/submissions/[submission_id]

- [ ] `+page.svelte` 🟡 MED (6 strings)

### src/routes/(auth)/org/[slug]/admin/questionnaires/new

- [ ] `+page.svelte` 🟡 MED (25 strings)

### src/routes/(auth)/org/[slug]/admin/resources

- [ ] `+page.svelte` 🟡 MED (4 strings)

### src/routes/(auth)/org/[slug]/admin/settings

- [ ] `+page.svelte` 🟡 MED (4 strings)

### src/routes/(auth)/org/[slug]/admin/tokens

- [ ] `+page.svelte` 🟡 MED (14 strings)

### src/routes/(public)

- [ ] `+page.svelte` 🔴 HIGH (1 strings)

### src/routes/(public)/account/confirm-deletion

- [ ] `+page.svelte` 🔴 HIGH (9 strings)

### src/routes/(public)/events

- [ ] `+page.svelte` 🔴 HIGH (2 strings)

### src/routes/(public)/events/[org_slug]/[event_slug]

- [ ] `+page.svelte` 🔴 HIGH (5 strings)

### src/routes/(public)/events/[org_slug]/[event_slug]/questionnaire/[id]

- [ ] `+page.svelte` 🔴 HIGH (8 strings)

### src/routes/(public)/events/[org_slug]/series/[series_slug]

- [ ] `+page.svelte` 🔴 HIGH (5 strings)

### src/routes/(public)/join/event/[token_id]

- [ ] `+page.svelte` 🔴 HIGH (6 strings)

### src/routes/(public)/join/org/[token_id]

- [ ] `+page.svelte` 🔴 HIGH (6 strings)

### src/routes/(public)/login

- [ ] `+page.svelte` 🔴 HIGH (1 strings)

### src/routes/(public)/login/reset-password

- [ ] `+page.svelte` 🔴 HIGH (9 strings)

### src/routes/(public)/org/[slug]

- [ ] `+page.svelte` 🔴 HIGH (4 strings)

### src/routes/(public)/org/[slug]/resources

- [ ] `+page.svelte` 🔴 HIGH (5 strings)

### src/routes/(public)/organizations

- [ ] `+page.svelte` 🔴 HIGH (1 strings)

### src/routes/(public)/password-reset

- [ ] `+page.svelte` 🔴 HIGH (5 strings)

### src/routes/(public)/register

- [ ] `+page.svelte` 🔴 HIGH (1 strings)

### src/routes/(public)/register/check-email

- [ ] `+page.svelte` 🔴 HIGH (3 strings)

---

## Detailed Findings

### 🔴 HIGH Priority - User-Facing Strings

#### +page.svelte
**Path**: `routes/(auth)/org/[slug]/admin/events/[event_id]/invitations/+page.svelte`
**Count**: 33 hardcoded strings

**Sample Strings**:
- Line 238: `Enter`
- Line 244: `Backspace`
- Line 429: `Failed to fetch tokens`
- Line 429: `Failed to fetch`
- Line 447: `Failed to create token`
- ... and 28 more

#### +page.svelte
**Path**: `routes/(auth)/org/[slug]/admin/events/[event_id]/tickets/+page.svelte`
**Count**: 27 hardcoded strings

**Sample Strings**:
- Line 76: `Failed to confirm payment`
- Line 76: `Failed to confirm`
- Line 99: `Failed to cancel ticket`
- Line 99: `Failed to cancel`
- Line 127: `Failed to check in ticket`
- ... and 22 more

#### EventWizard.svelte
**Path**: `lib/components/events/admin/EventWizard.svelte`
**Count**: 19 hardcoded strings

**Sample Strings**:
- Line 172: `Failed to create event`
- Line 172: `Failed to create`
- Line 198: `Failed to update event`
- Line 198: `Failed to update`
- Line 223: `Failed to upload logo`
- ... and 14 more

#### PotluckSection.svelte
**Path**: `lib/components/events/PotluckSection.svelte`
**Count**: 17 hardcoded strings

**Sample Strings**:
- Line 54: `Failed to fetch potluck items`
- Line 54: `Failed to fetch`
- Line 90: `You do not have permission to create potluck items`
- Line 92: `Failed to create item`
- Line 92: `Failed to create`
- ... and 12 more

#### IneligibilityMessage.svelte
**Path**: `lib/components/events/IneligibilityMessage.svelte`
**Count**: 16 hardcoded strings

**Sample Strings**:
- Line 78: `Sold out`
- Line 99: `Only members`
- Line 99: `Members only`
- Line 100: `Invitation required`
- Line 101: `Questionnaire has not been filled`
- ... and 11 more

#### EventQuestionnaireAssignmentModal.svelte
**Path**: `lib/components/events/admin/EventQuestionnaireAssignmentModal.svelte`
**Count**: 14 hardcoded strings

**Sample Strings**:
- Line 67: `Failed to load`
- Line 68: `Please try`
- Line 122: `Failed to assign`
- Line 137: `Failed to unassign`
- Line 145: `Failed to save`
- ... and 9 more

#### PotluckItem.svelte
**Path**: `lib/components/events/PotluckItem.svelte`
**Count**: 12 hardcoded strings

**Sample Strings**:
- Line 53: `Dessert`
- Line 54: `Drink`
- Line 55: `Alcohol`
- Line 57: `Supplies`
- Line 59: `Entertainment`
- ... and 7 more

#### +page.svelte
**Path**: `routes/(auth)/org/[slug]/admin/events/[event_id]/attendees/+page.svelte`
**Count**: 10 hardcoded strings

**Sample Strings**:
- Line 57: `Failed to update`
- Line 84: `Failed to delete`
- Line 237: `Maybe`
- Line 674: `Are you sure`
- Line 283: `Manage Attendees`
- ... and 5 more

#### TagsFilter.svelte
**Path**: `lib/components/events/filters/TagsFilter.svelte`
**Count**: 9 hardcoded strings

**Sample Strings**:
- Line 36: `Failed to load tags`
- Line 36: `Failed to load`
- Line 44: `Queer`
- Line 46: `Community`
- Line 47: `Social`
- ... and 4 more

#### +page.svelte
**Path**: `routes/(public)/account/confirm-deletion/+page.svelte`
**Count**: 9 hardcoded strings

**Sample Strings**:
- Line 113: `Error Message `
- Line 41: `Account Deleted`
- Line 42: `Your account has been permanently deleted`
- Line 77: `Invalid Link`
- Line 84: `Invalid or missing deletion token`
- ... and 4 more

#### +page.svelte
**Path**: `routes/(public)/login/reset-password/+page.svelte`
**Count**: 9 hardcoded strings

**Sample Strings**:
- Line 41: `Password reset successful`
- Line 41: `Set new password`
- Line 45: `Your password has been successfully reset`
- Line 46: `Enter a strong password for your account`
- Line 84: `Please request`
- ... and 4 more

#### EventQuestionnaires.svelte
**Path**: `lib/components/events/admin/EventQuestionnaires.svelte`
**Count**: 8 hardcoded strings

**Sample Strings**:
- Line 50: `Failed to unassign questionnaire`
- Line 50: `Failed to unassign`
- Line 56: `Failed to remove`
- Line 56: `Please try`
- Line 64: `Admission`
- ... and 3 more

#### +page.svelte
**Path**: `routes/(auth)/org/[slug]/admin/events/[event_id]/edit/+page.svelte`
**Count**: 8 hardcoded strings

**Sample Strings**:
- Line 24: `Not authenticated`
- Line 39: `Failed to update status`
- Line 39: `Failed to update`
- Line 69: `Are you sure`
- Line 132: `Draft`
- ... and 3 more

#### +page.svelte
**Path**: `routes/(public)/events/[org_slug]/[event_slug]/questionnaire/[id]/+page.svelte`
**Count**: 8 hardcoded strings

**Sample Strings**:
- Line 54: `This question is required`
- Line 69: `Please answer all required questions`
- Line 69: `Please answer`
- Line 99: `Failed to submit`
- Line 99: `Please try`
- ... and 3 more

#### +page.svelte
**Path**: `routes/(public)/join/event/[token_id]/+page.svelte`
**Count**: 6 hardcoded strings

**Sample Strings**:
- Line 36: `Failed to claim invitation`
- Line 36: `Failed to claim`
- Line 113: `Ticket Tier`
- Line 145: `Event invitation`
- Line 150: `Automatic ticket assignment`
- ... and 1 more

#### +page.svelte
**Path**: `routes/(public)/join/org/[token_id]/+page.svelte`
**Count**: 6 hardcoded strings

**Sample Strings**:
- Line 34: `Failed to claim invitation`
- Line 34: `Failed to claim`
- Line 122: `Staff access with permissions`
- Line 126: `Manage events and members`
- Line 131: `Member access to organization`
- ... and 1 more

#### EventActionSidebar.svelte
**Path**: `lib/components/events/EventActionSidebar.svelte`
**Count**: 5 hardcoded strings

**Sample Strings**:
- Line 78: `You're attending`
- Line 83: `You're checked in`
- Line 86: `Your ticket is pending`
- Line 88: `You have a ticket`
- Line 318: `Change`

#### EventRSVP.svelte
**Path**: `lib/components/events/EventRSVP.svelte`
**Count**: 5 hardcoded strings

**Sample Strings**:
- Line 140: `Failed to submit`
- Line 140: `Please try`
- Line 328: `Error State `
- Line 383: `Maybe`
- Line 383: `Are you sure`

#### TierCard.svelte
**Path**: `lib/components/events/admin/TierCard.svelte`
**Count**: 5 hardcoded strings

**Sample Strings**:
- Line 40: `Not set`
- Line 68: `Unlimited`
- Line 77: `Offline`
- Line 90: `Anyone`
- Line 102: `Always available`

#### +page.svelte
**Path**: `routes/(public)/events/[org_slug]/[event_slug]/+page.svelte`
**Count**: 5 hardcoded strings

**Sample Strings**:
- Line 119: `Failed to checkout`
- Line 185: `No pending ticket found`
- Line 198: `Failed to resume checkout`
- Line 198: `Failed to resume`
- Line 292: `Revel`

#### +page.svelte
**Path**: `routes/(public)/events/[org_slug]/series/[series_slug]/+page.svelte`
**Count**: 5 hardcoded strings

**Sample Strings**:
- Line 77: `Revel`
- Line 119: `Event Series`
- Line 146: `Manage Series`
- Line 238: `Events in this Series`
- Line 262: `No events yet`

#### +page.svelte
**Path**: `routes/(public)/org/[slug]/resources/+page.svelte`
**Count**: 5 hardcoded strings

**Sample Strings**:
- Line 98: `Try adjusting your filters`
- Line 99: `This organization has not added any resources yet`
- Line 53: `Resources`
- Line 82: `All Types`
- Line 95: `No resources found`

#### +page.svelte
**Path**: `routes/(public)/password-reset/+page.svelte`
**Count**: 5 hardcoded strings

**Sample Strings**:
- Line 34: `Check your email`
- Line 34: `Reset your password`
- Line 38: `If an account exists with that email, you will receive password reset instructions`
- Line 39: `Enter your email address and we will send you a link to reset your password`
- Line 79: `Error Summary `

#### +page.svelte
**Path**: `routes/(public)/org/[slug]/+page.svelte`
**Count**: 4 hardcoded strings

**Sample Strings**:
- Line 160: `Revel`
- Line 393: `Showing newest first`
- Line 394: `Showing oldest first`
- Line 420: `Error State `

#### AttendeeList.svelte
**Path**: `lib/components/events/AttendeeList.svelte`
**Count**: 3 hardcoded strings

**Sample Strings**:
- Line 31: `Failed to load attendees`
- Line 31: `Failed to load`
- Line 55: `Anonymous`

#### ClaimInvitationButton.svelte
**Path**: `lib/components/events/ClaimInvitationButton.svelte`
**Count**: 3 hardcoded strings

**Sample Strings**:
- Line 45: `Failed to claim invitation`
- Line 45: `Failed to claim`
- Line 69: `Log in to claim invitation`

#### RetryCountdown.svelte
**Path**: `lib/components/events/RetryCountdown.svelte`
**Count**: 3 hardcoded strings

**Sample Strings**:
- Line 27: `Available now`
- Line 56: `Failed to format`
- Line 57: `Available soon`

#### ClaimMembershipButton.svelte
**Path**: `lib/components/organizations/ClaimMembershipButton.svelte`
**Count**: 3 hardcoded strings

**Sample Strings**:
- Line 50: `Failed to claim membership`
- Line 50: `Failed to claim`
- Line 72: `Log in to claim membership`

#### +page.svelte
**Path**: `routes/(auth)/dashboard/rsvps/+page.svelte`
**Count**: 3 hardcoded strings

**Sample Strings**:
- Line 167: `Options`
- Line 186: `Loading RSVPs...`
- Line 196: `No RSVPs found`

#### +page.svelte
**Path**: `routes/(auth)/dashboard/tickets/+page.svelte`
**Count**: 3 hardcoded strings

**Sample Strings**:
- Line 211: `Options`
- Line 230: `Loading tickets...`
- Line 240: `No tickets found`

#### +page.svelte
**Path**: `routes/(public)/register/check-email/+page.svelte`
**Count**: 3 hardcoded strings

**Sample Strings**:
- Line 24: `Failed to resend verification email`
- Line 24: `Failed to resend`
- Line 29: `Please try`

#### EventBadges.svelte
**Path**: `lib/components/events/EventBadges.svelte`
**Count**: 2 hardcoded strings

**Sample Strings**:
- Line 64: `Private`
- Line 66: `Public`

#### EventHeader.svelte
**Path**: `lib/components/events/EventHeader.svelte`
**Count**: 2 hardcoded strings

**Sample Strings**:
- Line 51: `Failed to copy`
- Line 96: `Download calendar event`

#### IneligibilityActionButton.svelte
**Path**: `lib/components/events/IneligibilityActionButton.svelte`
**Count**: 2 hardcoded strings

**Sample Strings**:
- Line 159: `Continue`
- Line 227: `Error Message `

#### EventResources.svelte
**Path**: `lib/components/events/admin/EventResources.svelte`
**Count**: 2 hardcoded strings

**Sample Strings**:
- Line 40: `Failed to load resources`
- Line 40: `Failed to load`

#### TierForm.svelte
**Path**: `lib/components/events/admin/TierForm.svelte`
**Count**: 2 hardcoded strings

**Sample Strings**:
- Line 269: `Are you sure`
- Line 529: `Please try`

#### +page.svelte
**Path**: `routes/(auth)/org/[slug]/admin/events/+page.svelte`
**Count**: 2 hardcoded strings

**Sample Strings**:
- Line 53: `Failed to update status`
- Line 53: `Failed to update`

#### +page.svelte
**Path**: `routes/(public)/events/+page.svelte`
**Count**: 2 hardcoded strings

**Sample Strings**:
- Line 89: `Revel`
- Line 143: `Error State `

#### ActionButton.svelte
**Path**: `lib/components/events/ActionButton.svelte`
**Count**: 1 hardcoded strings

**Sample Strings**:
- Line 28: `Sign in to attend`

#### EventQuickInfo.svelte
**Path**: `lib/components/events/EventQuickInfo.svelte`
**Count**: 1 hardcoded strings

**Sample Strings**:
- Line 35: `Event`

#### DetailsStep.svelte
**Path**: `lib/components/events/admin/DetailsStep.svelte`
**Count**: 1 hardcoded strings

**Sample Strings**:
- Line 166: `Enter`

#### CityFilter.svelte
**Path**: `lib/components/events/filters/CityFilter.svelte`
**Count**: 1 hardcoded strings

**Sample Strings**:
- Line 46: `Failed to search`

#### MobileFilterSheet.svelte
**Path**: `lib/components/events/filters/MobileFilterSheet.svelte`
**Count**: 1 hardcoded strings

**Sample Strings**:
- Line 170: `Escape`

#### OrganizationFilter.svelte
**Path**: `lib/components/events/filters/OrganizationFilter.svelte`
**Count**: 1 hardcoded strings

**Sample Strings**:
- Line 46: `Failed to search`

#### MobileOrganizationFilterSheet.svelte
**Path**: `lib/components/organizations/filters/MobileOrganizationFilterSheet.svelte`
**Count**: 1 hardcoded strings

**Sample Strings**:
- Line 84: `Escape`

#### +page.svelte
**Path**: `routes/(auth)/dashboard/+page.svelte`
**Count**: 1 hardcoded strings

**Sample Strings**:
- Line 470: `Organizing`

#### +page.svelte
**Path**: `routes/(auth)/org/[slug]/admin/events/new/+page.svelte`
**Count**: 1 hardcoded strings

**Sample Strings**:
- Line 20: `Create Event`

#### +page.svelte
**Path**: `routes/(public)/+page.svelte`
**Count**: 1 hardcoded strings

**Sample Strings**:
- Line 48: `Revel`

#### +page.svelte
**Path**: `routes/(public)/login/+page.svelte`
**Count**: 1 hardcoded strings

**Sample Strings**:
- Line 71: `Error Summary `

#### +page.svelte
**Path**: `routes/(public)/organizations/+page.svelte`
**Count**: 1 hardcoded strings

**Sample Strings**:
- Line 134: `Error State `

#### +page.svelte
**Path**: `routes/(public)/register/+page.svelte`
**Count**: 1 hardcoded strings

**Sample Strings**:
- Line 41: `Error Summary `

### 🟡 MEDIUM Priority - Admin/Staff Strings

#### +page.svelte
**Path**: `routes/(auth)/org/[slug]/admin/questionnaires/[id]/+page.svelte` | **Count**: 42 strings

#### +page.svelte
**Path**: `routes/(auth)/org/[slug]/admin/event-series/[series_id]/edit/+page.svelte` | **Count**: 28 strings

#### +page.svelte
**Path**: `routes/(auth)/org/[slug]/admin/questionnaires/new/+page.svelte` | **Count**: 25 strings

#### PermissionsEditor.svelte
**Path**: `lib/components/members/PermissionsEditor.svelte` | **Count**: 21 strings

#### +error.svelte
**Path**: `routes/+error.svelte` | **Count**: 17 strings

#### +page.svelte
**Path**: `routes/(auth)/account/security/+page.svelte` | **Count**: 16 strings

#### +page.svelte
**Path**: `routes/(auth)/org/[slug]/admin/members/+page.svelte` | **Count**: 15 strings

#### SeriesQuestionnaireAssignmentModal.svelte
**Path**: `lib/components/event-series/admin/SeriesQuestionnaireAssignmentModal.svelte` | **Count**: 14 strings

#### +page.svelte
**Path**: `routes/(auth)/org/[slug]/admin/tokens/+page.svelte` | **Count**: 14 strings

#### QuestionnaireCard.svelte
**Path**: `lib/components/questionnaires/QuestionnaireCard.svelte` | **Count**: 13 strings

#### ResourceModal.svelte
**Path**: `lib/components/resources/ResourceModal.svelte` | **Count**: 11 strings

#### QuestionnaireAssignmentModal.svelte
**Path**: `lib/components/questionnaires/QuestionnaireAssignmentModal.svelte` | **Count**: 10 strings

#### +page.svelte
**Path**: `routes/(auth)/account/settings/+page.svelte` | **Count**: 10 strings

#### +page.svelte
**Path**: `routes/(auth)/org/[slug]/admin/questionnaires/[id]/submissions/+page.svelte` | **Count**: 10 strings

#### InvitationRequestCard.svelte
**Path**: `lib/components/invitations/InvitationRequestCard.svelte` | **Count**: 9 strings

#### +page.svelte
**Path**: `routes/(auth)/account/privacy/+page.svelte` | **Count**: 9 strings

#### SeriesResourceAssignmentModal.svelte
**Path**: `lib/components/event-series/admin/SeriesResourceAssignmentModal.svelte` | **Count**: 7 strings

#### QRScannerModal.svelte
**Path**: `lib/components/tickets/QRScannerModal.svelte` | **Count**: 7 strings

#### +page.svelte
**Path**: `routes/(auth)/account/profile/+page.svelte` | **Count**: 7 strings

#### ResourceCard.svelte
**Path**: `lib/components/resources/ResourceCard.svelte` | **Count**: 6 strings

### 🟢 LOW Priority - Internal Strings

- `lib/components/organization/RequestMembershipButton.svelte` (4 strings)
- `lib/components/tickets/TicketStatusBadge.svelte` (3 strings)
- `lib/components/tokens/TokenStatusBadge.svelte` (3 strings)

---

## Next Steps

1. **Start with HIGH priority files** - Focus on user-facing components first
2. **Extract strings to translation files** - Add to messages/en.json, de.json, it.json
3. **Replace with m['key']() calls** - Use Paraglide translation syntax
4. **Test in all 3 languages** - Verify translations work correctly
5. **Mark files as complete** - Update checkboxes as you go
6. **Run static checks** - Use `pnpm i18n:check-imports` before committing
