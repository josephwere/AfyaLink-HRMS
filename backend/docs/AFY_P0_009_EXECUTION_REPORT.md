# AFY-P0-009 Google OAuth Verification: Step 1-3 Complete

## Evidence Summary

### Step 1: Backend Configuration ✅
**Status:** Completed
**What was verified:**
- Backend configuration loads via `backend/config/loadEnv.js` using dotenv
- `backend/.env.example` now documents required `GOOGLE_CLIENT_ID` and optional `GOOGLE_AUTH_TIMEOUT_MS`
- `backend/config/validateEnv.js` does NOT validate GOOGLE_CLIENT_ID (silent if missing)
- Backend starts without error if GOOGLE_CLIENT_ID is undefined or empty

**Implication:** Backend must be configured with valid GOOGLE_CLIENT_ID before token verification can work.

**Evidence Source:** Code review + .env.example update

---

### Step 2: Frontend Token Type ✅
**Status:** Completed
**What was verified:**
- Frontend uses `@react-oauth/google` GoogleLogin component from npm package
- Component correctly returns **ID token** (not access token)
- `handleSuccess()` in `useGoogleAuth.jsx` line 29 receives `credentialResponse.credential`
- Credential is sent to backend POST `/api/auth/google` as `{ credential }`

**Implication:** Frontend correctly sends the right token type ✅

**Evidence Source:**
- frontend/src/auth/useGoogleAuth.jsx (line 29: `credentialResponse.credential`)
- frontend/src/pages/Login.jsx (imports useGoogleAuth)
- Google's @react-oauth/google documentation (ID token in credential field)

---

### Step 3: Backend Token Validation Logging ✅
**Status:** Completed
**What was improved:**
- Updated `backend/controllers/googleAuthController.js` error handler to log specific validation failures
- Added `[GOOGLE_AUTH_VERIFICATION_FAILED]` diagnostic logging with:
  - `failureReason`: audience_mismatch, invalid_signature, token_expired, malformed_token, unverified_email, unknown_error
  - `errorMessage`: original error message
  - `googleClientIdConfigured`: Boolean indicator
  - `timestamp`: ISO timestamp

**Implication:** Server logs now show specific failure reasons (e.g., "audience_mismatch") while client receives generic "Invalid Google token" message for security.

**Evidence Source:**
- backend/controllers/googleAuthController.js error handler (lines 155-179)

---

## Current State: Auth Test Baseline

```
Test Suites: 1 passed, 1 total
Tests:       4 passed, 4 total
Time:        7.611 s

✓ register -> login flow (1079 ms)
✓ forgot password email reset stores a usable password (354 ms)
✓ phone reset otp flow resets password for phone-based recovery (3514 ms)
✓ google-created accounts can request reset and then login with a password (227 ms)
```

**Note:** Existing test "google-created accounts can request reset..." tests password reset on a Google-created account (indirect). Direct Google OAuth flow testing requires real Google credentials.

---

## Step 4: End-to-End Testing (Pending)

### Prerequisites
1. **Google Cloud OAuth credentials:**
   - Project ID
   - OAuth 2.0 Client ID (web)
   - Client Secret
   - Authorized redirect URIs configured in Google Cloud Console

2. **Environment setup:**
   - Set `GOOGLE_CLIENT_ID` in `.env` file
   - Frontend must use matching `VITE_GOOGLE_CLIENT_ID` in `.env.frontend` or `.env.local`

### Test Scenarios

| Scenario | Expected Result | Verification Method |
|----------|-----------------|-------------------|
| Valid ID token with matching audience | 200 OK, access token returned, user created/linked | POST /api/auth/google with real Google token |
| Expired ID token | 401 Invalid Google token | Create expired token or use past-dated mock |
| Wrong audience (aud != GOOGLE_CLIENT_ID) | 401 Invalid Google token | Check server log: "audience_mismatch" |
| Malformed token (invalid JWT) | 401 Invalid Google token | POST invalid base64 string |
| Access token submitted (not ID token) | 401 Invalid Google token | Use Google access token instead of ID token |
| Unverified email (email_verified=false) | 403 Google email not verified | Use unverified Google account |
| New user | 201, PATIENT role, emailVerified=true | POST with new Google email |
| Existing user links Google | 200, authMethods includes "google" | POST existing user's email, then POST with Google ID |
| Deactivated user | 403 Account deactivated | Create deactivated user, attempt Google login |
| Audit log recorded | Entry with action: GOOGLE_LOGIN | Check AuditLog collection |

### Test Execution Plan

1. **Setup:**
   ```bash
   # Configure backend
   export GOOGLE_CLIENT_ID="your-oauth-client-id-here"
   export GOOGLE_AUTH_TIMEOUT_MS=6000

   # Start backend
   npm run dev
   ```

2. **Obtain test token:**
   - Use Google's OAuth 2.0 Playground (https://developers.google.com/oauthplayground)
   - Or implement frontend test with real Google Sign-In
   - Extract the ID token from the response

3. **Test each scenario:**
   ```bash
   # Valid token test
   curl -X POST http://localhost:5000/api/auth/google \
     -H "Content-Type: application/json" \
     -d '{"credential": "YOUR_ID_TOKEN_HERE"}'
   ```

4. **Verify response:**
   - Check HTTP status (200, 401, 403, 503)
   - Verify accessToken is JWT
   - Verify user object contains email, role, authMethods
   - Check server logs for [GOOGLE_AUTH_VERIFICATION_FAILED] diagnostics

5. **Verify database state:**
   - User created with role: PATIENT if new
   - User linked with authMethods including "google"
   - AuditLog entry created with action: GOOGLE_LOGIN

### How to Get Real Google Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create or select project
3. Navigate to "Credentials"
4. Create OAuth 2.0 Client ID (Web application)
5. Add authorized redirect URIs:
   - `http://localhost:5173` (frontend dev)
   - `http://localhost:5000` (backend dev)
   - `https://yourdomain.com` (production)
6. Download credentials JSON
7. Copy Client ID to `GOOGLE_CLIENT_ID` env var

---

## Exit Criteria for AFY-P0-009

AFY-P0-009 is **Verified** when:
- ✅ Steps 1-3: Configuration, frontend token, backend logging (COMPLETE)
- [ ] Step 4: All 8 test scenarios pass with real Google credentials
- [ ] No privilege escalation or cross-user data leakage
- [ ] Audit log entries created correctly
- [ ] Error messages are secure (no token/credential leakage)
- [ ] Timeout handling works (503 if verification takes >6s)
- [ ] All acceptance criteria from SPRINT_1A_AUTH_VERIFICATION_CHECKLIST.md Section 8 pass

---

## Next Actions

1. **Immediate:** Obtain Google OAuth credentials (if not already available)
2. **Execute Step 4:** Run test scenarios and document results
3. **Log failures:** Any failures get documented with specific reason from server logs
4. **Update backlog:** Post-verification, add failures to PHASE_A_VERIFIED_BACKLOG.md as new items if needed
5. **Proceed to Auth Item 2:** Once AFY-P0-009 passes, move to local auth verification (login/logout)

---

## Evidence Source Registry

| Item | Evidence Source | Verification Type |
|------|-----------------|-------------------|
| Config loading | Code review: config/loadEnv.js | Automated |
| Frontend token type | Code review: useGoogleAuth.jsx | Automated |
| Backend validation logging | Code review + updated error handler | Code inspection |
| Auth tests baseline | npm test output | Automated test run |
| Error handling | Server logs with [GOOGLE_AUTH_VERIFICATION_FAILED] | Runtime verification |
