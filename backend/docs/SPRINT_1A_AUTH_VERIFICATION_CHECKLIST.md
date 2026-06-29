# Sprint 1A: Authentication Verification Checklist

**Purpose:** Complete operational verification of all authentication flows, RBAC gates, session management, and audit logging before progression to patient management and clinical workflows.

**Exit Criteria:** Every item below passes with no privilege escalation, token leakage, or cross-tenant data exposure.

**Owner:** TBD
**Status:** Not Started
**Evidence base:** [PHASE_A_VERIFIED_BACKLOG.md](./PHASE_A_VERIFIED_BACKLOG.md), [AFY-P0-001 through AFY-P0-009]

---

## 1. Endpoint availability and routing

### 1.1 Authentication routes are registered
- [ ] Verify all auth routes are registered: `/api/auth/register`, `/api/auth/login`, `/api/auth/logout`, `/api/auth/me`, `/api/auth/refresh`
- [ ] Verify Google route is registered: POST `/api/auth/google`
- [ ] Verify OTP routes are registered: POST `/api/auth/phone/request-otp`, `/api/auth/phone/verify`
- [ ] Verify 2FA routes are registered: POST `/api/auth/2fa/verify`, `/api/auth/2fa/resend`
- [ ] Verify password reset routes exist: POST `/api/auth/forgot-password`, `/api/auth/reset-password`
- [ ] Verify step-up verification routes exist: POST `/api/auth/step-up/request`, `/api/auth/step-up/verify`
- [ ] Verify health/readiness routes exist: GET `/api/health`, `/readyz`
- [ ] Evidence: `backend/routes/authRoutes.js`

### 1.2 Authentication middleware is applied
- [ ] All `/api` endpoints (except `/api/health`, `/readyz`, `/api/auth/*`) require JWT
- [ ] Admin endpoints require `twoFactorVerified: true` in JWT
- [ ] Hospital-scoped endpoints filter by `req.user.hospital` or `req.user.hospitalId`
- [ ] Evidence: `backend/middleware/authMiddleware.js`, `backend/app.js`

---

## 2. Local authentication flow (email/password)

### 2.1 User registration
- [ ] New user can register with valid email and password
- [ ] Password is hashed (never stored plaintext)
- [ ] User role defaults to PATIENT
- [ ] User email is marked as verified for local auth flow
- [ ] New user receives Brevo contact sync event (source: REGISTER)
- [ ] User created with `active: true`
- [ ] Registration is rate-limited
- [ ] Duplicate email is rejected with 400 "Email already in use"
- [ ] Weak passwords are rejected (must include uppercase, lowercase, digit, symbol, 8+ chars)
- [ ] Audit log records USER_REGISTERED action
- [ ] Evidence: `backend/controllers/authController.js` - `register()`, `backend/models/User.js`

### 2.2 User login with correct credentials
- [ ] User can login with correct email and password
- [ ] Access token is returned
- [ ] Refresh token is set in HttpOnly cookie
- [ ] Refresh token is stored in database
- [ ] Session ID is created and stored
- [ ] For admin users: login does NOT auto-verify 2FA (requires separate 2FA flow)
- [ ] Audit log records USER_LOGIN action
- [ ] User object contains: id, name, email, role, emailVerified, phoneVerified, authProvider, authMethods
- [ ] Response includes `twoFactorVerified: false` for admin users who haven't completed 2FA
- [ ] Evidence: `backend/controllers/authController.js` - `login()`

### 2.3 User login with incorrect credentials
- [ ] Login with wrong password is rejected with 401 "Invalid credentials"
- [ ] Login with non-existent email is rejected with 401 "Invalid credentials"
- [ ] Failed login attempts are rate-limited
- [ ] Audit log records failed login attempts
- [ ] No information leakage about whether email exists
- [ ] Evidence: `backend/controllers/authController.js` - `login()`

### 2.4 User logout
- [ ] Authenticated user can logout successfully
- [ ] Refresh token cookie is cleared
- [ ] Refresh token is revoked in database
- [ ] Access token becomes invalid immediately after logout
- [ ] Refresh token cannot be used to generate new access tokens
- [ ] Attempting to use revoked refresh token returns 401
- [ ] Audit log records LOGOUT action
- [ ] Evidence: `backend/controllers/authController.js` - `logout()`

---

## 3. Token lifecycle and refresh

### 3.1 Access token validity
- [ ] Access token is a valid JWT
- [ ] Access token contains: id, name, email, role, emailVerified, phoneVerified, twoFactorVerified, hospital, hospitalId
- [ ] Access token expiry is set to configured value (default 1 hour)
- [ ] Access token is signed with JWT_ACCESS_SECRET (or JWT_SECRET as fallback)
- [ ] Expired access token is rejected with 401
- [ ] Malformed access token is rejected with 401
- [ ] Token with invalid signature is rejected with 401
- [ ] Evidence: `backend/utils/jwt.js`, `backend/middleware/authMiddleware.js`

### 3.2 Refresh token validity
- [ ] Refresh token is a valid JWT
- [ ] Refresh token contains: id, sessionStartedAt, sessionId
- [ ] Refresh token is set as HttpOnly, Secure, SameSite cookie
- [ ] Refresh token expiry is set to configured value (default 7 days)
- [ ] Refresh token is signed with JWT_REFRESH_SECRET (or JWT_SECRET as fallback)
- [ ] Evidence: `backend/utils/jwt.js`, `backend/utils/authCookies.js`

### 3.3 Token refresh flow
- [ ] Authenticated user can refresh access token using valid refresh token
- [ ] Refresh endpoint returns new access token
- [ ] Refresh endpoint returns new refresh token (optional rotation)
- [ ] Refresh token is stored in database and validated on refresh
- [ ] Invalid refresh token is rejected with 401
- [ ] Expired refresh token is rejected with 401
- [ ] Refresh token from logged-out user is rejected with 401
- [ ] Each refresh updates session last-activity timestamp
- [ ] Audit log records REFRESH_TOKEN action
- [ ] Evidence: `backend/controllers/refreshController.js`

### 3.4 Session management
- [ ] Each login creates a unique session ID
- [ ] Session ID is stored in database with user
- [ ] Session expiry is enforced at configured interval
- [ ] Logout revokes all sessions for that user (or specific session only)
- [ ] Risk-restricted sessions block non-exempt endpoints
- [ ] 2FA-pending sessions block privileged endpoints
- [ ] Evidence: `backend/utils/authSessions.js`, `backend/middleware/authMiddleware.js`

---

## 4. Two-factor authentication (2FA)

### 4.1 2FA enrollment (admin workflow)
- [ ] Admin user (role: SYSTEM_ADMIN or higher) is prompted for 2FA on first login
- [ ] 2FA enrollment generates TOTP secret via speakeasy
- [ ] QR code or secret string is returned to frontend
- [ ] Frontend scans QR code or enters secret into authenticator app
- [ ] Backend stores encrypted TOTP secret in User.twoFactorSecret
- [ ] Evidence: `backend/controllers/authController.js` - 2FA enrollment functions

### 4.2 2FA verification (post-login)
- [ ] After login, admin receives OTP prompt
- [ ] Admin enters 6-digit TOTP code from authenticator app
- [ ] Backend verifies TOTP against stored secret
- [ ] Valid OTP returns new JWT with `twoFactorVerified: true`
- [ ] Invalid OTP is rejected with 401
- [ ] OTP is time-window tolerant (±30 seconds)
- [ ] OTP cannot be reused within time window
- [ ] Audit log records 2FA_VERIFIED or 2FA_FAILED action
- [ ] Evidence: `backend/controllers/authController.js` - `verify2FAOtp()`

### 4.3 2FA recovery flow
- [ ] If TOTP device is lost, admin can request recovery flow
- [ ] Recovery requires identity verification (email + admin override)
- [ ] Recovery generates new TOTP secret
- [ ] Old TOTP secret is invalidated
- [ ] Audit log records 2FA_RECOVERY action
- [ ] Evidence: `backend/controllers/authController.js`

### 4.4 Admin without 2FA is blocked from privileged endpoints
- [ ] Admin login returns `twoFactorVerified: false`
- [ ] Requests with this JWT to privileged endpoints return 403 "Two-factor verification required"
- [ ] Only non-privileged endpoints (me, refresh) are accessible
- [ ] Evidence: `backend/middleware/authMiddleware.js` - admin 2FA gate

---

## 5. One-time password (OTP) via SMS

### 5.1 OTP request flow
- [ ] User can request OTP via POST `/api/auth/phone/request-otp`
- [ ] OTP is 6-digit random number
- [ ] OTP is sent via Twilio SMS to user's phone
- [ ] OTP expiry is set to 10 minutes
- [ ] OTP is stored in Redis and OTP model for redundancy
- [ ] Rate-limit: max 3 OTP requests per phone per hour
- [ ] Audit log records OTP_REQUESTED action
- [ ] Evidence: `backend/controllers/authController.js` - `requestPhoneOtp()`

### 5.2 OTP verification flow
- [ ] User can verify OTP via POST `/api/auth/phone/verify`
- [ ] Valid OTP returns access + refresh tokens
- [ ] Invalid OTP is rejected with 401
- [ ] Expired OTP is rejected with 401
- [ ] OTP cannot be reused
- [ ] Successful verification marks user as `phoneVerified: true`
- [ ] Audit log records OTP_VERIFIED or OTP_FAILED action
- [ ] Evidence: `backend/controllers/authController.js` - `verifyPhoneOtp()`

---

## 6. Password reset flow

### 6.1 Forgot password request
- [ ] User can request password reset via POST `/api/auth/forgot-password`
- [ ] Reset token is generated (random, hashed)
- [ ] Reset token expiry is set to 1 hour
- [ ] Reset token is sent to user's email
- [ ] Email rate-limit: max 3 requests per email per hour
- [ ] Reset token is stored in database
- [ ] Response does not leak whether email exists
- [ ] Audit log records PASSWORD_RESET_REQUESTED action
- [ ] Evidence: `backend/controllers/authController.js` - `forgotPassword()`

### 6.2 Password reset execution
- [ ] User can reset password via POST `/api/auth/reset-password` with valid token
- [ ] New password must be strong (uppercase, lowercase, digit, symbol, 8+ chars)
- [ ] Password is hashed and stored
- [ ] Old refresh tokens are invalidated (user must login again)
- [ ] Reset token is invalidated after use
- [ ] Invalid or expired token is rejected with 400
- [ ] Audit log records PASSWORD_RESET_CONFIRMED action
- [ ] Evidence: `backend/controllers/authController.js` - `resetPassword()`

### 6.3 Google-created accounts can add password
- [ ] Google-only accounts (no local password) can request password reset
- [ ] Reset flow allows setting a password for local auth method
- [ ] Account authMethods is updated to include "local"
- [ ] Account can login via both Google and local auth after this
- [ ] Evidence: `backend/tests/auth.test.js` - "google-created accounts can request reset and then login with a password"

---

## 7. Step-up verification (privileged actions)

### 7.1 Step-up OTP request
- [ ] Authenticated user can request step-up verification via POST `/api/auth/step-up/request`
- [ ] Step-up OTP is 6-digit random number
- [ ] OTP is sent via SMS to user's phone
- [ ] OTP expiry is set to 10 minutes
- [ ] Rate-limit: max 5 step-up requests per user per hour
- [ ] Audit log records STEP_UP_REQUESTED action
- [ ] Evidence: `backend/controllers/authController.js` - `requestStepUpOtp()`

### 7.2 Step-up OTP verification
- [ ] Authenticated user can verify step-up OTP
- [ ] Valid OTP returns step-up JWT with `stepUpVerified: true`
- [ ] Step-up JWT allows privileged action for 5 minutes
- [ ] Invalid OTP is rejected with 401
- [ ] Expired OTP is rejected with 401
- [ ] Audit log records STEP_UP_VERIFIED action
- [ ] Evidence: `backend/controllers/authController.js` - `verifyStepUpOtp()`

### 7.3 Step-up enforcement
- [ ] Privileged endpoints (e.g., account deletion) require `stepUpVerified: true`
- [ ] Requests without step-up verification are rejected with 403 "Step-up verification required"
- [ ] Step-up JWT expires after 5 minutes
- [ ] Evidence: `backend/middleware/authMiddleware.js` - step-up gate

---

## 8. Google OAuth flow (AFY-P0-009)

### 8.1 Google token verification setup
- [ ] GOOGLE_CLIENT_ID is configured in `.env`
- [ ] GOOGLE_CLIENT_ID matches Google Cloud OAuth credentials
- [ ] OAuth2Client is initialized with correct GOOGLE_CLIENT_ID
- [ ] Evidence: `backend/controllers/googleAuthController.js`, `.env.example`

### 8.2 Google Sign-In from new user
- [ ] Frontend initiates Google Sign-In and receives ID token
- [ ] Frontend sends ID token to POST `/api/auth/google`
- [ ] Backend receives credential (ID token) in request body
- [ ] Backend calls `client.verifyIdToken()` with audience check
- [ ] Verification succeeds for valid, unexpired ID token with matching audience
- [ ] User is created with PATIENT role
- [ ] User email is marked as verified (from Google email_verified claim)
- [ ] User is marked active
- [ ] Access token is returned with `twoFactorVerified: true`
- [ ] Refresh token is set in HttpOnly cookie
- [ ] Brevo contact sync is queued (source: GOOGLE_LOGIN_CONTROLLER_REGISTER)
- [ ] Audit log records GOOGLE_LOGIN action
- [ ] Evidence: `backend/controllers/googleAuthController.js` - `googleLogin()`

### 8.3 Google Sign-In from existing user with local auth
- [ ] Existing local user signs in with Google using same email
- [ ] Backend finds user by email
- [ ] User is linked to Google (googleId is set)
- [ ] User authMethods includes both "local" and "google"
- [ ] User can login via both Google and local password after linking
- [ ] Access token is returned
- [ ] Audit log records GOOGLE_LOGIN action
- [ ] Evidence: `backend/controllers/googleAuthController.js` - link flow

### 8.4 Google Sign-In from existing Google user
- [ ] Google user signs in again with same Google account
- [ ] Backend finds user by googleId
- [ ] Login succeeds
- [ ] No duplicate user is created
- [ ] Session is created and tokens returned
- [ ] Evidence: `backend/controllers/googleAuthController.js`

### 8.5 Invalid Google token rejection
- [ ] Token with invalid signature is rejected with 401 "Invalid Google token"
- [ ] Expired token is rejected with 401 "Invalid Google token"
- [ ] Malformed token is rejected with 401 "Invalid Google token"
- [ ] Token with wrong audience (aud != GOOGLE_CLIENT_ID) is rejected with 401 "Invalid Google token"
- [ ] Token with unverified email is rejected with 403 "Google email not verified"
- [ ] Missing credential in request is rejected with 400 "Missing Google credential"
- [ ] Evidence: `backend/controllers/googleAuthController.js` - error handling

### 8.6 Google OAuth timeout handling
- [ ] Token verification timeout returns 503 "Google sign-in is temporarily unavailable"
- [ ] User database lookup timeout returns 503
- [ ] GOOGLE_AUTH_TIMEOUT_MS is configurable (default 6000ms)
- [ ] Evidence: `backend/controllers/googleAuthController.js` - `withGoogleAuthTimeout()`

---

## 9. Role-based access control (RBAC)

### 9.1 Role hierarchy
- [ ] SUPER_ADMIN (100) can access all endpoints
- [ ] SYSTEM_ADMIN (90) can access all endpoints except super-admin-only
- [ ] HOSPITAL_ADMIN (80) can access hospital-scoped data only
- [ ] DOCTOR (60) can access assigned patients only
- [ ] NURSE (50) can access assigned patients only
- [ ] PATIENT (10) can access own data only
- [ ] DEVELOPER (30) can access diagnostic endpoints
- [ ] Evidence: `backend/middleware/roleMiddleware.js`, `backend/config/permissions.js`

### 9.2 Role enforcement on protected endpoints
- [ ] Endpoints requiring SUPER_ADMIN reject SYSTEM_ADMIN with 403
- [ ] Endpoints requiring HOSPITAL_ADMIN reject PATIENT with 403
- [ ] Endpoints without role requirement allow all authenticated users
- [ ] Missing role in JWT returns 403 "Insufficient permissions"
- [ ] Evidence: `backend/middleware/roleMiddleware.js` - `permit()` and `requireRole()`

### 9.3 Effective role (read-only override)
- [ ] Users with read-only override can access data endpoints
- [ ] Users with read-only override cannot mutate data (POST, PUT, DELETE rejected with 403)
- [ ] Evidence: `backend/middleware/roleMiddleware.js` - `isReadOnlyOverrideAllowed()`

### 9.4 Privilege bypass (for development/admin)
- [ ] Users with privilege bypass override can bypass role checks
- [ ] Privilege bypass is logged in audit trail
- [ ] Privilege bypass is only allowed for specific roles (SUPER_ADMIN, SYSTEM_ADMIN)
- [ ] Evidence: `backend/middleware/roleMiddleware.js` - `isPrivilegedOverrideAllowed()`

---

## 10. Multi-tenancy and hospital isolation

### 10.1 Hospital context in JWT
- [ ] All JWTs contain `hospital` (ObjectId) and `hospitalId` (string)
- [ ] Hospital is set from user.hospital reference
- [ ] HospitalId is set from hospital._id
- [ ] Both fields are present and consistent
- [ ] Evidence: `backend/utils/jwt.js` - `signAccessToken()`

### 10.2 Query filtering by hospital
- [ ] All user queries filter by `{ hospital: req.user.hospital }` or `{ hospitalId: req.user.hospitalId }`
- [ ] PATIENT users can only see their own hospital's data
- [ ] DOCTOR users can only see their hospital's patient data
- [ ] HOSPITAL_ADMIN users can only see their hospital's data
- [ ] SUPER_ADMIN and SYSTEM_ADMIN have unrestricted access
- [ ] Evidence: `backend/middleware/authMiddleware.js`, all route handlers

### 10.3 Cross-hospital access prevention
- [ ] HOSPITAL_ADMIN cannot query data from other hospitals
- [ ] DOCTOR cannot query patient data from other hospitals
- [ ] PATIENT cannot see patient data from other hospitals
- [ ] Test scenario: HOSPITAL_ADMIN from Hospital A requests Hospital B patient → 403 or empty result
- [ ] Evidence: `backend/tests/hospitalVerification.test.js`

### 10.4 Hospital in audit logs
- [ ] Audit log entries record hospital context (`actorHospital`, `resourceHospital`)
- [ ] Audit queries are filtered by hospital for HOSPITAL_ADMIN
- [ ] SUPER_ADMIN can see audit entries from all hospitals
- [ ] Evidence: `backend/routes/auditRoutes.js` - hospital filtering

---

## 11. Error handling and edge cases

### 11.1 Missing authorization header
- [ ] Request without Authorization header is rejected with 401 "No token provided"
- [ ] Empty Authorization header is rejected with 401
- [ ] Evidence: `backend/middleware/authMiddleware.js` - token extraction

### 11.2 Malformed authorization header
- [ ] Authorization header without "Bearer" prefix is rejected with 401
- [ ] Authorization header with multiple tokens is rejected with 401
- [ ] Evidence: `backend/middleware/authMiddleware.js`

### 11.3 Database unavailability
- [ ] Timeout on user lookup returns 503 with configurable timeout
- [ ] Timeout on token verification returns 503
- [ ] /readyz endpoint returns 503 when database is unavailable
- [ ] /api/* endpoints return 503 when database is unavailable (except health endpoints)
- [ ] Evidence: `backend/app.js` - DB readiness gate, `backend/middleware/authMiddleware.js` - timeout handling

### 11.4 Redis unavailability (session/risk management)
- [ ] If Redis is unavailable, requests proceed with degraded session management
- [ ] Risk-restricted sessions still work via database fallback
- [ ] 2FA sessions still work via database fallback
- [ ] No request is blocked solely due to Redis unavailability
- [ ] Evidence: `backend/middleware/authMiddleware.js` - Redis fallback logic

### 11.5 Deactivated user
- [ ] Deactivated user (active: false) cannot login
- [ ] Deactivated user with existing JWT is blocked on next request
- [ ] Deactivated user is rejected with 403 "Account is deactivated"
- [ ] Evidence: `backend/controllers/authController.js`, `backend/middleware/authMiddleware.js`

---

## 12. Session risk management

### 12.1 Risk assessment on login
- [ ] Login triggers risk assessment
- [ ] Risk score is calculated from IP, device, location, velocity
- [ ] High-risk login is stored in Redis (key: risk:restricted:{userId})
- [ ] High-risk login requires step-up verification for certain endpoints
- [ ] Evidence: `backend/utils/riskAssessment.js`, `backend/controllers/authController.js`

### 12.2 Risk-restricted session blocking
- [ ] Endpoints marked as high-risk require step-up verification if user is risk-restricted
- [ ] Exempt endpoints (me, refresh, logout) do not require step-up
- [ ] Request without step-up verification is rejected with 403 "Step-up verification required"
- [ ] Step-up verification clears risk restriction
- [ ] Evidence: `backend/middleware/authMiddleware.js` - risk restriction gate

### 12.3 Risk session expiry
- [ ] Risk restriction expires after configured timeout (default 1 hour)
- [ ] User can request step-up verification to clear restriction immediately
- [ ] Risk entry is cleaned from Redis after expiry
- [ ] Evidence: `backend/utils/riskAssessment.js`

---

## 13. Audit logging

### 13.1 Audit log creation
- [ ] All auth actions are logged: LOGIN, LOGOUT, REGISTER, GOOGLE_LOGIN, 2FA_VERIFIED, OTP_VERIFIED, PASSWORD_RESET_*, etc.
- [ ] Each audit entry contains: actorId, actorRole, action, resource, resourceId, hospital, timestamp
- [ ] Sensitive data (passwords, tokens) is never logged
- [ ] Evidence: `backend/models/AuditLog.js`, `backend/routes/auditRoutes.js`

### 13.2 Audit log immutability (if enabled)
- [ ] AUDIT_LOG_IMMUTABLE flag enables write-once mode
- [ ] Once written, audit entries cannot be modified or deleted
- [ ] Compliance ledger stores verified immutable entries
- [ ] Evidence: `backend/models/AuditLog.js`, `backend/models/ComplianceLedger.js`

### 13.3 Audit log querying
- [ ] HOSPITAL_ADMIN can query audit logs from their hospital only
- [ ] SUPER_ADMIN can query audit logs from all hospitals
- [ ] Audit queries support filtering by actor, action, resource, date range
- [ ] Audit queries return immutable compliance ledger entries alongside transient logs
- [ ] Evidence: `backend/routes/auditRoutes.js` - audit query endpoint

### 13.4 Failed authentication audit
- [ ] Failed login attempts are logged (action: LOGIN_FAILED or similar)
- [ ] Failed OTP attempts are logged
- [ ] Failed 2FA attempts are logged
- [ ] Failed password reset attempts are logged
- [ ] Audit entry does not expose passwords or sensitive token details
- [ ] Evidence: `backend/controllers/authController.js`, error handlers

---

## 14. Rate limiting and traffic guards

### 14.1 Auth-sensitive rate limiting
- [ ] Rate limiter on `/api/auth/register`, `/api/auth/login`, `/api/auth/forgot-password`
- [ ] Rate limiter on `/api/auth/phone/request-otp`, `/api/auth/2fa/resend`
- [ ] Exceeding limit returns 429 "Too many requests"
- [ ] Rate limit is per IP and/or user
- [ ] Evidence: `backend/middleware/trafficGuards.js`, `backend/routes/authRoutes.js`

### 14.2 Token refresh rate limiting
- [ ] Rate limiter on `/api/auth/refresh` to prevent token refresh loops
- [ ] Exceeding limit returns 429
- [ ] Evidence: `backend/middleware/trafficGuards.js`

---

## 15. Integration: Auth + Notifications

### 15.1 Notifications on login
- [ ] Login triggers notification delivery (if configured)
- [ ] Notification includes login timestamp, device, IP
- [ ] User receives notification via push, email, or SMS
- [ ] Evidence: `backend/notifications/` handlers

### 15.2 Notifications on failed login
- [ ] Failed login attempts may trigger security alert notification
- [ ] Notification includes attempt count, IP, timestamp
- [ ] Evidence: `backend/notifications/` handlers

---

## 16. Integration: Auth + Offline

### 16.1 Offline client authentication
- [ ] Offline client can queue authentication requests
- [ ] Offline client can persist refresh tokens locally
- [ ] Offline client syncs authentication state when connectivity restored
- [ ] Evidence: `backend/routes/offlineRoutes.js`, offline queue handlers

---

## Exit Criteria

Sprint 1A Auth verification is complete when:
- ✅ All 16 sections have all checkbox items marked complete
- ✅ No privilege escalation or token leakage detected
- ✅ No cross-tenant data exposure
- ✅ All error messages are consistent and secure (no information leakage)
- ✅ All audit logs are complete and immutable
- ✅ Rate limiting works as designed
- ✅ Google OAuth AFY-P0-009 is verified and all criteria passed
- ✅ Test coverage includes all auth paths (target: >90% coverage)
- ✅ Documentation is updated with verified configuration

---

## Test Execution Plan

1. **Unit tests:** Run existing auth tests to establish baseline
   - `cd backend && npm test -- tests/auth.test.js`
   - `cd backend && npm test -- tests/securityHardening.test.js`

2. **Integration tests:** Create comprehensive auth integration suite
   - Test each flow with valid and invalid inputs
   - Test cross-tenant isolation scenarios
   - Test error handling and edge cases

3. **Manual smoke tests:** Execute critical flows manually
   - Google OAuth with real Google credentials
   - Session management across browser/client resets
   - Risk-restricted flows with step-up verification

4. **Security verification:**
   - Token introspection (ensure no leakage in JWT)
   - Privilege bypass attempts
   - Cross-tenant query attempts
   - Rate limit enforcement

---

## Risk Summary

| Risk | Severity | Mitigation |
|---|---|---|
| Google OAuth root cause unknown | P0 | AFY-P0-009 acceptance criteria covers all failure modes |
| Token leakage in logs or errors | P0 | Audit all error responses and logs for sensitive data |
| Cross-tenant data exposure | P0 | Test cross-hospital queries with multiple roles |
| Rate limiting bypass | P1 | Verify rate limits per IP and per user |
| Redis/database timeout not handled | P1 | Test auth flows with unavailable Redis/DB |
