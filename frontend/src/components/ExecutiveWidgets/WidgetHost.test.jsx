import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import WidgetHost from './WidgetHost';

vi.mock('../../utils/appLanguage.jsx', () => ({
  useAppLanguage: () => ({ translateText: (value) => value }),
}));

vi.mock('./dashboardDataRegistry', () => ({
  getDataSourceConfig: () => null,
}));

vi.mock('./dashboardRuntime.mjs', () => ({
  createDashboardRuntime: () => ({
    createWidgetController: () => ({
      initialize: () => {},
      resolveDependencies: () => {},
      load: async () => ({
        data: {},
        error: 'widget failed',
        metadata: {},
      }),
    }),
  }),
}));

describe('WidgetHost', () => {
  it('renders a fallback state when widget loading fails', async () => {
    render(
      <WidgetHost widget={{ id: 'test-widget', title: 'Test widget' }}>
        <div>Content</div>
      </WidgetHost>
    );

    expect(await screen.findByText('Widget unavailable')).toBeInTheDocument();
    expect(screen.getByText('widget failed')).toBeInTheDocument();
  });
});
