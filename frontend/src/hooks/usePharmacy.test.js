import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react-hooks';
import * as pharmacyQueries from '../services/pharmacy/queries';
import { usePharmacy } from './usePharmacy';

vi.mock('../services/pharmacy/queries', () => ({
  listItems: vi.fn(),
}));

describe('usePharmacy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads pharmacy list and updates state', async () => {
    pharmacyQueries.listItems.mockResolvedValue({ items: [{ _id: '1' }], total: 1 });

    const { result, waitForNextUpdate } = renderHook(() => usePharmacy({ q: 'test', page: 1, limit: 25 }));
    await waitForNextUpdate();

    expect(result.current.loading).toBe(false);
    expect(result.current.data).toEqual({ items: [{ _id: '1' }], total: 1 });
  });

  it('refreshes on parameter change', async () => {
    pharmacyQueries.listItems.mockResolvedValueOnce({ items: [], total: 0 });
    const { result, rerender, waitForNextUpdate } = renderHook(
      ({ q, page, limit }) => usePharmacy({ q, page, limit }),
      { initialProps: { q: '', page: 1, limit: 25 } }
    );

    await waitForNextUpdate();
    pharmacyQueries.listItems.mockResolvedValue({ items: [{ _id: '2' }], total: 1 });

    await act(async () => {
      rerender({ q: 'updated', page: 1, limit: 25 });
      await waitForNextUpdate();
    });

    expect(result.current.data).toEqual({ items: [{ _id: '2' }], total: 1 });
  });
});
