import { describe, it, expect } from 'vitest';
import { Reflector } from '@nestjs/core';
import { AdminPresenceController } from './admin-presence.controller';
import { AdminGuard } from '../admin/admin.guard';

describe('AdminPresenceController', () => {
  it('is protected by the AdminGuard', () => {
    const guards = new Reflector().get<any[]>('__guards__', AdminPresenceController) ?? [];
    expect(guards).toContain(AdminGuard);
  });

  it('returns the live snapshot from the service', () => {
    const snap = { online: 3, byGovernorate: [], topPieces: [], activeCarts: 0, swipeRatePerMin: 0 };
    const ctrl = new AdminPresenceController({ snapshot: () => snap } as any);
    expect(ctrl.snapshot()).toBe(snap);
  });
});
