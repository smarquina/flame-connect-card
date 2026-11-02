import { describe, expect, it, vi } from 'vitest';
import { mapState, available } from '../../src/adapters/home-assistant/state-mapper';
import { HassActionGateway } from '../../src/adapters/home-assistant/action-gateway';
import { discover } from '../../src/adapters/home-assistant/discovery';
import type { RegistryEntry } from '../../src/adapters/home-assistant/types';
import type { Command } from '../../src/domain/model';
import { config, fakeHass } from '../fixtures/state';
describe('Home Assistant state contract', () => {
  it('reads distinct room and target temperatures', () => {
    expect(mapState(config, fakeHass())).toMatchObject({
      name: 'Living room',
      target: { value: 22, unit: '°C' },
      ambient: { value: 19.5, unit: '°C' },
      minimum: 15,
      maximum: 30,
      step: 0.5,
      climateAvailable: true,
    });
  });
  it('uses converted ambient temperature and HA units without treating the target as room temperature', () => {
    const hass = fakeHass();
    hass.states['sensor.room_temperature']!.state = '68';
    hass.states['sensor.room_temperature']!.attributes.unit_of_measurement = '°F';
    expect(mapState(config, hass).ambient).toEqual({ value: 20, unit: '°C' });
    delete hass.states['climate.fire_heating']!.attributes.temperature_unit;
    expect(mapState(config, hass).target?.unit).toBe('°C');
    delete hass.config;
    expect(mapState(config, hass).ambient).toEqual({ value: 68, unit: '°F' });
    expect(mapState(config, hass).target).toBeNull();
  });
  it('supports flame-only and heating-only configurations and fallback names', () => {
    const hass = fakeHass();
    expect(
      mapState({ ...config, name: undefined, entities: { flame: 'light.fire_flame' } }, hass),
    ).toMatchObject({ name: 'Living room flame', heating: false, power: null });
    expect(
      mapState({ ...config, name: undefined, entities: { climate: 'climate.fire_heating' } }, hass)
        .name,
    ).toBe('Living room heating');
    expect(
      mapState({ ...config, name: undefined, entities: { flame: 'light.missing' } }, hass).name,
    ).toBe('Fireplace');
  });
  it.each(['unavailable', 'unknown', 'nonsense'])(
    'keeps invalid flame/heat states unknown: %s',
    (value) => {
      const hass = fakeHass();
      hass.states['light.fire_flame']!.state = value;
      hass.states['climate.fire_heating']!.state = value;
      expect(mapState(config, hass).flame).toBeNull();
      expect(mapState(config, hass).heating).toBeNull();
    },
  );
  it('does not fabricate unsupported ranges, options or preset values', () => {
    const hass = fakeHass();
    const climate = hass.states['climate.fire_heating']!;
    climate.attributes = {
      hvac_modes: [],
      preset_modes: ['normal', 2],
      preset_mode: 42,
      temperature: NaN,
      min_temp: 30,
      max_temp: 15,
      target_temp_step: 0,
    };
    const mapped = mapState(config, hass);
    expect(mapped).toMatchObject({
      climateAvailable: false,
      mode: null,
      modes: ['normal'],
      target: null,
      minimum: null,
      maximum: null,
      step: null,
    });
    delete hass.states['climate.fire_heating'];
    expect(mapState(config, hass).climateAvailable).toBe(false);
    expect(available(undefined)).toBe(false);
  });
  it('does not accept unknown selects or non-temperature sensor values', () => {
    const hass = fakeHass();
    hass.states['select.fire_color']!.state = 'unknown';
    hass.states['select.fire_brightness']!.attributes.options = 'not an array';
    expect(mapState(config, hass).color.available).toBe(false);
    expect(mapState(config, hass).brightness.value).toBeNull();
    for (const value of ['', ' ', 'Infinity', 'unavailable', 'abc']) {
      hass.states['sensor.room_temperature']!.state = value;
      expect(mapState(config, hass).ambient).toBeNull();
    }
    hass.states['sensor.room_temperature']!.state = '20';
    delete hass.states['sensor.room_temperature']!.attributes.device_class;
    expect(mapState(config, hass).ambient).toBeNull();
    hass.states['sensor.room_temperature']!.attributes.device_class = 'temperature';
    hass.states['sensor.room_temperature']!.attributes.unit_of_measurement = 'K';
    expect(mapState(config, hass).ambient).toBeNull();
  });
});
describe('exact service contract', () => {
  const cases: [Command, string, string, object, string][] = [
    [{ kind: 'power', value: true }, 'switch', 'turn_on', {}, 'switch.fire_power'],
    [{ kind: 'power', value: false }, 'switch', 'turn_off', {}, 'switch.fire_power'],
    [{ kind: 'flame', value: true }, 'light', 'turn_on', {}, 'light.fire_flame'],
    [{ kind: 'flame', value: false }, 'light', 'turn_off', {}, 'light.fire_flame'],
    [
      { kind: 'heating', value: true },
      'climate',
      'set_hvac_mode',
      { hvac_mode: 'heat' },
      'climate.fire_heating',
    ],
    [
      { kind: 'heating', value: false },
      'climate',
      'set_hvac_mode',
      { hvac_mode: 'off' },
      'climate.fire_heating',
    ],
    [
      { kind: 'temperature', value: 22.5 },
      'climate',
      'set_temperature',
      { temperature: 22.5 },
      'climate.fire_heating',
    ],
    [
      { kind: 'mode', value: 'eco' },
      'climate',
      'set_preset_mode',
      { preset_mode: 'eco' },
      'climate.fire_heating',
    ],
    [
      { kind: 'color', value: 'blue' },
      'select',
      'select_option',
      { option: 'blue' },
      'select.fire_color',
    ],
    [
      { kind: 'brightness', value: 'low' },
      'select',
      'select_option',
      { option: 'low' },
      'select.fire_brightness',
    ],
  ];
  it.each(cases)('maps %j to one exact action', async (command, domain, service, data, entity) => {
    const hass = fakeHass();
    hass.callService = vi.fn().mockResolvedValue(undefined);
    await new HassActionGateway(() => hass, config.entities).send(command);
    expect(hass.callService).toHaveBeenCalledExactlyOnceWith(domain, service, data, {
      entity_id: entity,
    });
  });
  it('fails when binding or service is unavailable', async () => {
    await expect(
      new HassActionGateway(fakeHass, {}).send({ kind: 'color', value: 'blue' }),
    ).rejects.toThrow('unavailable');
    const hass = fakeHass();
    hass.callService = vi.fn().mockRejectedValue(new Error('test'));
    await expect(
      new HassActionGateway(() => hass, config.entities).send({ kind: 'flame', value: false }),
    ).rejects.toThrow('test');
  });
});
describe('entity registry discovery', () => {
  it('groups only enabled matching integration entities and never guesses translated names', async () => {
    const hass = fakeHass();
    const entry = (
      entity_id: string,
      unique_id: string,
      overrides: Partial<RegistryEntry> = {},
    ): RegistryEntry => ({
      entity_id,
      unique_id,
      platform: 'flame_connect',
      device_id: 'device',
      disabled_by: null,
      ...overrides,
    });
    hass.callWS = vi
      .fn()
      .mockResolvedValue([
        entry('light.fire_flame', 'id_flame'),
        entry('climate.fire_heating', 'id_heating'),
        entry('select.fire_color', 'id_color'),
        entry('switch.fire_power', 'id_power'),
        entry('select.fire_brightness', 'id_brightness'),
        entry('light.foreign', 'id_flame', { platform: 'other' }),
        entry('select.disabled', 'id_color', { disabled_by: 'user' }),
        entry('light.missing_device', 'id_flame', { device_id: null }),
        entry('switch.wrong_domain', 'id_flame'),
        entry('sensor.unrelated', 'id_firmware'),
        entry('switch.lonely', 'id_power', { device_id: 'no-controls' }),
        entry('light.second', 'other_flame', { device_id: 'second', name: 'Second' }),
        entry('light.third', 'third_flame', { device_id: 'third', original_name: 'Third' }),
      ]);
    const devices = await discover(hass);
    expect(devices).toHaveLength(3);
    expect(devices[0]?.entities).toEqual({
      flame: 'light.fire_flame',
      climate: 'climate.fire_heating',
      color: 'select.fire_color',
      power: 'switch.fire_power',
      brightness: 'select.fire_brightness',
    });
    expect(devices[0]?.name).toBe('Living room heating');
    expect(devices[1]?.name).toBe('Second');
    expect(devices[2]?.name).toBe('Third');
  });
  it('lets the editor fall back to manual selection on a registry error', async () => {
    const hass = fakeHass();
    hass.callWS = vi.fn().mockRejectedValue(new Error('Unauthorized'));
    await expect(discover(hass)).rejects.toThrow('Unauthorized');
  });
});
