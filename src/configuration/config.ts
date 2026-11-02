import { CARD_TYPE, SCHEMA_VERSION, type CardConfig, type EntityRole } from '../domain/model';

const DOMAINS: Record<EntityRole, string> = {
  power: 'switch',
  flame: 'light',
  climate: 'climate',
  color: 'select',
  brightness: 'select',
  ambient: 'sensor',
};
const RECORD = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

export function validateImage(value: unknown): string {
  if (typeof value !== 'string')
    throw new Error('images: use a same-origin absolute path, e.g. /local/fireplace.png');
  const url = new URL(value, 'https://home-assistant.invalid');
  if (url.origin !== 'https://home-assistant.invalid')
    throw new Error('images: external URLs are not supported; use a same-origin absolute path');
  if (!/^\/(?!\/)[^\s\\]*$/.test(value))
    throw new Error('images: use a same-origin absolute path, e.g. /local/fireplace.png');
  return value;
}

function parseEntities(value: unknown): CardConfig['entities'] {
  if (!RECORD(value)) throw new Error('entities: select a flame or climate entity');
  const entities: CardConfig['entities'] = {};
  for (const [key, entry] of Object.entries(value)) {
    if (!Object.hasOwn(DOMAINS, key)) throw new Error(`entities.${key}: unsupported role`);
    const role = key as EntityRole;
    if (typeof entry !== 'string' || !new RegExp(`^${DOMAINS[role]}\\.[a-z0-9_]+$`).test(entry))
      throw new Error(`entities.${key}: expected a ${DOMAINS[role]} entity`);
    entities[role] = entry;
  }
  if (!entities.flame && !entities.climate)
    throw new Error('entities: select a flame or climate entity');
  return entities;
}

function parseImages(value: unknown): CardConfig['images'] {
  const images: CardConfig['images'] = {};
  if (value === undefined) return images;
  if (!RECORD(value)) throw new Error('images: expected an object');
  for (const [key, image] of Object.entries(value)) {
    if (!['off', 'flame', 'heat', 'both'].includes(key))
      throw new Error(`images.${key}: unsupported state`);
    images[key as keyof typeof images] = validateImage(image);
  }
  return images;
}

export function parseConfig(value: unknown): CardConfig {
  if (!RECORD(value) || value.type !== CARD_TYPE) throw new Error(`type: expected ${CARD_TYPE}`);
  if (value.version !== undefined && value.version !== SCHEMA_VERSION)
    throw new Error('version: unsupported configuration version');
  const entities = parseEntities(value.entities);
  if (value.name !== undefined && (typeof value.name !== 'string' || !value.name.trim()))
    throw new Error('name: expected a non-empty string');
  for (const key of ['show_power', 'show_image']) {
    if (value[key] !== undefined && typeof value[key] !== 'boolean')
      throw new Error(`${key}: expected a boolean`);
  }
  return {
    type: CARD_TYPE,
    version: SCHEMA_VERSION,
    entities,
    images: parseImages(value.images),
    show_power: value.show_power === true,
    show_image: value.show_image !== false,
    ...(typeof value.name === 'string' ? { name: value.name } : {}),
  };
}
