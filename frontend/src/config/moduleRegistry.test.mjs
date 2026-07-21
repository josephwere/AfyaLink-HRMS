import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getAvailableModulesForCapabilities,
  getNavigationItemsForCapabilities,
} from './moduleRegistry.js';

test('falls back to built-in navigation when no capabilities are supplied', () => {
  const modules = getAvailableModulesForCapabilities([]);
  const items = getNavigationItemsForCapabilities([]);

  assert.ok(modules.length > 0, 'expected at least one module to be available');
  assert.ok(items.length > 0, 'expected at least one navigation item to be available');
});
