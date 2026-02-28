import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  scenarios: {
    kenya_peak: {
      executor: 'ramping-arrival-rate',
      startRate: 100,
      timeUnit: '1s',
      preAllocatedVUs: 200,
      maxVUs: 1500,
      stages: [
        { target: 500, duration: '2m' },
        { target: 1000, duration: '3m' },
        { target: 1500, duration: '3m' },
        { target: 200, duration: '2m' },
      ],
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.02'],
    http_req_duration: ['p(95)<1500', 'p(99)<2500'],
    checks: ['rate>0.98'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:5000';

function doHealth() {
  const health = http.get(`${BASE_URL}/healthz`);
  check(health, {
    'healthz 200': (r) => r.status === 200,
  });

  const ready = http.get(`${BASE_URL}/readyz`);
  check(ready, {
    'readyz 200/503': (r) => r.status === 200 || r.status === 503,
  });
}

function doPublicBranding() {
  const branding = http.get(`${BASE_URL}/api/system-settings/public`);
  check(branding, {
    'branding responds': (r) => r.status === 200 || r.status === 304,
  });
}

export default function () {
  doHealth();
  doPublicBranding();
  sleep(0.2);
}
