import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { loginAsRole, baseURL, setupErrorListeners } from './shared';

test.setTimeout(180_000); // 3 minutes timeout for routing crawl

const errors: string[] = [];
const routeResults: any[] = [];

test.beforeEach(({ page }) => {
  setupErrorListeners(page, errors);
});

function collectRoutes(): string[] {
  try {
    const appPath = path.resolve(__dirname, '../../src/App.jsx');
    const workspacePath = path.resolve(__dirname, '../../src/app/navigation/workspaces.js');

    const appSource = fs.readFileSync(appPath, 'utf8');
    const workspaceSource = fs.readFileSync(workspacePath, 'utf8');

    const routes: string[] = [];
    const regexes = [
      /path=(?:"([^"]+)"|'([^']+)')/g,
      /path:\s*(?:"([^"]+)"|'([^']+)')/g,
    ];

    for (const regex of regexes) {
      for (const match of appSource.matchAll(regex)) {
        const val = match[1] || match[2] || '';
        if (val.startsWith('/')) routes.push(val);
      }
      for (const match of workspaceSource.matchAll(regex)) {
        const val = match[1] || match[2] || '';
        if (val.startsWith('/')) routes.push(val);
      }
    }

    // Filter out dynamic parameters / wildcard routes
    return [...new Set(routes)]
      .filter((route) => !route.includes(':') && !route.includes('*'))
      .sort((a, b) => a.localeCompare(b));
  } catch (err) {
    console.error('Failed to parse routes programmatically:', err);
    return ['/app/platform/home/index'];
  }
}

test('should crawl all discovered routes and capture status', async ({ page }) => {
  const routes = collectRoutes();
  console.log(`Discovered ${routes.length} static routes for E2E crawling.`);

  // Login as Super Admin
  await loginAsRole(page, 'SUPER_ADMIN');

  const screenshotsDir = path.resolve(__dirname, '../../../docs/artifacts/e2e-screenshots');
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }

  for (const route of routes) {
    const routeErrors: string[] = [];
    const pageErrors: string[] = [];
    const networkFailures: string[] = [];

    const consoleHandler = (msg: any) => {
      if (msg.type() === 'error') routeErrors.push(msg.text());
    };
    const errorHandler = (err: Error) => {
      pageErrors.push(err.message);
    };
    const requestFailedHandler = (req: any) => {
      networkFailures.push(`${req.url()} (${req.failure()?.errorText || 'failed'})`);
    };

    page.on('console', consoleHandler);
    page.on('pageerror', errorHandler);
    page.on('requestfailed', requestFailedHandler);

    const startedAt = Date.now();
    let status = 'ok';
    let errorMessage = '';

    try {
      await page.goto(`${baseURL}${route}`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1000);

      // Check if we hit forbidden or not found page
      const title = await page.title();
      const bodyText = await page.innerText('body');
      if (bodyText.includes('Forbidden') || bodyText.includes('Access Denied') || title.includes('Forbidden') || page.url().includes('/403')) {
        status = 'forbidden';
      } else if (bodyText.includes('Not Found') || title.includes('Not Found') || page.url().includes('/404')) {
        status = 'not_found';
      }

      // Take a route screenshot
      const safeName = route.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'root';
      const screenshotPath = path.join(screenshotsDir, `${safeName}.png`);
      await page.screenshot({ path: screenshotPath });
    } catch (err: any) {
      status = 'error';
      errorMessage = err.message;
    } finally {
      // Remove listeners for this route
      page.off('console', consoleHandler);
      page.off('pageerror', errorHandler);
      page.off('requestfailed', requestFailedHandler);
    }

    routeResults.push({
      route,
      status,
      durationMs: Date.now() - startedAt,
      consoleErrors: routeErrors,
      pageErrors,
      networkFailures,
      error: errorMessage || null,
    });
  }

  // Write reports
  const docsDir = path.resolve(__dirname, '../../../docs');
  if (!fs.existsSync(docsDir)) {
    fs.mkdirSync(docsDir, { recursive: true });
  }

  const reportPayload = {
    generatedAt: new Date().toISOString(),
    summary: {
      totalRoutes: routes.length,
      successfulRoutes: routeResults.filter((r) => r.status === 'ok').length,
      failedRoutes: routeResults.filter((r) => r.status !== 'ok').length,
      consoleErrors: routeResults.reduce((acc, r) => acc + r.consoleErrors.length, 0),
      pageErrors: routeResults.reduce((acc, r) => acc + r.pageErrors.length, 0),
      networkFailures: routeResults.reduce((acc, r) => acc + r.networkFailures.length, 0),
    },
    routes: routeResults,
  };

  fs.writeFileSync(path.join(docsDir, 'E2E_ROUTE_REPORT.json'), JSON.stringify(reportPayload, null, 2), 'utf8');

  const md = [
    '# E2E Route Report',
    '',
    `- Generated: ${reportPayload.generatedAt}`,
    `- Total routes visited: ${reportPayload.summary.totalRoutes}`,
    `- Successful routes: ${reportPayload.summary.successfulRoutes}`,
    `- Failed routes: ${reportPayload.summary.failedRoutes}`,
    '',
    '## Summary Metrics',
    '',
    `| Metric | Count |`,
    `|---|---|`,
    `| Total Console Errors | ${reportPayload.summary.consoleErrors} |`,
    `| Total Page Errors | ${reportPayload.summary.pageErrors} |`,
    `| Total Network Failures | ${reportPayload.summary.networkFailures} |`,
    '',
    '## Detailed Route results',
    '',
    `| Route | Status | Duration | Console Errors | Request Failures |`,
    `|---|---|---|---|---|`,
    ...routeResults.map((r) => `| ${r.route} | **${r.status.toUpperCase()}** | ${r.durationMs}ms | ${r.consoleErrors.length} | ${r.networkFailures.length} |`),
    '',
  ];

  fs.writeFileSync(path.join(docsDir, 'E2E_ROUTE_REPORT.md'), md.join('\n'), 'utf8');
  console.log('E2E Route crawl report written successfully.');
});

test.afterAll(() => {
  if (errors.length > 0) {
    console.error('Captured errors during navigation tests:', errors);
  }
});
