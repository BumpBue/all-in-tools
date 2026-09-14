'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import {
  CommandPalette,
  isTypingTarget,
} from '@/components/command-palette/command-palette';

const SLASH_KEY = '/';
const PALETTE_KEY = 'k';

interface CommandPaletteApi {
  open: (query?: string) => void;
}

const CommandPaletteContext = createContext<CommandPaletteApi | null>(null);

export function CommandPaletteProvider({ children }: { children: ReactNode }) {
  const [openWith, setOpenWith] = useState<string | null>(null);

  const open = useCallback((query = '') => setOpenWith(query), []);
  const close = useCallback(() => setOpenWith(null), []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      // Cmd/Ctrl+K stays live inside text fields: it cannot be typed by
      // accident, and jumping to another tool mid-edit is the point of it.
      if (event.key.toLowerCase() === PALETTE_KEY && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpenWith('');
        return;
      }

      if (event.key !== SLASH_KEY) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (isTypingTarget(event.target)) return;

      event.preventDefault();
      setOpenWith('');
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  const api = useMemo<CommandPaletteApi>(() => ({ open }), [open]);

  return (
    <CommandPaletteContext.Provider value={api}>
      {children}
      {openWith !== null ? (
        <CommandPalette initialQuery={openWith} onClose={close} />
      ) : null}
    </CommandPaletteContext.Provider>
  );
}

export function useCommandPalette(): CommandPaletteApi {
  const context = useContext(CommandPaletteContext);
  if (!context) {
    throw new Error('useCommandPalette must be used inside a CommandPaletteProvider');
  }
  return context;
}
