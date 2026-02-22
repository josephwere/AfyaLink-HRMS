import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  scenarios: {
    clinicians: {
      executor: 'ramping-vus',
      startVUs: 20,
      stages: [
        { duration: '2m', target: 120 },
        { duration: '4m', target: 180 },
        { duration: '2m', target: 120 },
        { duration: '2m', target: 0 },
      ],
      exec: 'clinicianFlow',
    },
    admin: {
      executor: 'constant-vus',
      vus: 30,
      duration: '10m',
      exec: 'adminFlow',
    },
    patients: {
      executor: 'constant-arrival-rate',
      rate: 40,
      timeUnit: '1s',
      duration: '10m',
      preAllocatedVUs: 50,
      maxVUs: 150,
      exec: 'patientFlow',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.02'],
    http_req_duration: ['p(95)<1500'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:5000';
const AUTH_TOKEN = __ENV.AUTH_TOKEN || '';

function authHeaders() {
  const headers = { 'Content-Type': 'application/json' };
  if (AUTH_TOKEN) headers.Authorization = `Bearer ${AUTH_TOKEN}`;
  return headers;
}

export function clinicianFlow() {
  const params = { headers: authHeaders() };
  const profile = http.get(`${BASE_URL}/api/profile`, params);
  check(profile, {
    'profile responds': (r) => [200, 304, 401].includes(r.status),
  });

  const appts = http.get(`${BASE_URL}/api/appointments`, params);
  check(appts, {
    'appointments responds': (r) => [200, 304, 401].includes(r.status),
  });

  sleep(1);
}

export function adminFlow() {
  const params = { headers: authHeaders() };
  const dash = http.get(`${BASE_URL}/api/dashboard/super-admin`, params);
  check(dash, {
    'super-admin dashboard responds': (r) => [200, 304, 401, 403].includes(r.status),
  });

  const notifs = http.get(`${BASE_URL}/api/notifications/list`, params);
  check(notifs, {
    'notifications responds': (r) => [200, 304, 401].includes(r.status),
  });

  sleep(1);
}

export function patientFlow() {
  const params = { headers: authHeaders() };
  const menu = http.get(`${BASE_URL}/api/menu`, params);
  check(menu, {
    'menu responds': (r) => [200, 304, 401].includes(r.status),
  });

  const hospitals = http.get(`${BASE_URL}/api/hospitals`, params);
  check(hospitals, {
    'hospitals responds': (r) => [200, 304, 401].includes(r.status),
  });

  sleep(0.5);
}
