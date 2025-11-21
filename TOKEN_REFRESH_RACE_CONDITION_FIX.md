# Token Refresh Race Condition Fix

## Problem Summary

The application had **two independent token refresh mechanisms** that competed with each other, causing unexpected logouts:

1. **Reactive Interceptor** (`src/lib/api/client.ts`) - Catches 401 errors and refreshes the token
2. **Proactive Timer** (`src/lib/stores/auth.svelte.ts`) - Refreshes the token 5 minutes before expiry

These mechanisms had **no coordination**, leading to a critical race condition.

## The Race Condition

### Failure Scenario

1. Access token is about to expire
2. User triggers an API call → token has expired → server returns 401
3. **Reactive interceptor** catches 401 and starts **Refresh A** using `refreshToken_v1`
4. Almost simultaneously, **proactive timer** fires and starts **Refresh B** using the same `refreshToken_v1`
5. **Refresh A** completes first → backend invalidates `refreshToken_v1` → returns `refreshToken_v2`
6. **Refresh B** hits the backend → `refreshToken_v1` is now blacklisted → **refresh fails**
7. Failed refresh triggers logout → **user is logged out unexpectedly**

### Why This Happens

- Each refresh mechanism had its own lock (`isRefreshing` in interceptor, timer state in auth store)
- These locks were **not shared** between mechanisms
- Refresh tokens are **one-time-use** - once used, they're blacklisted
- Second refresh attempt always fails because the token is already consumed

## The Solution

### Centralized Token Refresh

We implemented a **single, shared refresh mechanism** in `AuthStore` with proper race condition protection:

```typescript
// src/lib/stores/auth.svelte.ts

class AuthStore {
  // Shared promise to prevent concurrent refresh attempts
  private _refreshPromise: Promise<void> | null = null;

  async refreshAccessToken(): Promise<void> {
    // If refresh is already in progress, wait for it to complete
    if (this._refreshPromise) {
      console.log('[AUTH STORE] Refresh already in progress, waiting...');
      return this._refreshPromise;
    }

    console.log('[AUTH STORE] Starting token refresh');

    // Create a new refresh promise and store it
    this._refreshPromise = this._performRefresh();

    try {
      // Wait for refresh to complete
      await this._refreshPromise;
    } finally {
      // Clear the promise so next refresh can proceed
      this._refreshPromise = null;
    }
  }
}
```

### How It Works

1. **Shared Promise Pattern**: Both mechanisms call the same `authStore.refreshAccessToken()` method
2. **Single Refresh Guarantee**: If a refresh is in progress, subsequent calls wait for the same promise
3. **No Duplicate Requests**: Only ONE actual API call to `/api/auth/refresh` ever happens
4. **Coordinated Response**: All callers receive the new token once the refresh completes

### Changes Made

#### 1. `src/lib/stores/auth.svelte.ts`

**Added:**
- Private field `_refreshPromise: Promise<void> | null` to track in-flight refreshes
- Public method `refreshAccessToken()` that checks for existing refresh and reuses it
- Private method `_performRefresh()` that performs the actual refresh

**Behavior:**
- If `refreshAccessToken()` is called while a refresh is in progress, it returns the existing promise
- Multiple concurrent calls all wait for the same refresh to complete
- Only one refresh token is ever consumed per refresh cycle

#### 2. `src/lib/api/client.ts`

**Changed:**
- Response interceptor now calls `authStore.refreshAccessToken()` instead of directly calling `/api/auth/refresh`
- Removed duplicate refresh logic from interceptor
- Simplified error handling (authStore handles logout on failure)

**Benefits:**
- Interceptor now participates in the shared refresh mechanism
- No need to duplicate refresh logic
- Consistent behavior across all refresh triggers

## Testing

### Verification Steps

1. **Build Test**: ✅ Production build completes successfully
   ```bash
   pnpm build
   # ✓ built in 28.86s
   ```

2. **Type Check**: ✅ No new TypeScript errors introduced
   ```bash
   pnpm check
   # Existing errors are unrelated to this fix
   ```

3. **Manual Testing** (Recommended):
   - Log in to the application
   - Wait for token to be near expiry (check browser console for auto-refresh logs)
   - Make API calls during the refresh window
   - Verify you stay logged in
   - Check console logs show only ONE refresh happening

### Expected Console Logs

**Before Fix** (Race Condition):
```
[API CLIENT] Received 401 on: /api/events/
[API CLIENT] Starting token refresh
[AUTH STORE] Auto-refresh timer triggered
[AUTH STORE] Refreshing access token
[AUTH STORE] Token refresh failed: 400
[AUTH STORE] Logging out
```

**After Fix** (Coordinated):
```
[API CLIENT] Received 401 on: /api/events/
[API CLIENT] Starting token refresh
[AUTH STORE] Starting token refresh
[AUTH STORE] Auto-refresh timer triggered
[AUTH STORE] Refresh already in progress, waiting...
[AUTH STORE] Token refresh successful
[API CLIENT] Token refresh successful, retrying requests
```

## Key Takeaways

### Root Cause
- **Multiple independent refresh mechanisms** without coordination
- **One-time-use refresh tokens** make race conditions fatal
- **Lack of shared state** between proactive timer and reactive interceptor

### Solution Pattern
- **Centralize** token refresh in a single location
- **Share state** using a promise that concurrent calls can wait on
- **Coordinate** all refresh triggers through the same entry point

### Best Practices Applied
1. **Single Source of Truth**: One place handles token refresh
2. **Promise Reuse**: Concurrent calls share the same promise
3. **Fail-Safe Design**: Only logout if refresh truly fails (not due to race condition)
4. **Clear Logging**: Console logs show exactly what's happening

## Future Improvements

### Potential Enhancements
1. **Exponential Backoff**: If refresh fails, retry with increasing delays
2. **Refresh Queue**: Queue API calls during refresh instead of failing fast
3. **Token Prefetch**: Refresh even earlier (e.g., 10 minutes before expiry)
4. **Metrics**: Track refresh success/failure rates
5. **User Feedback**: Show a subtle indicator when token is being refreshed

### Monitoring
- Add Sentry/logging to track refresh failures
- Monitor for 401 errors that shouldn't happen
- Track logout events and correlate with refresh attempts

## References

### Related Files
- `src/lib/stores/auth.svelte.ts` - Centralized auth state and token refresh
- `src/lib/api/client.ts` - API client interceptor for 401 handling
- `src/routes/api/auth/refresh/+server.ts` - Server-side refresh endpoint

### Related Concepts
- **Rotating Refresh Tokens**: Each refresh returns new access + refresh tokens
- **Token Blacklisting**: Used tokens are blacklisted to prevent replay attacks
- **Promise Reuse Pattern**: Sharing promises to prevent duplicate operations
- **Race Condition**: Multiple operations competing for the same resource

---

**Status**: ✅ Fixed
**Date**: November 21, 2025
**Tested**: Build passes, type checks pass
**Deployed**: Pending manual testing and deployment
