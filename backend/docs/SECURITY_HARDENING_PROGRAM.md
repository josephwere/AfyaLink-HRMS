# Enterprise Security Hardening Program

## Priority Controls
1. Secrets management
- Move all secrets from .env to managed secrets service in production.
- Enforce rotation policy and break-glass access logs.

2. Key management
- Dedicated KMS keys per environment.
- Rotation cadence and key usage audit.

3. Application security
- CI SAST + dependency scanning.
- DAST on staging before every major release.
- WAF and rate-limit protections for exposed endpoints.

4. Identity security
- Enforce 2FA for privileged roles.
- Step-up auth for high-risk operations.
- Session-risk based restrictions.

5. Verification and assurance
- Quarterly external penetration test.
- Annual red-team simulation.
- Monthly security review and backlog burn-down.
