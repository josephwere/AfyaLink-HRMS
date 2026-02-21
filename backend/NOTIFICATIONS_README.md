Notifications module added.
Environment variables:
  - TWILIO_ACCOUNT_SID
  - TWILIO_AUTH_TOKEN
  - TWILIO_PHONE_NUMBER
  - AT_API_KEY
  - AT_USERNAME
  - AT_SHORTCODE (optional)
  - SENDGRID_API_KEY OR SMTP_HOST/SMTP_USER/SMTP_PASS
  - VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (for push)
  - REDIS_URL (optional for queue workers)
Worker:
  - workers/notificationWorker.js (run separately or let it start in-process if REDIS_URL set)
