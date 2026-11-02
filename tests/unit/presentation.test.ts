import { afterEach, expect, it, vi } from 'vitest';
import '../../src/index';
import { FlameConnectCard } from '../../src/presentation/card';
import { FlameConnectCardEditor } from '../../src/presentation/editor';
import { config, fakeHass } from '../fixtures/state';
import type { HomeAssistant, RegistryEntry } from '../../src/adapters/home-assistant/types';
import type { CardConfig } from '../../src/domain/model';

afterEach(() => {
  document.body.replaceChildren();
  vi.useRealTimers();
});
async function card(hass = fakeHass(), override: Partial<CardConfig> = {}) {
  const element = document.createElement('flame-connect-card') as FlameConnectCard;
  element.setConfig({ ...config, ...override });
  element.hass = hass;
  document.body.append(element);
  await element.updateComplete;
  return element;
}
const text = (element: HTMLElement) => element.shadowRoot!.textContent!;
const button = (element: HTMLElement, label: string) =>
  [...element.shadowRoot!.querySelectorAll('button')].find((entry) =>
    entry.textContent!.includes(label),
  )!;
const input = (element: HTMLElement) =>
  element.shadowRoot!.querySelector<HTMLInputElement>('#target')!;
async function settle(element: FlameConnectCard, hass: HomeAssistant): Promise<void> {
  element.hass = { ...hass };
  await element.updateComplete;
  await Promise.resolve();
  await element.updateComplete;
}
it('renders nothing before configuration/state and exposes HA sizing and registry contracts', async () => {
  const element = document.createElement('flame-connect-card') as FlameConnectCard;
  document.body.append(element);
  await element.updateComplete;
  expect(element.shadowRoot!.querySelector('ha-card')).toBeNull();
  element.hass = fakeHass();
  await element.updateComplete;
  expect(element.shadowRoot!.querySelector('ha-card')).toBeNull();
  expect(element.getCardSize()).toBe(8);
  expect(element.getGridOptions()).toMatchObject({ columns: 12, rows: 'auto' });
  expect(FlameConnectCard.getStubConfig().type).toBe('custom:flame-connect-card');
  expect(FlameConnectCard.getConfigElement()).toBeInstanceOf(FlameConnectCardEditor);
});
it('renders all image combinations, custom assets, standby and missing controls', async () => {
  const hass = fakeHass();
  const element = await card(hass);
  expect(text(element)).toContain('19.5 °C');
  for (const [heat, flame, label] of [
    ['off', 'off', 'Flame and heating off'],
    ['off', 'on', 'Flame only'],
    ['heat', 'off', 'Heating enabled'],
    ['heat', 'on', 'Heating and flame enabled'],
  ] as const) {
    hass.states['climate.fire_heating']!.state = heat;
    hass.states['light.fire_flame']!.state = flame;
    await settle(element, hass);
    expect(text(element)).toContain(label);
  }
  hass.states['climate.fire_heating']!.attributes.preset_mode = 'fan_only';
  await settle(element, hass);
  expect(text(element)).toContain('Ventilation enabled');
  hass.states['switch.fire_power']!.state = 'off';
  await settle(element, hass);
  expect(text(element)).toContain('Standby');
  element.setConfig({ ...config, images: { off: '/local/off.png' } });
  await element.updateComplete;
  expect(element.shadowRoot!.querySelector('.scene')!.getAttribute('style')).toContain(
    '/local/off.png',
  );
  hass.states['switch.fire_power']!.state = 'on';
  hass.states['light.fire_flame']!.state = 'unavailable';
  hass.states['sensor.room_temperature']!.state = 'unknown';
  await settle(element, hass);
  expect(text(element)).toContain('State unavailable');
  expect(button(element, 'Flame').disabled).toBe(true);
  element.setConfig({ ...config, entities: { flame: 'light.fire_flame' }, show_image: false });
  await element.updateComplete;
  expect(element.shadowRoot!.querySelector('.scene')).toBeNull();
  expect(input(element)).toBeNull();
});
it('sends each UI action and waits for matching readback', async () => {
  const hass = fakeHass();
  hass.callService = vi.fn().mockResolvedValue(undefined);
  const element = await card(hass);
  button(element, 'Flame').click();
  await element.updateComplete;
  expect(text(element)).toContain('Waiting for confirmed');
  hass.states['light.fire_flame']!.state = 'off';
  await settle(element, hass);
  expect(text(element)).not.toContain('Waiting for confirmed');
  button(element, 'Heating').click();
  hass.states['climate.fire_heating']!.state = 'off';
  await settle(element, hass);
  button(element, '⏻').click();
  hass.states['switch.fire_power']!.state = 'off';
  await settle(element, hass);
  expect(hass.callService).toHaveBeenCalledTimes(3);
});
it('edits target through buttons/input and validates malformed values', async () => {
  const hass = fakeHass();
  hass.callService = vi.fn().mockResolvedValue(undefined);
  const element = await card(hass);
  element
    .shadowRoot!.querySelector<HTMLButtonElement>('[aria-label="Increase target temperature"]')!
    .click();
  hass.states['climate.fire_heating']!.attributes.temperature = 22.5;
  await settle(element, hass);
  element
    .shadowRoot!.querySelector<HTMLButtonElement>('[aria-label="Decrease target temperature"]')!
    .click();
  hass.states['climate.fire_heating']!.attributes.temperature = 22;
  await settle(element, hass);
  input(element).value = '23';
  input(element).dispatchEvent(new Event('change'));
  hass.states['climate.fire_heating']!.attributes.temperature = 23;
  await settle(element, hass);
  input(element).value = '99';
  input(element).dispatchEvent(new Event('change'));
  await vi.waitFor(() => expect(text(element)).toContain('supported value'));
  expect(hass.callService).toHaveBeenCalledTimes(3);
});
it('selects presets and discrete settings without optimistic display', async () => {
  const hass = fakeHass();
  hass.callService = vi.fn().mockResolvedValue(undefined);
  const element = await card(hass);
  for (const [label, value, entity] of [
    ['Mode', 'eco', 'climate.fire_heating'],
    ['Flame color', 'blue', 'select.fire_color'],
    ['Flame brightness', 'low', 'select.fire_brightness'],
  ] as const) {
    const select = element.shadowRoot!.querySelector<HTMLSelectElement>(`[aria-label="${label}"]`)!;
    select.value = value;
    select.dispatchEvent(new Event('change'));
    expect(select.value).not.toBe(value);
    if (label === 'Mode') hass.states[entity]!.attributes.preset_mode = value;
    else hass.states[entity]!.state = value;
    await settle(element, hass);
    expect(select.value).toBe(value);
  }
  hass.states['climate.fire_heating']!.attributes.preset_mode = 'boost';
  await settle(element, hass);
  expect(text(element)).toContain('Boost');
  hass.states['climate.fire_heating']!.attributes.preset_mode = null;
  await settle(element, hass);
  expect(text(element)).toContain('Select…');
});
it('supports preview, translations and lifecycle cancellation without leaking errors', async () => {
  const hass = fakeHass();
  hass.callService = vi.fn().mockRejectedValue(new Error('secret'));
  const element = await card(hass);
  element.preview = true;
  // Programmatic click also must not send an action before the next render disables buttons.
  button(element, 'Flame').click();
  await element.updateComplete;
  expect(text(element)).toContain('Preview');
  expect(hass.callService).not.toHaveBeenCalled();
  element.preview = false;
  await settle(element, hass);
  button(element, 'Flame').click();
  await vi.waitFor(() => expect(text(element)).toContain('The action failed'));
  expect(text(element)).not.toContain('secret');
  hass.language = 'es';
  hass.locale = { language: 'es-ES' };
  await settle(element, hass);
  expect(text(element)).toContain('Temperatura ambiente');
  hass.callService = vi.fn().mockResolvedValue(undefined);
  button(element, 'Llama').click();
  element.setConfig({ ...config, name: 'Reconfigured' });
  await element.updateComplete;
  expect(text(element)).not.toContain('no está disponible');
  button(element, 'Llama').click();
  element.remove();
  await Promise.resolve();
});
it('handles climate, sensor, options and metadata becoming unavailable', async () => {
  const hass = fakeHass();
  hass.states['climate.fire_heating']!.state = 'unavailable';
  hass.states['sensor.room_temperature']!.state = 'unavailable';
  hass.states['select.fire_color']!.state = 'unknown';
  const element = await card(hass, { name: undefined });
  expect(input(element).disabled).toBe(true);
  expect(text(element)).toContain('Unavailable');
  delete hass.states['climate.fire_heating'];
  delete hass.states['light.fire_flame'];
  await settle(element, hass);
  expect(text(element)).toContain('Fireplace');
});

async function editor(hass = fakeHass(), value: unknown = config) {
  const element = document.createElement('flame-connect-card-editor') as FlameConnectCardEditor;
  element.setConfig(value);
  element.hass = hass;
  document.body.append(element);
  await element.updateComplete;
  await Promise.resolve();
  await element.updateComplete;
  return element;
}
const select = (element: HTMLElement, label: string) =>
  element.shadowRoot!.querySelector<HTMLSelectElement>(`[aria-label="${label}"]`)!;
function change(element: HTMLInputElement | HTMLSelectElement, value: string): void {
  element.value = value;
  element.dispatchEvent(new Event('change'));
}
it('editor loads once, emits valid explicit mappings and preserves the external thermometer on discovery', async () => {
  const hass = fakeHass();
  const entries: RegistryEntry[] = [
    {
      entity_id: 'light.fire_flame',
      unique_id: 'id_flame',
      platform: 'flame_connect',
      device_id: 'device',
      disabled_by: null,
    },
  ];
  hass.callWS = vi.fn().mockResolvedValue(entries);
  const element = await editor(hass);
  const emitted = vi.fn();
  element.addEventListener('config-changed', emitted);
  change(select(element, 'Choose a Flame Connect fireplace'), '');
  change(select(element, 'Choose a Flame Connect fireplace'), 'device');
  await element.updateComplete;
  expect((emitted.mock.calls[0]![0] as CustomEvent).detail.config.entities).toEqual({
    flame: 'light.fire_flame',
    ambient: 'sensor.room_temperature',
  });
  change(select(element, 'Flame'), 'light.fire_flame');
  change(select(element, 'Room temperature'), '');
  const name = element.shadowRoot!.querySelector<HTMLInputElement>('[aria-label="Card title"]')!;
  change(name, 'Custom title');
  change(name, '');
  for (const check of element.shadowRoot!.querySelectorAll<HTMLInputElement>(
    'input[type="checkbox"]',
  )) {
    check.checked = !check.checked;
    check.dispatchEvent(new Event('change'));
  }
  element.hass = { ...hass };
  await element.updateComplete;
  expect(hass.callWS).toHaveBeenCalledTimes(1);
  expect(emitted).toHaveBeenCalled();
});
it('editor validates images and incomplete mappings without executing actions', async () => {
  const hass = fakeHass();
  hass.callService = vi.fn();
  const element = await editor(hass, {
    type: config.type,
    entities: { flame: 'light.missing' },
    images: { heat: '/local/heat.png' },
  });
  expect(text(element)).toContain('light.missing');
  const images = element.shadowRoot!.querySelectorAll<HTMLInputElement>('details input');
  change(images[0]!, '/local/off.png');
  change(images[0]!, 'https://attacker.test/image');
  await element.updateComplete;
  expect(text(element)).toContain('Invalid configuration');
  change(images[0]!, '');
  change(select(element, 'Flame'), '');
  await element.updateComplete;
  expect(text(element)).toContain('select a flame or climate');
  element.setConfig(null);
  expect(hass.callService).not.toHaveBeenCalled();
});
it('editor falls back to manual configuration when registry access fails and localizes labels', async () => {
  const hass = fakeHass();
  hass.language = 'es';
  hass.callWS = vi.fn().mockRejectedValue(new Error('Denied'));
  const element = await editor(hass, { type: config.type });
  await vi.waitFor(() => expect(text(element)).toContain('detección automática'));
  expect(text(element)).toContain('Temperatura ambiente');
  expect(text(element)).toContain('Calefacción');
});
