import { useCallback, useState } from 'react';

/**
 * État replié/déplié d'une liste de groupes.
 * `defaultOpen` : clés ouvertes au premier affichage ; ensuite le choix de l'utilisateur prime.
 */
export function useFold(keys: string[], defaultOpen: string[] = []) {
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  const isOpen = useCallback((k: string) => overrides[k] ?? defaultOpen.includes(k), [overrides, defaultOpen]);
  const toggle = useCallback((k: string) => setOverrides((o) => ({ ...o, [k]: !(o[k] ?? defaultOpen.includes(k)) })), [defaultOpen]);
  const allOpen = keys.length > 0 && keys.every((k) => isOpen(k));
  const toggleAll = useCallback(() => {
    const target = !allOpen;
    setOverrides(Object.fromEntries(keys.map((k) => [k, target])));
  }, [allOpen, keys]);
  return { isOpen, toggle, allOpen, toggleAll };
}
