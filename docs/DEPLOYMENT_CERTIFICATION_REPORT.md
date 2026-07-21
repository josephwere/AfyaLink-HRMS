# Appointment Experience RC1 Certification Report

- Generated: 2026-07-20T09:42:53.524Z
- Mode: rc1
- Backend Jest: passed
- Frontend Vitest: passed
- Frontend Build: passed
- Playwright workflow matrix: passed
- Overall: passed

## Commands

- pnpm test -- --runInBand tests/appointments.test.js tests/hospitalVerification.test.js tests/laboratoryRuntime.test.js
- pnpm vitest run src/pages/Patient/appointmentLayoutUtils.test.js src/pages/Patient/appointmentFeatureFlags.test.js --config vitest.config.mjs
- pnpm build
- pnpm exec playwright test tests/e2e/workflows/patient-journey.spec.ts tests/e2e/workflows/laboratory.spec.ts tests/e2e/workflows/pharmacy.spec.ts tests/e2e/workflows/billing.spec.ts tests/e2e/workflows/inpatient.spec.ts tests/e2e/notifications.spec.ts --reporter=json

## Result Summary

- Backend: PASS
- Frontend: PASS
- Build: PASS
- Playwright: PASS

## Backend Output



> afyalink-hrms-backend@1.0.0 test /home/joseph-were/Downloads/AfyaLink-HRMS-main/backend
> NODE_OPTIONS=--experimental-vm-modules jest --runInBand -- --runInBand tests/appointments.test.js tests/hospitalVerification.test.js tests/laboratoryRuntime.test.js

[0mPOST /api/patients [32m201[0m 1421.115 ms - 788[0m
[0mPOST /api/appointments [32m201[0m 1036.460 ms - 546[0m
[0mGET /api/appointments [32m200[0m 584.834 ms - -[0m
[0mPOST /api/appointments [32m201[0m 602.763 ms - 546[0m
[0mPOST /api/appointments [32m201[0m 598.615 ms - 546[0m
[0mPOST /api/appointments [33m409[0m 455.891 ms - 709[0m
[0mPOST /api/appointments [32m201[0m 564.955 ms - 546[0m
[0mPOST /api/hospitals [33m422[0m 807.709 ms - 123[0m
[0mGET /api/hospitals/registry/search?q=Nairobi%20West [32m200[0m 402.215 ms - 406[0m
[0mPOST /api/hospitals [32m201[0m 507.957 ms - -[0m
[0mPOST /api/super-admin/register-hospital-admin [33m400[0m 569.771 ms - 87[0m
[0mGET /api/hospitals/marketplace?limit=50 [32m200[0m 564.866 ms - 864[0m
[0mPOST /api/laboratory [32m201[0m 398.101 ms - 349[0m
[0mPOST /api/laboratory/6a5ded57318938f8d334c522/transition [32m200[0m 171.653 ms - 441[0m
[0mPOST /api/labs [32m201[0m 178.347 ms - 335[0m
[0mPOST /api/labs/6a5ded58318938f8d334c52f/result [32m200[0m 171.309 ms - 410[0m


## Frontend Output



 RUN  v1.6.1 /home/joseph-were/Downloads/AfyaLink-HRMS-main/frontend

 ✓ src/pages/Patient/appointmentLayoutUtils.test.js  (3 tests) 6ms
 ✓ src/pages/Patient/appointmentFeatureFlags.test.js  (2 tests) 6ms

 Test Files  2 passed (2)
      Tests  5 passed (5)
   Start at  12:41:45
   Duration  1.38s (transform 86ms, setup 237ms, collect 67ms, tests 12ms, environment 1.56s, prepare 327ms)



## Build Output



> afyalink-frontend-v5@ build /home/joseph-were/Downloads/AfyaLink-HRMS-main/frontend
> vite build

vite v6.4.3 building for production...
transforming...
✓ 1291 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                                   3.11 kB │ gzip:   1.13 kB
dist/assets/page-auth-HIa9awgA.css                0.96 kB │ gzip:   0.46 kB
dist/assets/ui-DnSdu4Z4.css                      22.28 kB │ gzip:   4.51 kB
dist/assets/index-BWWz4Wyh.css                  206.19 kB │ gzip:  35.80 kB
dist/assets/InnovationHome-Cb3FCpAB.js            0.33 kB │ gzip:   0.23 kB
dist/assets/CareEscalations-B59oILhe.js           0.46 kB │ gzip:   0.32 kB
dist/assets/PortalHome-T3S0BHZ-.js                0.47 kB │ gzip:   0.31 kB
dist/assets/SchedulingAppointments-xNTOFe1m.js    0.50 kB │ gzip:   0.33 kB
dist/assets/CarePatients-Cq9-11rb.js              0.51 kB │ gzip:   0.33 kB
dist/assets/LeaveRequests-Ci53IirS.js             0.51 kB │ gzip:   0.33 kB
dist/assets/Performance-CSEqUqfA.js               0.51 kB │ gzip:   0.33 kB
dist/assets/PeopleHome-BPcayA_V.js                0.53 kB │ gzip:   0.34 kB
dist/assets/PlatformHome-KUsHNSLV.js              0.69 kB │ gzip:   0.40 kB
dist/assets/CareHome-B-Yef43M.js                  0.69 kB │ gzip:   0.41 kB
dist/assets/OperationsHome-ddJTFi8_.js            0.76 kB │ gzip:   0.44 kB
dist/assets/page-public-Di8YV-Oq.js               2.41 kB │ gzip:   1.01 kB
dist/assets/oauth-zwKm_cf7.js                     2.63 kB │ gzip:   1.12 kB
dist/assets/socket-DD7iSemm.js                   12.51 kB │ gzip:   4.08 kB
dist/assets/page-staff-lite-Ca_KVcxI.js          12.90 kB │ gzip:   2.85 kB
dist/assets/page-legal-ByDjukce.js               16.24 kB │ gzip:   5.72 kB
dist/assets/page-ai-BUbGG7rZ.js                  17.04 kB │ gzip:   5.25 kB
dist/assets/page-ops-lite-Cy35Z9YN.js            21.23 kB │ gzip:   5.26 kB
dist/assets/page-workflow-lite-BLxpZTpr.js       26.45 kB │ gzip:   7.70 kB
dist/assets/page-admin-lite-Bqq5MS4D.js          27.71 kB │ gzip:   7.04 kB
dist/assets/page-auth-CEFT8jLv.js                35.39 kB │ gzip:   9.22 kB
dist/assets/page-innovation-CL8fgTVI.js          46.04 kB │ gzip:   9.02 kB
dist/assets/page-care-lite-DKRfAbjg.js           54.06 kB │ gzip:  13.24 kB
dist/assets/index-MYMCuTS3.js                    65.37 kB │ gzip:  11.56 kB
dist/assets/page-ops-core-DgJopatL.js            69.65 kB │ gzip:  13.75 kB
dist/assets/page-clinical-lite-B2LMS2dM.js       75.06 kB │ gzip:  15.11 kB
dist/assets/page-superadmin-BYocbjhq.js          80.07 kB │ gzip:  18.50 kB
dist/assets/page-profile.jsx-CL9QjsMO.js         92.31 kB │ gzip:  25.30 kB
dist/assets/page-doctor-CAXmpnhH.js              98.27 kB │ gzip:  23.55 kB
dist/assets/services-CVnDalBE.js                110.50 kB │ gzip:  27.30 kB
dist/assets/page-patient-DiMxWB6l.js            131.27 kB │ gzip:  31.54 kB
dist/assets/page-admin-CR5iUhub.js              145.74 kB │ gzip:  37.56 kB
dist/assets/page-hospitaladmin-BD31JrXn.js      230.01 kB │ gzip:  54.01 kB
dist/assets/page-systemadmin-YhxEw4xv.js        278.54 kB │ gzip:  59.17 kB
dist/assets/charts-ChJmCVW_.js                  326.08 kB │ gzip:  87.94 kB
dist/assets/ui-CKc3kEOp.js                      364.27 kB │ gzip: 103.29 kB
dist/assets/vendor-Dkc_N5-u.js                  469.83 kB │ gzip: 150.70 kB
✓ built in 12.41s


## Playwright Output


{
  "config": {
    "argv": [
      "/home/joseph-were/.nvm/versions/node/v25.6.1/bin/node",
      "/home/joseph-were/Downloads/AfyaLink-HRMS-main/frontend/node_modules/.pnpm/playwright@1.61.1/node_modules/playwright/cli.js",
      "test",
      "tests/e2e/workflows/patient-journey.spec.ts",
      "tests/e2e/workflows/laboratory.spec.ts",
      "tests/e2e/workflows/pharmacy.spec.ts",
      "tests/e2e/workflows/billing.spec.ts",
      "tests/e2e/workflows/inpatient.spec.ts",
      "tests/e2e/notifications.spec.ts",
      "--reporter=json"
    ],
    "configFile": "/home/joseph-were/Downloads/AfyaLink-HRMS-main/frontend/playwright.config.js",
    "rootDir": "/home/joseph-were/Downloads/AfyaLink-HRMS-main/frontend/tests/e2e",
    "failOnFlakyTests": false,
    "forbidOnly": false,
    "fullyParallel": false,
    "globalSetup": "/home/joseph-were/Downloads/AfyaLink-HRMS-main/frontend/tests/e2e/global.setup.ts",
    "globalTeardown": null,
    "globalTimeout": 0,
    "grep": {},
    "grepInvert": null,
    "maxFailures": 0,
    "metadata": {
      "actualWorkers": 1
    },
    "preserveOutput": "always",
    "projects": [
      {
        "outputDir": "/home/joseph-were/Downloads/AfyaLink-HRMS-main/frontend/test-results",
        "repeatEach": 1,
        "retries": 0,
        "metadata": {
          "actualWorkers": 1
        },
        "id": "",
        "name": "",
        "testDir": "/home/joseph-were/Downloads/AfyaLink-HRMS-main/frontend/tests/e2e",
        "testIgnore": [],
        "testMatch": [
          "**/*.@(spec|test).?(c|m)[jt]s?(x)"
        ],
        "timeout": 60000
      }
    ],
    "quiet": false,
    "reporter": [
      [
        "json"
      ]
    ],
    "reportSlowTests": {
      "max": 5,
      "threshold": 300000
    },
    "shard": null,
    "tags": [],
    "updateSnapshots": "missing",
    "updateSourceMethod": "patch",
    "version": "1.61.1",
    "workers": 1,
    "webServer": null
  },
  "suites": [
    {
      "title": "notifications.spec.ts",
      "file": "notifications.spec.ts",
      "column": 0,
      "line": 0,
      "specs": [],
      "suites": [
        {
          "title": "AfyaLink Notifications system tests",
          "file": "notifications.spec.ts",
          "line": 10,
          "column": 6,
          "specs": [
            {
              "title": "should display notifications page and manage read status",
              "ok": true,
              "tags": [],
              "tests": [
                {
                  "timeout": 60000,
                  "annotations": [],
                  "expectedStatus": "passed",
                  "projectId": "",
                  "projectName": "",
                  "results": [
                    {
                      "workerIndex": 0,
                      "parallelIndex": 0,
                      "status": "passed",
                      "duration": 9451,
                      "errors": [],
                      "stdout": [],
                      "stderr": [
                        {
                          "text": "Captured errors during notifications tests: [\n  \u001b[32m'console_error [http://127.0.0.1:5173/login]: Failed to load resource: the server responded with a status of 401 (Unauthorized)'\u001b[39m,\n  \u001b[32m'console_error [http://127.0.0.1:5173/login]: Failed to load resource: the server responded with a status of 401 (Unauthorized)'\u001b[39m,\n  \u001b[32m'console_error [http://127.0.0.1:5173/login]: Failed to load resource: the server responded with a status of 401 (Unauthorized)'\u001b[39m,\n  \u001b[32m'console_error [http://127.0.0.1:5173/login]: Failed to fetch user capabilities: ApiError: Session expired. Please sign in again.\\n'\u001b[39m +\n    \u001b[32m'    at runRequest (http://127.0.0.1:5173/src/utils/apiFetch.js:221:27)'\u001b[39m,\n  \u001b[32m'console_error [http://127.0.0.1:5173/login]: Failed to fetch user capabilities: ApiError: Session expired. Please sign in again.\\n'\u001b[39m +\n    \u001b[32m'    at runRequest (http://127.0.0.1:5173/src/utils/apiFetch.js:221:27)'\u001b[39m,\n  \u001b[32m'console_error [http://127.0.0.1:5173/login]: Failed to fetch user capabilities: ApiError: Session expired. Please sign in again.\\n'\u001b[39m +\n    \u001b[32m'    at runRequest (http://127.0.0.1:5173/src/utils/apiFetch.js:221:27)'\u001b[39m,\n  \u001b[32m'console_error [http://127.0.0.1:5173/login]: Failed to fetch user capabilities: ApiError: Session expired. Please sign in again.\\n'\u001b[39m +\n    \u001b[32m'    at runRequest (http://127.0.0.1:5173/src/utils/apiFetch.js:221:27)'\u001b[39m,\n  \u001b[32m'network_fail [http://127.0.0.1:5173/app/platform/home/index]: http://127.0.0.1:5173/src/hooks/useSecurityOfficerDashboard.js (net::ERR_ABORTED)'\u001b[39m,\n  \u001b[32m'network_fail [http://127.0.0.1:5173/app/platform/home/index]: https://accounts.google.com/gsi/client (net::ERR_ABORTED)'\u001b[39m,\n  \u001b[32m'network_fail [http://127.0.0.1:5173/app/platform/home/index]: http://localhost:5000/api/ai/assistant/context (net::ERR_ABORTED)'\u001b[39m,\n  \u001b[32m'network_fail [http://127.0.0.1:5173/app/platform/home/index]: http://127.0.0.1:5173/src/hooks/useUnifiedAssistantDashboard.js (net::ERR_ABORTED)'\u001b[39m,\n  \u001b[32m'network_fail [http://127.0.0.1:5173/app/platform/home/index]: http://127.0.0.1:5173/src/services/dashboardApi.js (net::ERR_ABORTED)'\u001b[39m,\n  \u001b[32m'network_fail [http://127.0.0.1:5173/app/platform/home/index]: http://127.0.0.1:5173/src/hooks/useSecurityAdminDashboard.js (net::ERR_ABORTED)'\u001b[39m,\n  \u001b[32m'console_error [http://127.0.0.1:5173/app/platform/inbox/notifications]: Failed to load resource: the server responded with a status of 429 (Too Many Requests)'\u001b[39m,\n  \u001b[32m'console_error [http://127.0.0.1:5173/app/platform/inbox/notifications]: Failed to fetch user capabilities: ApiError: Too many auth requests. Please retry shortly.\\n'\u001b[39m +\n    \u001b[32m'    at runRequest (http://127.0.0.1:5173/src/utils/apiFetch.js:221:27)'\u001b[39m,\n  \u001b[32m'console_error [http://127.0.0.1:5173/app/platform/inbox/notifications]: Failed to fetch user capabilities: ApiError: Too many auth requests. Please retry shortly.\\n'\u001b[39m +\n    \u001b[32m'    at runRequest (http://127.0.0.1:5173/src/utils/apiFetch.js:221:27)'\u001b[39m,\n  \u001b[32m'console_error [http://127.0.0.1:5173/app/platform/inbox/notifications]: Failed to fetch user capabilities: ApiError: Too many auth requests. Please retry shortly.\\n'\u001b[39m +\n    \u001b[32m'    at runRequest (http://127.0.0.1:5173/src/utils/apiFetch.js:221:27)'\u001b[39m,\n  \u001b[32m'console_error [http://127.0.0.1:5173/app/platform/inbox/notifications]: Failed to fetch user capabilities: ApiError: Too many auth requests. Please retry shortly.\\n'\u001b[39m +\n    \u001b[32m'    at runRequest (http://127.0.0.1:5173/src/utils/apiFetch.js:221:27)'\u001b[39m,\n  \u001b[32m'console_error [http://127.0.0.1:5173/app/platform/inbox/notifications]: Failed to fetch user capabilities: ApiError: Too many auth requests. Please retry shortly.\\n'\u001b[39m +\n    \u001b[32m'    at runRequest (http://127.0.0.1:5173/src/utils/apiFetch.js:221:27)'\u001b[39m,\n  \u001b[32m'console_error [http://127.0.0.1:5173/app/platform/inbox/notifications]: Failed to fetch user capabilities: ApiError: Too many auth requests. Please retry shortly.\\n'\u001b[39m +\n    \u001b[32m'    at runRequest (http://127.0.0.1:5173/src/utils/apiFetch.js:221:27)'\u001b[39m,\n  \u001b[32m'console_error [http://127.0.0.1:5173/app/platform/inbox/notifications]: Failed to fetch user capabilities: ApiError: Too many auth requests. Please retry shortly.\\n'\u001b[39m +\n    \u001b[32m'    at runRequest (http://127.0.0.1:5173/src/utils/apiFetch.js:221:27)'\u001b[39m,\n  \u001b[32m'console_error [http://127.0.0.1:5173/app/platform/inbox/notifications]: Failed to fetch user capabilities: ApiError: Too many auth requests. Please retry shortly.\\n'\u001b[39m +\n    \u001b[32m'    at runRequest (http://127.0.0.1:5173/src/utils/apiFetch.js:221:27)'\u001b[39m,\n  \u001b[32m'console_error [http://127.0.0.1:5173/app/platform/inbox/notifications]: Failed to fetch user capabilities: ApiError: Too many auth requests. Please retry shortly.\\n'\u001b[39m +\n    \u001b[32m'    at runRequest (http://127.0.0.1:5173/src/utils/apiFetch.js:221:27)'\u001b[39m,\n  \u001b[32m'console_error [http://127.0.0.1:5173/app/platform/inbox/notifications]: Failed to fetch user capabilities: ApiError: Too many auth requests. Please retry shortly.\\n'\u001b[39m +\n    \u001b[32m'    at runRequest (http://127.0.0.1:5173/src/utils/apiFetch.js:221:27)'\u001b[39m\n]\n"
                        }
                      ],
                      "retry": 0,
                      "startTime": "2026-07-20T09:42:12.035Z",
                      "annotations": [],
                      "attachments": []
                    }
                  ],
                  "status": "expected"
                }
              ],
              "id": "be7d0958780d1a4666e5-e19e51fb1b07035c7c06",
              "file": "notifications.spec.ts",
              "line": 13,
              "column": 7
            }
          ]
        }
      ]
    },
    {
      "title": "workflows/billing.spec.ts",
      "file": "workflows/billing.spec.ts",
      "column": 0,
      "line": 0,
      "specs": [],
      "suites": [
        {
          "title": "Workflow certification - billing",
          "file": "workflows/billing.spec.ts",
          "line": 11,
          "column": 6,
          "specs": [
            {
              "title": "billing handoff completes",
              "ok": true,
              "tags": [],
              "tests": [
                {
                  "timeout": 60000,
                  "annotations": [],
                  "expectedStatus": "passed",
                  "projectId": "",
                  "projectName": "",
                  "results": [
                    {
                      "workerIndex": 0,
                      "parallelIndex": 0,
                      "status": "passed",
                      "duration": 3272,
                      "errors": [],
                      "stdout": [],
                      "stderr": [],
                      "retry": 0,
                      "startTime": "2026-07-20T09:42:21.708Z",
                      "annotations": [],
                      "attachments": []
                    }
                  ],
                  "status": "expected"
                }
              ],
              "id": "8fd29825bbe65c3b3c1f-884a5c6fd45ffa816f03",
              "file": "workflows/billing.spec.ts",
              "line": 12,
              "column": 7
            }
          ]
        }
      ]
    },
    {
      "title": "workflows/inpatient.spec.ts",
      "file": "workflows/inpatient.spec.ts",
      "column": 0,
      "line": 0,
      "specs": [],
      "suites": [
        {
          "title": "Workflow certification - inpatient",
          "file": "workflows/inpatient.spec.ts",
          "line": 11,
          "column": 6,
          "specs": [
            {
              "title": "admission workflow reaches discharge",
              "ok": true,
              "tags": [],
              "tests": [
                {
                  "timeout": 60000,
                  "annotations": [],
                  "expectedStatus": "passed",
                  "projectId": "",
                  "projectName": "",
                  "results": [
                    {
                      "workerIndex": 0,
                      "parallelIndex": 0,
                      "status": "passed",
                      "duration": 3622,
                      "errors": [],
                      "stdout": [],
                      "stderr": [],
                      "retry": 0,
                      "startTime": "2026-07-20T09:42:25.098Z",
                      "annotations": [],
                      "attachments": []
                    }
                  ],
                  "status": "expected"
                }
              ],
              "id": "c21c7ec39a4c31ca9f0c-c3871e2029626b1336e5",
              "file": "workflows/inpatient.spec.ts",
              "line": 12,
              "column": 7
            }
          ]
        }
      ]
    },
    {
      "title": "workflows/laboratory.spec.ts",
      "file": "workflows/laboratory.spec.ts",
      "column": 0,
      "line": 0,
      "specs": [],
      "suites": [
        {
          "title": "Workflow certification - laboratory",
          "file": "workflows/laboratory.spec.ts",
          "line": 11,
          "column": 6,
          "specs": [
            {
              "title": "lab ordering and completion works",
              "ok": true,
              "tags": [],
              "tests": [
                {
                  "timeout": 60000,
                  "annotations": [],
                  "expectedStatus": "passed",
                  "projectId": "",
                  "projectName": "",
                  "results": [
                    {
                      "workerIndex": 0,
                      "parallelIndex": 0,
                      "status": "passed",
                      "duration": 5149,
                      "errors": [],
                      "stdout": [],
                      "stderr": [],
                      "retry": 0,
                      "startTime": "2026-07-20T09:42:28.869Z",
                      "annotations": [],
                      "attachments": []
                    }
                  ],
                  "status": "expected"
                }
              ],
              "id": "05797161bc7206837885-a97af3abbdc95782c84b",
              "file": "workflows/laboratory.spec.ts",
              "line": 12,
              "column": 7
            }
          ]
        }
      ]
    },
    {
      "title": "workflows/patient-journey.spec.ts",
      "file": "workflows/patient-journey.spec.ts",
      "column": 0,
      "line": 0,
      "specs": [],
      "suites": [
        {
          "title": "Workflow certification - patient journey",
          "file": "workflows/patient-journey.spec.ts",
          "line": 11,
          "column": 6,
          "specs": [
            {
              "title": "new patient journey completes end to end",
              "ok": true,
              "tags": [],
              "tests": [
                {
                  "timeout": 60000,
                  "annotations": [],
                  "expectedStatus": "passed",
                  "projectId": "",
                  "projectName": "",
                  "results": [
                    {
                      "workerIndex": 0,
                      "parallelIndex": 0,
                      "status": "passed",
                      "duration": 14788,
                      "errors": [],
                      "stdout": [],
                      "stderr": [],
                      "retry": 0,
                      "startTime": "2026-07-20T09:42:34.243Z",
                      "annotations": [],
                      "attachments": []
                    }
                  ],
                  "status": "expected"
                }
              ],
              "id": "746ba105ce2757098fae-7f2f1112093b424253ee",
              "file": "workflows/patient-journey.spec.ts",
              "line": 12,
              "column": 7
            }
          ]
        }
      ]
    },
    {
      "title": "workflows/pharmacy.spec.ts",
      "file": "workflows/pharmacy.spec.ts",
      "column": 0,
      "line": 0,
      "specs": [],
      "suites": [
        {
          "title": "Workflow certification - pharmacy",
          "file": "workflows/pharmacy.spec.ts",
          "line": 11,
          "column": 6,
          "specs": [
            {
              "title": "prescription and dispense flow completes",
              "ok": true,
              "tags": [],
              "tests": [
                {
                  "timeout": 60000,
                  "annotations": [],
                  "expectedStatus": "passed",
                  "projectId": "",
                  "projectName": "",
                  "results": [
                    {
                      "workerIndex": 0,
                      "parallelIndex": 0,
                      "status": "passed",
                      "duration": 3984,
                      "errors": [],
                      "stdout": [],
                      "stderr": [],
                      "retry": 0,
                      "startTime": "2026-07-20T09:42:49.234Z",
                      "annotations": [],
                      "attachments": []
                    }
                  ],
                  "status": "expected"
                }
              ],
              "id": "03a5f2e8789fa3827267-46e3574ff4a71f2dea84",
              "file": "workflows/pharmacy.spec.ts",
              "line": 12,
              "column": 7
            }
          ]
        }
      ]
    }
  ],
  "errors": [],
  "stats": {
    "startTime": "2026-07-20T09:42:03.669Z",
    "duration": 49806.709,
    "expected": 6,
    "skipped": 0,
    "unexpected": 0,
    "flaky": 0
  }
}


## Playwright Stats

{
  "startTime": "2026-07-20T09:42:03.669Z",
  "duration": 49806.709,
  "expected": 6,
  "skipped": 0,
  "unexpected": 0,
  "flaky": 0
}
