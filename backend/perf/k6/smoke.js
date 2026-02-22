import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 5,
  duration: '30s',
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<1200'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:5000';

export default function () {
  const health = http.get(`${BASE_URL}/healthz`);
  check(health, {
    'health status 200': (r) => r.status === 200,
  });

  const ready = http.get(`${BASE_URL}/readyz`);
  check(ready, {
    'ready status 200 or 503': (r) => r.status === 200 || r.status === 503,
  });

  sleep(1);
}
