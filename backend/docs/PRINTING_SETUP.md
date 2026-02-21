# AfyaLink Printing Setup

AfyaLink now provides a `Print Center` UI and backend queue:

- `GET /api/printing/connectors`
- `GET/POST/PATCH /api/printing/profiles`
- `GET/POST /api/printing/jobs`
- `PATCH /api/printing/jobs/:id/status`

## Supported providers

- `BROWSER`: uses browser print dialog.
- `PDF`: renders printable HTML and can be saved as PDF.
- `IPP`: configure IPP URL and queue in printer profile.
- `QZ_TRAY`: desktop bridge flow (optional).
- `CUPS`: server/agent bridge flow (optional).

## Optional bridge environment variables

Set these on backend if you run a print agent:

- `QZ_TRAY_BRIDGE_URL=http://localhost:8182`
- `CUPS_BRIDGE_URL=http://localhost:631`

## Recommended rollout

1. Create one default printer profile per hospital in `Print Center`.
2. Run test print from `Print Center` (queues job + opens printable document).
3. For direct printer routing, deploy local agent and update profile provider to `IPP`, `QZ_TRAY`, or `CUPS`.
4. Monitor `Print Job History` and audit logs.

