import test from 'node:test';
import assert from 'node:assert/strict';

import { summarizePlaywrightReport } from './certify-deployment.mjs';

test('summarizePlaywrightReport marks failed and timedOut statuses as failures', () => {
  const report = {
    stats: { expected: 2, unexpected: 2, duration: 1200 },
    suites: [
      {
        specs: [
          {
            title: 'Login flow',
            tests: [
              {
                status: 'unexpected',
                results: [{ status: 'failed', duration: 1000 }],
              },
            ],
          },
          {
            title: 'CRUD flow',
            tests: [
              {
                status: 'expected',
                results: [{ status: 'passed', duration: 400 }],
              },
            ],
          },
        ],
      },
    ],
  };

  const summary = summarizePlaywrightReport(report);

  assert.equal(summary.failedTests.length, 1);
  assert.equal(summary.failedTests[0].title, 'Login flow');
  assert.equal(summary.testPerformance[0].status, 'failed');
});

test('summarizePlaywrightReport treats passed tests as successes', () => {
  const report = {
    stats: { expected: 1, unexpected: 0, duration: 400 },
    suites: [
      {
        specs: [
          {
            title: 'Happy path',
            tests: [
              {
                status: 'expected',
                results: [{ status: 'passed', duration: 400 }],
              },
            ],
          },
        ],
      },
    ],
  };

  const summary = summarizePlaywrightReport(report);

  assert.equal(summary.failedTests.length, 0);
  assert.equal(summary.testPerformance[0].status, 'passed');
});
