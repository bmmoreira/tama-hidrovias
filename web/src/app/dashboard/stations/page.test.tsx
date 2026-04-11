// @vitest-environment jsdom

import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import useSWR from 'swr';
import { useSession } from 'next-auth/react';
import {
  createVirtualStation,
  deleteStation,
  getStations,
  updateStation,
} from '@/lib/strapi';
import StationsPage from './page';

vi.mock('next-auth/react', () => ({
  useSession: vi.fn(),
}));

vi.mock('swr', () => ({
  default: vi.fn(),
}));

vi.mock('@/lib/strapi', () => ({
  createVirtualStation: vi.fn(),
  deleteStation: vi.fn(),
  getStations: vi.fn(),
  updateStation: vi.fn(),
}));

vi.mock('@/components/Toast', () => ({
  default: () => null,
}));

vi.mock('@/components/ConfirmationModal', () => ({
  default: ({
    isOpen,
    title,
    confirmLabel,
    children,
    onClose,
    onConfirm,
  }: {
    isOpen: boolean;
    title: string;
    confirmLabel: string;
    children?: React.ReactNode;
    onClose: () => void;
    onConfirm: () => void;
  }) =>
    isOpen ? (
      <div data-testid="confirmation-modal">
        <h2>{title}</h2>
        {children}
        <button type="button" onClick={onClose}>
          Cancelar
        </button>
        <button type="button" onClick={onConfirm}>
          {confirmLabel}
        </button>
      </div>
    ) : null,
}));

vi.mock('./StationFormModal', () => ({
  default: ({
    isOpen,
    station,
    onSubmittingChange,
  }: {
    isOpen: boolean;
    station?: { id: number } | null;
    onSubmittingChange?: (isSubmitting: boolean) => void;
  }) =>
    isOpen && station ? (
      <div data-testid="station-form-modal">
        <button type="button" onClick={() => onSubmittingChange?.(true)}>
          Salvar Alterações
        </button>
      </div>
    ) : null,
}));

const station = {
  id: 7,
  attributes: {
    name: 'Estacao Teste',
    code: 'TEST-007',
    source: 'Virtual',
    basin: 'Amazonas',
    river: 'Rio Negro',
    latitude: -3.1,
    longitude: -60.2,
    active: true,
  },
};

function createDeferred() {
  let resolvePromise: () => void;
  const promise = new Promise<void>((resolve) => {
    resolvePromise = resolve;
  });

  return {
    promise,
    resolve: resolvePromise!,
  };
}

function getStationRow() {
  return screen.getByRole('cell', { name: 'Estacao Teste' }).closest('tr') as HTMLTableRowElement;
}

beforeEach(() => {
  document.body.innerHTML = '';
  vi.clearAllMocks();

  vi.mocked(useSession).mockReturnValue({
    data: {
      user: {
        role: 'analyst',
      },
    },
    status: 'authenticated',
    update: vi.fn(),
  } as ReturnType<typeof useSession>);

  vi.mocked(useSWR).mockReturnValue({
    data: {
      data: [station],
      meta: {
        pagination: {
          total: 1,
        },
      },
    },
    isLoading: false,
    mutate: vi.fn().mockResolvedValue(undefined),
    error: undefined,
    isValidating: false,
  } as ReturnType<typeof useSWR>);

  vi.mocked(getStations).mockResolvedValue({
    data: [station],
    meta: {
      pagination: {
        total: 1,
      },
    },
  });

  vi.mocked(createVirtualStation).mockResolvedValue(station as never);
});

describe('StationsPage', () => {
  it('shows row delete busy state through the confirmation flow', async () => {
    const deferred = createDeferred();

    vi.mocked(deleteStation).mockReturnValueOnce(deferred.promise as never);

    render(<StationsPage />);

    fireEvent.click(within(getStationRow()).getByRole('button', { name: 'Excluir' }));
    fireEvent.click(screen.getByRole('button', { name: 'Excluir estação' }));

    await waitFor(() => {
      const row = getStationRow();
      const deleteButton = within(row).getByRole('button', { name: 'Excluindo…' }) as HTMLButtonElement;
      const editButton = within(row).getByRole('button', { name: 'Editar' }) as HTMLButtonElement;

      expect(deleteButton.disabled).toBe(true);
      expect(editButton.disabled).toBe(true);
    });

    await act(async () => {
      deferred.resolve();
      await Promise.resolve();
    });

    await waitFor(() => {
      const row = getStationRow();
      const deleteButton = within(row).getByRole('button', { name: 'Excluir' }) as HTMLButtonElement;
      const editButton = within(row).getByRole('button', { name: 'Editar' }) as HTMLButtonElement;

      expect(deleteButton.disabled).toBe(false);
      expect(editButton.disabled).toBe(false);
    });
  });

  it('shows row edit busy state while the form submission is in flight', async () => {
    render(<StationsPage />);

    fireEvent.click(within(getStationRow()).getByRole('button', { name: 'Editar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Salvar Alterações' }));

    await waitFor(() => {
      const row = getStationRow();
      const editButton = within(row).getByRole('button', { name: 'Salvando…' }) as HTMLButtonElement;
      const deleteButton = within(row).getByRole('button', { name: 'Excluir' }) as HTMLButtonElement;

      expect(editButton.disabled).toBe(true);
      expect(deleteButton.disabled).toBe(true);
    });
  });
});