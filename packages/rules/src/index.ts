/** Tipos canônicos de evento. Motor completo chega em P3.5 (agente Regras). */
export const EVENT_TYPES = ['gasto', 'clique', 'visita', 'cadastro', 'ftd', 'deposito'] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export const DEFAULT_CHANNELS = ['Meta', 'Email', 'SMS', 'Afiliados', 'Outros'] as const;
export type Channel = (typeof DEFAULT_CHANNELS)[number];

export function isEventType(value: string): value is EventType {
  return (EVENT_TYPES as readonly string[]).includes(value);
}
