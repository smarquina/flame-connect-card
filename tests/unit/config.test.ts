import { expect, it } from 'vitest';
import { parseConfig, validateImage } from '../../src/configuration/config';
import { CARD_TYPE } from '../../src/domain/model';
import { config } from '../fixtures/state';
it('normalizes optional defaults and is idempotent', () => {
  expect(parseConfig(config)).toEqual(config);
  expect(parseConfig({ type: CARD_TYPE, entities: { flame: 'light.fire' } })).toMatchObject({
    version: 1,
    show_power: true,
    show_image: true,
    images: {},
  });
  expect(
    parseConfig({ type: CARD_TYPE, entities: { climate: 'climate.fire' }, show_image: false })
      .show_image,
  ).toBe(false);
});
it.each([
  null,
  [],
  {},
  { ...config, type: 'wrong' },
  { ...config, version: 2 },
  { ...config, entities: null },
  { ...config, entities: [] },
  { ...config, entities: {} },
  { ...config, entities: { flame: 'switch.fire' } },
  { ...config, entities: { flame: 'light.fire', something: 'x' } },
  { ...config, entities: { flame: 'light.fire', constructor: 'x' } },
  { ...config, entities: { flame: 'light.fire<script>' } },
  { ...config, name: '' },
  { ...config, name: ' ' },
  { ...config, name: 2 },
  { ...config, show_power: 'yes' },
  { ...config, show_image: 1 },
  { ...config, images: [] },
  { ...config, images: { unknown: '/local/test.png' } },
])('rejects invalid configuration %#', (value) => expect(() => parseConfig(value)).toThrow());
it('validates and preserves four custom local images', () => {
  const images = {
    off: '/local/off.png',
    flame: '/hacsfiles/flame.png?v=1',
    heat: '/local/heat.webp',
    both: '/local/both.png',
  };
  expect(parseConfig({ ...config, images }).images).toEqual(images);
  expect(parseConfig({ ...config, images: {} }).images).toEqual({});
});
it.each([
  2,
  '',
  '//attacker.test/x.png',
  'https://test/x.png',
  'javascript:alert(1)',
  'data:image/svg+xml,x',
  '/\\attacker/x',
  '/local/a b.png',
])('rejects unsafe image reference %s', (value) => expect(() => validateImage(value)).toThrow());

it.each([
  'show_flame',
  'show_heating',
  'show_target',
  'show_ambient',
  'show_mode',
  'show_color',
  'show_brightness',
] as const)(
  'defaults %s to visible and accepts explicit hiding without dropping entity bindings',
  (key) => {
    expect(parseConfig({ type: CARD_TYPE, entities: config.entities })[key]).toBe(true);
    expect(parseConfig({ ...config, [key]: false })).toMatchObject({
      [key]: false,
      entities: config.entities,
    });
    expect(() => parseConfig({ ...config, [key]: 'false' })).toThrow(`${key}: expected a boolean`);
  },
);

it.each([
  null,
  {},
  'ambient',
  [],
  ['ambient', 'target', 'mode', 'color', 'color'],
  ['ambient', 'target', 'mode', 'color', 'unsupported'],
  ['ambient', 'target', 'mode', 'color', 1],
])('rejects invalid control order %#', (control_order) => {
  expect(() => parseConfig({ ...config, control_order })).toThrow('control_order:');
});
it('preserves a custom control order without mutating the provided array', () => {
  const control_order = ['brightness', 'color', 'mode', 'target', 'ambient'];
  const parsed = parseConfig({ ...config, control_order });
  expect(parsed.control_order).toEqual(control_order);
  expect(parsed.control_order).not.toBe(control_order);
});

it.each([
  [undefined, '#000000'],
  ['none', 'transparent'],
  ['transparent', 'transparent'],
  ['black', '#000000'],
  ['white', '#ffffff'],
  ['#Ab12Cd', '#ab12cd'],
])('normalizes the fireplace background %s', (image_background, expected) => {
  expect(parseConfig({ ...config, image_background }).image_background).toBe(expected);
});
it.each([
  null,
  0,
  {},
  'constructor',
  '#fff',
  'url(https://example.com)',
  'red;display:none',
  '#12345g',
])('rejects unsafe or invalid background %#', (image_background) => {
  expect(() => parseConfig({ ...config, image_background })).toThrow('image_background:');
});
