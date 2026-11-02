export const CARD_TYPE = 'custom:flame-connect-card';
export const SCHEMA_VERSION = 1;
export const COMMAND_TIMEOUT_MS = 45_000;
export const TEMPERATURE_STEP_TOLERANCE = 0.001;
export const TEMPERATURE_CONFIRMATION_TOLERANCE = 0.01;
export const SUPPORTED_PRESETS = ['normal', 'eco', 'fan_only'] as const;
export const VISUAL_STATES = ['off', 'flame', 'heat', 'both', 'unknown'] as const;
export type VisualState = (typeof VISUAL_STATES)[number];
export type EntityRole = 'power' | 'flame' | 'climate' | 'color' | 'brightness' | 'ambient';
export type Bindings = Partial<Record<EntityRole, string>>;
export interface CardConfig {
  type: typeof CARD_TYPE;
  version: number;
  name?: string;
  entities: Bindings;
  show_power: boolean;
  show_image: boolean;
  images: Partial<Record<Exclude<VisualState, 'unknown'>, string>>;
}
export interface Choice {
  available: boolean;
  value: string | null;
  options: readonly string[];
}
export interface Temperature {
  value: number;
  unit: '°C' | '°F';
}
export interface FireplaceState {
  name: string;
  power: boolean | null;
  flame: boolean | null;
  heating: boolean | null;
  climateAvailable: boolean;
  mode: string | null;
  modes: readonly string[];
  target: Temperature | null;
  ambient: Temperature | null;
  minimum: number | null;
  maximum: number | null;
  step: number | null;
  color: Choice;
  brightness: Choice;
}
export type Command =
  | { kind: 'power' | 'flame' | 'heating'; value: boolean }
  | { kind: 'temperature'; value: number }
  | { kind: 'mode' | 'color' | 'brightness'; value: string };
export type ErrorCode = 'unavailable' | 'invalid_value' | 'standby' | 'busy' | 'timeout' | 'failed';
export class ControlError extends Error {
  constructor(readonly code: ErrorCode) {
    super(code);
  }
}
