import { EVENT_TYPES } from '@trafego/rules';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';
import * as s from './schema.js';

describe('schema', () => {
  it('enum event_type espelha EVENT_TYPES do pacote de regras', () => {
    expect([...s.TIPOS_EVENTO]).toEqual([...EVENT_TYPES]);
    expect(s.eventTypeEnum.enumValues).toEqual([...EVENT_TYPES]);
  });

  it('toda tabela com tenant_id tem RLS e política de isolamento', () => {
    const porEmpresa = [
      s.memberships,
      s.sources,
      s.webhookEvents,
      s.events,
      s.metricsDaily,
      s.rules,
      s.presentation,
    ];
    for (const tabela of porEmpresa) {
      const cfg = getTableConfig(tabela);
      const tenant = cfg.columns.find((c) => c.name === 'tenant_id');
      expect(tenant?.notNull, cfg.name).toBe(true);
      expect(cfg.enableRLS, cfg.name).toBe(true);
      expect(
        cfg.policies.some((p) => p.name === `${cfg.name}_isolamento_tenant`),
        cfg.name,
      ).toBe(true);
    }
  });

  it('tenants e users são globais (sem RLS)', () => {
    for (const tabela of [s.tenants, s.users]) {
      const cfg = getTableConfig(tabela);
      expect(cfg.enableRLS).toBe(false);
      expect(cfg.columns.some((c) => c.name === 'tenant_id')).toBe(false);
    }
  });
});
