# AfyaLink Deployment (Nginx + HAProxy + systemd)

## 1) Backend instances (systemd)
Copy unit:
- `deploy/systemd/afyalink-backend@.service` -> `/etc/systemd/system/afyalink-backend@.service`

Create env file:
- `/etc/afyalink/backend.env` with production variables (MONGO_URI, JWT secrets, payment keys, etc).

Start two backend instances for load balancing:
- `sudo systemctl daemon-reload`
- `sudo systemctl enable --now afyalink-backend@5001`
- `sudo systemctl enable --now afyalink-backend@5002`

## 2) HAProxy
Copy config:
- `deploy/haproxy/haproxy.cfg` -> `/etc/haproxy/haproxy.cfg`

Restart:
- `sudo systemctl restart haproxy`
- `sudo systemctl enable haproxy`

## 3) Frontend build
Copy service:
- `deploy/systemd/afyalink-frontend-build.service` -> `/etc/systemd/system/afyalink-frontend-build.service`

Build:
- `sudo systemctl daemon-reload`
- `sudo systemctl start afyalink-frontend-build`

## 4) Nginx reverse proxy
Copy config:
- `deploy/nginx/afyalink.conf` -> `/etc/nginx/sites-available/afyalink.conf`

Enable site:
- `sudo ln -s /etc/nginx/sites-available/afyalink.conf /etc/nginx/sites-enabled/afyalink.conf`
- `sudo nginx -t`
- `sudo systemctl restart nginx`
- `sudo systemctl enable nginx`

## 5) Verify
- `curl -f https://your-domain/healthz`
- `curl -f https://your-domain/readyz`
- `curl -f https://your-domain/api/system-settings`
- `curl -f https://your-domain/api/migrations`
- `curl -f https://your-domain/api/communication/channels`

## 6) Zero-downtime deploy flow
1. Deploy new code to `/opt/afyalink`.
2. Rebuild frontend (`afyalink-frontend-build`).
3. Restart one backend instance, wait for `/readyz`.
4. Restart second backend instance, wait for `/readyz`.
5. Monitor logs and latency.

## 7) Migration rollout (legacy hospital systems)
1. Create migration project from UI: `/system-admin/migrations`.
2. Test source connector and interoperability (FHIR/HL7/API).
3. Run dry-run and fix mapping/data quality issues.
4. Enable parallel run (dual-write) for uninterrupted operations.
5. Perform controlled cutover window.
6. Validate workflows and export `/api/audit/evidence-bundle` for governance archive.
