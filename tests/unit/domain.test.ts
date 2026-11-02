import { describe, expect, it } from 'vitest';
import {
  convertTemperature,
  isConfirmed,
  validateCommand,
  visibleModes,
  visualState,
} from '../../src/domain/state';
import { ControlError, type Command } from '../../src/domain/model';
import { mapState } from '../../src/adapters/home-assistant/state-mapper';
import { config, fakeHass } from '../fixtures/state';

const state = () => mapState(config, fakeHass());
describe('confirmed visual state', () => {
  it.each([
    [false, false, 'off'],
    [false, true, 'flame'],
    [true, false, 'heat'],
    [true, true, 'both'],
  ] as const)('heating %s flame %s -> %s', (heating, flame, expected) =>
    expect(visualState({ ...state(), heating, flame })).toBe(expected),
  );
  it('distinguishes standby, unknown state and fan-only ventilation', () => {
    expect(visualState({ ...state(), power: false, heating: null })).toBe('off');
    expect(visualState({ ...state(), heating: null })).toBe('unknown');
    expect(visualState({ ...state(), flame: null })).toBe('unknown');
    expect(visualState({ ...state(), mode: 'fan_only' })).toBe('flame');
    expect(visualState({ ...state(), mode: 'fan_only', flame: false })).toBe('off');
  });
});
describe('commands preserve unrelated settings', () => {
  const valid: Command[] = [
    { kind: 'power', value: false },
    { kind: 'flame', value: false },
    { kind: 'heating', value: false },
    { kind: 'temperature', value: 22.5 },
    { kind: 'mode', value: 'eco' },
    { kind: 'color', value: 'blue' },
    { kind: 'brightness', value: 'low' },
  ];
  it.each(valid)('accepts supported $kind', (command) => {
    const snapshot = state();
    const before = structuredClone(snapshot);
    expect(() => validateCommand(snapshot, command)).not.toThrow();
    expect(snapshot).toEqual(before);
    expect(isConfirmed(snapshot, command)).toBe(false);
  });
  it('only advertises the supported requested presets', () =>
    expect(visibleModes(state())).toEqual(['normal', 'eco', 'fan_only']));
  it('never wakes standby implicitly for flame', () => {
    expect(() =>
      validateCommand({ ...state(), power: false }, { kind: 'flame', value: true }),
    ).toThrow(new ControlError('standby'));
    expect(() =>
      validateCommand({ ...state(), power: false }, { kind: 'flame', value: false }),
    ).not.toThrow();
  });
  it.each(['power', 'flame', 'heating'] as const)('rejects missing %s', (kind) =>
    expect(() => validateCommand({ ...state(), [kind]: null }, { kind, value: true })).toThrow(
      'unavailable',
    ),
  );
  it('rejects unavailable climate, target and ranges', () => {
    for (const changes of [
      { climateAvailable: false },
      { target: null },
      { minimum: null },
      { maximum: null },
      { step: null },
    ])
      expect(() =>
        validateCommand({ ...state(), ...changes }, { kind: 'temperature', value: 22 }),
      ).toThrow('unavailable');
    expect(() =>
      validateCommand({ ...state(), climateAvailable: false }, { kind: 'heating', value: true }),
    ).toThrow('unavailable');
    expect(() =>
      validateCommand({ ...state(), climateAvailable: false }, { kind: 'mode', value: 'eco' }),
    ).toThrow('unavailable');
  });
  it.each([NaN, Infinity, -Infinity, 14, 31, 22.2])('rejects invalid target %s', (value) =>
    expect(() => validateCommand(state(), { kind: 'temperature', value })).toThrow('invalid_value'),
  );
  it('rejects unsupported preset and choices', () => {
    expect(() => validateCommand(state(), { kind: 'mode', value: 'away' })).toThrow(
      'invalid_value',
    );
    for (const kind of ['color', 'brightness'] as const) {
      expect(() => validateCommand(state(), { kind, value: 'invented' })).toThrow('invalid_value');
      expect(() =>
        validateCommand(
          { ...state(), [kind]: { available: false, value: null, options: [] } },
          { kind, value: 'blue' },
        ),
      ).toThrow('unavailable');
    }
  });
  it('requires actual confirmed values, including availability', () => {
    expect(isConfirmed(state(), { kind: 'temperature', value: 22 })).toBe(true);
    expect(isConfirmed({ ...state(), target: null }, { kind: 'temperature', value: 22 })).toBe(
      false,
    );
    expect(isConfirmed(state(), { kind: 'mode', value: 'normal' })).toBe(true);
    expect(
      isConfirmed({ ...state(), climateAvailable: false }, { kind: 'mode', value: 'normal' }),
    ).toBe(false);
    expect(isConfirmed(state(), { kind: 'color', value: 'yellow_red_blue' })).toBe(true);
    expect(isConfirmed(state(), { kind: 'brightness', value: 'high' })).toBe(true);
    expect(
      isConfirmed(
        { ...state(), color: { ...state().color, available: false } },
        { kind: 'color', value: 'yellow_red_blue' },
      ),
    ).toBe(false);
    expect(isConfirmed(state(), { kind: 'heating', value: true })).toBe(true);
  });
});
it('converts temperature once without changing equal units', () => {
  expect(convertTemperature(20, '°C', '°C')).toBe(20);
  expect(convertTemperature(68, '°F', '°C')).toBe(20);
  expect(convertTemperature(20, '°C', '°F')).toBe(68);
});
