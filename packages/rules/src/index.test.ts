import { describe, expect, it } from 'vitest';
import { EVENT_TYPES, isEventType } from './index.js';

describe('tipos canônicos', () => {
  it('reconhece os seis tipos', () => {
    expect(EVENT_TYPES).toHaveLength(6);
    expect(isEventType('ftd')).toBe(true);
    expect(isEventType('pix')).toBe(false);
  });
});
