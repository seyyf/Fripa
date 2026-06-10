import { useEffect, useState } from 'react';
import { api } from '../api';
import type { ShopConfig } from '../types';

// One fetch per page load, shared by every consumer (checkout form, cart
// nudge, WhatsApp links). `null` while loading or on failure — consumers
// render without config-driven extras in that case.
let cached: ShopConfig | null = null;
let pending: Promise<ShopConfig> | null = null;

export function useShopConfig(): ShopConfig | null {
  const [config, setConfig] = useState<ShopConfig | null>(cached);

  useEffect(() => {
    if (cached) return;
    pending ??= api.shopConfig();
    let alive = true;
    pending
      .then((c) => {
        cached = c;
        if (alive) setConfig(c);
      })
      .catch(() => {
        pending = null; // allow a retry on the next mount
      });
    return () => {
      alive = false;
    };
  }, []);

  return config;
}
