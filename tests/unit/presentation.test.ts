import { afterEach, expect, it, vi } from 'vitest';
import '../../src/index';
import { FlameConnectCard } from '../../src/presentation/card';
import { FlameConnectCardEditor } from '../../src/presentation/editor';
import { FireplaceController } from '../../src/application/controller';
import { config, fakeHass } from '../fixtures/state';
import type { HomeAssistant, RegistryEntry } from '../../src/adapters/home-assistant/types';
import type { CardConfig } from '../../src/domain/model';

afterEach(() => {
  document.body.replaceChildren();
  vi.useRealTimers();
  vi.restoreAllMocks();
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
    (entry.getAttribute('aria-label') ?? entry.textContent!).includes(label),
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
  button(element, 'Turn fireplace off').click();
  hass.states['switch.fire_power']!.state = 'off';
  await settle(element, hass);
  expect(hass.callService).toHaveBeenCalledTimes(3);
});
it('previews a slider gesture locally and sends one validated temperature on commit', async () => {
  const hass = fakeHass();
  hass.callService = vi.fn().mockResolvedValue(undefined);
  const element = await card(hass);
  const slider = input(element);
  expect(slider.type).toBe('range');
  expect(slider.min).toBe('15');
  expect(slider.max).toBe('30');
  expect(slider.step).toBe('0.5');
  slider.value = '23';
  slider.dispatchEvent(new Event('input'));
  expect(slider.getAttribute('aria-valuetext')).toBe('23 °C');
  expect(hass.callService).not.toHaveBeenCalled();
  expect(element.shadowRoot!.querySelector('.target-value')!.textContent).toBe('22 °C');
  slider.dispatchEvent(new Event('change'));
  expect(slider.value).toBe('22');
  hass.states['climate.fire_heating']!.attributes.temperature = 23;
  await settle(element, hass);
  expect(slider.value).toBe('23');
  expect(hass.callService).toHaveBeenCalledTimes(1);
  const forged = vi.spyOn(slider, 'valueAsNumber', 'get').mockReturnValue(99);
  slider.dispatchEvent(new Event('change'));
  await vi.waitFor(() => expect(text(element)).toContain('supported value'));
  forged.mockRestore();
  expect(hass.callService).toHaveBeenCalledTimes(1);
});
it('selects presets and discrete settings without optimistic display', async () => {
  const hass = fakeHass();
  hass.callService = vi.fn().mockResolvedValue(undefined);
  const element = await card(hass);
  for (const [label, value, entity] of [
    ['Heating / fan mode', 'eco', 'climate.fire_heating'],
    ['Flame color', 'blue', 'select.fire_color'],
    ['Flame brightness', 'low', 'select.fire_brightness'],
  ] as const) {
    const select = element.shadowRoot!.querySelector<HTMLSelectElement>(`[aria-label="${label}"]`)!;
    select.value = value;
    select.dispatchEvent(new Event('change'));
    expect(select.value).not.toBe(value);
    if (label === 'Heating / fan mode') hass.states[entity]!.attributes.preset_mode = value;
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
  expect(element.shadowRoot!.querySelector('.hint')).toBeNull();
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
  expect(element.shadowRoot!.querySelector('.reading')!.textContent).toBe('—');
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

it('renders the editor before HA context exists and ignores non-object configurations', async () => {
  const element = document.createElement('flame-connect-card-editor') as FlameConnectCardEditor;
  document.body.append(element);
  element.setConfig([]);
  await element.updateComplete;
  expect(text(element)).toContain('Card title');
  expect(select(element, 'Flame').options).toHaveLength(1);
  const emitted = vi.fn();
  element.addEventListener('config-changed', emitted);
  element.setConfig({ type: config.type, entities: { flame: 'light.fire_flame' } });
  const hass = fakeHass();
  hass.callWS = vi.fn().mockResolvedValue([
    {
      entity_id: 'light.fire_flame',
      unique_id: 'id_flame',
      platform: 'flame_connect',
      device_id: 'device',
      disabled_by: null,
    },
  ]);
  element.hass = hass;
  await element.updateComplete;
  await Promise.resolve();
  await element.updateComplete;
  change(select(element, 'Choose a Flame Connect fireplace'), 'device');
  expect((emitted.mock.calls[0]![0] as CustomEvent).detail.config.entities).toEqual({
    flame: 'light.fire_flame',
  });
});

it('uses English defaults when a frontend context has not provided a language yet', async () => {
  const hass = fakeHass();
  Reflect.deleteProperty(hass, 'language');
  const element = await card(hass);
  expect(text(element)).toContain('Room temperature');
  expect(text(element)).toContain('19.5 °C');
});

it('supports a heating-only card without presenting a decorative flame control', async () => {
  const element = await card(fakeHass(), { entities: { climate: 'climate.fire_heating' } });
  expect(text(element)).toContain('Heating enabled');
  expect(button(element, 'Heating').disabled).toBe(false);
  expect(button(element, 'Flame')).toBeUndefined();
  expect(input(element).value).toBe('22');
});

it('redacts unexpected application errors and ignores events from a removed card', async () => {
  const hass = fakeHass();
  hass.callService = vi.fn().mockResolvedValue(undefined);
  const element = await card(hass);
  vi.spyOn(FireplaceController.prototype, 'execute').mockRejectedValueOnce(
    new Error('private details'),
  );
  button(element, 'Flame').click();
  await vi.waitFor(() => expect(text(element)).toContain('The action failed'));
  expect(text(element)).not.toContain('private details');
  const staleButton = button(element, 'Flame');
  element.remove();
  staleButton.click();
  await Promise.resolve();
  expect(hass.callService).not.toHaveBeenCalled();
});

it('does not trust change events from disabled temperature and option controls', async () => {
  const hass = fakeHass();
  hass.callService = vi.fn();
  hass.states['climate.fire_heating']!.state = 'unavailable';
  hass.states['select.fire_color']!.state = 'unavailable';
  const element = await card(hass);
  expect(input(element).disabled).toBe(true);
  change(input(element), '22');
  await vi.waitFor(() => expect(text(element)).toContain('This control is unavailable'));
  expect(input(element).value).toBe('15');
  change(select(element, 'Heating / fan mode'), 'eco');
  await element.updateComplete;
  change(select(element, 'Flame color'), 'blue');
  await element.updateComplete;
  expect(select(element, 'Flame color').value).toBe('');
  expect(hass.callService).not.toHaveBeenCalled();
});

it('reports a generic configuration failure if the host event API throws a non-Error value', async () => {
  const element = await editor();
  vi.spyOn(element, 'dispatchEvent').mockImplementationOnce(() => {
    throw 'private host details';
  });
  change(
    element.shadowRoot!.querySelector<HTMLInputElement>('[aria-label="Card title"]')!,
    'Another title',
  );
  await element.updateComplete;
  expect(text(element)).toContain('Invalid configuration');
  expect(text(element)).not.toContain('private host details');
});

it('loads duplicate resource modules without redefining elements or duplicating card-picker entries', async () => {
  const registry = window as unknown as { customCards: { type: string }[] };
  const previous = registry.customCards;
  const define = vi.spyOn(customElements, 'define');
  try {
    registry.customCards = [{ type: 'another-card' }];
    vi.resetModules();
    await import('../../src/index');
    expect(registry.customCards.map((entry) => entry.type)).toEqual([
      'another-card',
      'flame-connect-card',
    ]);
    vi.resetModules();
    await import('../../src/index');
    expect(
      registry.customCards.filter((entry) => entry.type === 'flame-connect-card'),
    ).toHaveLength(1);
    expect(define).not.toHaveBeenCalled();
  } finally {
    registry.customCards = previous;
  }
});

it('groups icon-only power, flame and heating and changes the power action after readback', async () => {
  const hass = fakeHass();
  hass.callService = vi.fn().mockResolvedValue(undefined);
  const element = await card(hass);
  const group = element.shadowRoot!.querySelector('[role="group"]')!;
  expect(
    [...group.querySelectorAll('button')].map((entry) => entry.getAttribute('aria-label')),
  ).toEqual(['Turn fireplace off', 'Flame · On', 'Heating · On']);
  for (const control of group.querySelectorAll('button')) {
    expect(control.textContent!.trim()).toBe('');
    expect(control.querySelector('svg')).not.toBeNull();
    expect(control.title).toBe(control.getAttribute('aria-label'));
  }
  const offPath = button(element, 'Turn fireplace off').querySelector('path')!.getAttribute('d');
  button(element, 'Turn fireplace off').click();
  hass.states['switch.fire_power']!.state = 'off';
  await settle(element, hass);
  const start = button(element, 'Turn fireplace on');
  expect(start.querySelector('path')!.getAttribute('d')).not.toBe(offPath);
  start.click();
  hass.states['switch.fire_power']!.state = 'on';
  await settle(element, hass);
  expect(button(element, 'Turn fireplace off').getAttribute('aria-pressed')).toBe('true');
  expect(hass.callService).toHaveBeenNthCalledWith(
    2,
    'switch',
    'turn_on',
    {},
    { entity_id: 'switch.fire_power' },
  );
  hass.states['switch.fire_power']!.state = 'unavailable';
  await settle(element, hass);
  expect(button(element, 'Turn fireplace on').disabled).toBe(true);
  expect(element.shadowRoot!.querySelector('.hint')).toBeNull();
  element.setConfig({ ...config, show_power: false });
  await element.updateComplete;
  expect(button(element, 'Turn fireplace on')).toBeUndefined();
});

it.each([
  ['show_target', '#target'],
  ['show_ambient', '.reading'],
  ['show_flame', 'button[aria-label="Flame · On"]'],
  ['show_heating', 'button[aria-label="Heating · On"]'],
  ['show_mode', 'select[aria-label="Heating / fan mode"]'],
  ['show_color', 'select[aria-label="Flame color"]'],
  ['show_brightness', 'select[aria-label="Flame brightness"]'],
] as const)(
  'hides %s independently and restores it without changing entity state',
  async (key, selector) => {
    const hass = fakeHass();
    hass.callService = vi.fn();
    const element = await card(hass, { [key]: false });
    expect(element.shadowRoot!.querySelector(selector)).toBeNull();
    expect(button(element, 'Turn fireplace off')).toBeDefined();
    element.setConfig({ ...config, [key]: true });
    await element.updateComplete;
    expect(element.shadowRoot!.querySelector(selector)).not.toBeNull();
    expect(hass.callService).not.toHaveBeenCalled();
  },
);

it('exposes translated visibility settings in the visual editor and preserves them when reopened', async () => {
  const hass = fakeHass();
  hass.language = 'es';
  const element = await editor(hass, { ...config, show_target: false });
  const changes = vi.fn();
  element.addEventListener('config-changed', changes);
  const target = [...element.shadowRoot!.querySelectorAll('label')]
    .find((label) => label.textContent!.includes('Mostrar temperatura objetivo'))!
    .querySelector('input')!;
  expect(target.checked).toBe(false);
  target.checked = true;
  target.dispatchEvent(new Event('change'));
  const saved = (changes.mock.calls[0]![0] as CustomEvent).detail.config;
  expect(saved).toMatchObject({ show_target: true, entities: config.entities });
  element.setConfig(saved);
  await element.updateComplete;
  expect(target.checked).toBe(true);
  expect(hass.states['climate.fire_heating']!.attributes.temperature).toBe(22);
});

it('renders visible settings in configured order and retains hidden positions', async () => {
  const control_order = ['brightness', 'color', 'mode', 'target', 'ambient'] as const;
  const element = await card(fakeHass(), { control_order: [...control_order], show_target: false });
  const rendered = () =>
    [...element.shadowRoot!.querySelectorAll('[data-control]')].map((entry) =>
      entry.getAttribute('data-control'),
    );
  expect(rendered()).toEqual(['brightness', 'color', 'mode', 'ambient']);
  element.setConfig({ ...config, control_order: [...control_order] });
  await element.updateComplete;
  expect(rendered()).toEqual(control_order);
});

it('moves controls up and down, preserves hidden settings, and rejects boundary moves', async () => {
  const hass = fakeHass();
  hass.callService = vi.fn();
  const element = await editor(hass, { ...config, show_target: false });
  const changes = vi.fn();
  element.addEventListener('config-changed', changes);
  const move = (label: string) =>
    element.shadowRoot!.querySelector<HTMLButtonElement>(`[aria-label="${label}"]`)!;
  move('Move up: Room temperature').dispatchEvent(new Event('click'));
  move('Move down: Flame brightness').dispatchEvent(new Event('click'));
  expect(changes).not.toHaveBeenCalled();
  move('Move up: Target temperature').click();
  await element.updateComplete;
  expect((changes.mock.lastCall![0] as CustomEvent).detail.config).toMatchObject({
    control_order: ['target', 'ambient', 'mode', 'color', 'brightness'],
    show_target: false,
    entities: config.entities,
  });
  move('Move down: Target temperature').click();
  await element.updateComplete;
  expect((changes.mock.lastCall![0] as CustomEvent).detail.config.control_order).toEqual(
    config.control_order,
  );
  expect(hass.callService).not.toHaveBeenCalled();
  element.setConfig({ ...config, control_order: ['invalid'] });
  await element.updateComplete;
  expect(element.shadowRoot!.querySelectorAll('[data-order-control]')).toHaveLength(5);
});

it('disables the slider for missing or fixed limits and handles unavailable temperatures without NaN', async () => {
  const hass = fakeHass();
  hass.callService = vi.fn();
  const climate = hass.states['climate.fire_heating']!;
  climate.attributes.min_temp = 22;
  climate.attributes.max_temp = 22;
  const element = await card(hass);
  expect(input(element).disabled).toBe(true);
  expect(input(element).style.getPropertyValue('--fill')).toBe('0%');
  climate.attributes.min_temp = null;
  climate.attributes.max_temp = null;
  climate.state = 'unavailable';
  await settle(element, hass);
  expect(input(element).disabled).toBe(true);
  expect(element.shadowRoot!.querySelector('.target-value')!.textContent).toBe('—');
  input(element).dispatchEvent(new Event('input'));
  input(element).dispatchEvent(new Event('change'));
  await element.updateComplete;
  expect(hass.callService).not.toHaveBeenCalled();
  expect(input(element).style.getPropertyValue('--fill')).toBe('0%');
});

it('persists image background choices through the editor without changing device state', async () => {
  const hass = fakeHass();
  hass.callService = vi.fn();
  const element = await editor(hass);
  const changes = vi.fn();
  element.addEventListener('config-changed', changes);
  const picker = () => element.shadowRoot!.querySelector<HTMLInputElement>('input[type="color"]')!;
  const background = select(element, 'Background style');
  expect(background.value).toBe('color');
  expect(picker().value).toBe('#000000');
  change(picker(), '#ffffff');
  await element.updateComplete;
  expect((changes.mock.lastCall![0] as CustomEvent).detail.config.image_background).toBe('#ffffff');
  change(background, 'none');
  await element.updateComplete;
  expect(picker().disabled).toBe(true);
  const saved = (changes.mock.lastCall![0] as CustomEvent).detail.config;
  element.setConfig(saved);
  await element.updateComplete;
  expect(background.value).toBe('none');
  change(background, 'color');
  await element.updateComplete;
  expect(picker().disabled).toBe(false);
  expect((changes.mock.lastCall![0] as CustomEvent).detail.config.image_background).toBe('#000000');
  element.setConfig({ ...config, image_background: 'invalid' });
  await element.updateComplete;
  expect(picker().value).toBe('#000000');
  expect(hass.callService).not.toHaveBeenCalled();
});

it.each(['transparent', '#000000', '#ffffff', '#123456'])(
  'applies %s only to the scene background',
  async (image_background) => {
    const element = await card(fakeHass(), { image_background });
    const scene = element.shadowRoot!.querySelector<HTMLElement>('.scene')!;
    expect(scene.style.backgroundColor).toBe(image_background);
    expect(scene.style.backgroundImage).toContain('data:image/png');
  },
);
