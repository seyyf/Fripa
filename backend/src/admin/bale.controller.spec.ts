import { describe, it, expect } from 'vitest';
import { Reflector } from '@nestjs/core';
import { BaleController } from './bale.controller';
import { AdminGuard } from './admin.guard';

describe('BaleController', () => {
  it('is protected by the AdminGuard', () => {
    const guards = new Reflector().get<any[]>('__guards__', BaleController) ?? [];
    expect(guards).toContain(AdminGuard);
  });

  it('delegates list to summaries()', () => {
    const rows = [{ id: 'b1' }];
    const ctrl = new BaleController({ summaries: () => rows } as any);
    expect(ctrl.list()).toBe(rows);
  });
});
