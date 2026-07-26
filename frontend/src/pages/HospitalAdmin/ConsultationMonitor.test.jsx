import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import ConsultationMonitor from './ConsultationMonitor';

vi.mock('../../hooks/useConsultationMonitor', () => ({
  useConsultationMonitor: () => ({
    filter: 'ALL',
    setFilter: vi.fn(),
    loading: false,
    msg: '',
    visibleCalls: [],
    summary: {
      requested: 0,
      active: 0,
      ended: 0,
      blocked: 0,
      wardEscalations: 0,
    },
    blockCall: vi.fn(),
    load: vi.fn(),
    escalations: [],
  }),
}));

vi.mock('../../utils/appLanguage.jsx', () => ({
  useAppLanguage: () => ({
    translateText: (value) => value,
    language: 'en',
    setLanguage: vi.fn(),
  }),
}));

describe('ConsultationMonitor', () => {
  it('renders the consultation monitor even when escalations are empty', () => {
    render(
      <MemoryRouter>
        <ConsultationMonitor />
      </MemoryRouter>
    );

    expect(screen.getByText('Consultation Monitor')).toBeInTheDocument();
  });
});
