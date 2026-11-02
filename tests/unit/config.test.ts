import { expect, it } from 'vitest';
import { parseConfig, validateImage } from '../../src/configuration/config';
import { CARD_TYPE } from '../../src/domain/model';
import { config } from '../fixtures/state';
it('normalizes optional defaults and is idempotent', () => {
  expect(parseConfig(config)).toEqual(config);
  expect(parseConfig({ type: CARD_TYPE, entities: { flame: 'light.fire' } })).toMatchObject({
    version: 1,
    show_power: false,
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
