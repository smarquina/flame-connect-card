import { LitElement, css, html, nothing } from 'lit';
import { CARD_TYPE, SCHEMA_VERSION, type CardConfig, type EntityRole } from '../domain/model';
import { parseConfig } from '../configuration/config';
import { discover, type DiscoveredFireplace } from '../adapters/home-assistant/discovery';
import type { HomeAssistant } from '../adapters/home-assistant/types';
import { localize } from '../localization/localize';
import { sharedStyles } from './styles';

const ROLES: Record<EntityRole, string> = {
  climate: 'climate.',
  flame: 'light.',
  power: 'switch.',
  ambient: 'sensor.',
  color: 'select.',
  brightness: 'select.',
};
export class FlameConnectCardEditor extends LitElement {
  static readonly styles = [
    sharedStyles,
    css`
      .editor {
        display: grid;
        gap: 16px;
        padding: 12px 0;
      }
      .entities {
        display: grid;
        gap: 12px;
      }
      .check {
        display: flex;
        align-items: center;
        gap: 10px;
      }
      input[type='checkbox'] {
        width: 22px;
        min-height: 22px;
      }
      details {
        padding: 12px;
        border: 1px solid var(--divider-color, #777);
        border-radius: 10px;
      }
      summary {
        cursor: pointer;
        padding: 4px;
      }
    `,
  ];
  private currentHass?: HomeAssistant;
  private config: Record<string, unknown> = {
    type: CARD_TYPE,
    version: SCHEMA_VERSION,
    entities: {},
  };
  private fireplaces: DiscoveredFireplace[] = [];
  private discoveryStarted = false;
  private discoveryFailed = false;
  private error = '';
  set hass(value: HomeAssistant) {
    this.currentHass = value;
    if (!this.discoveryStarted) {
      this.discoveryStarted = true;
      void discover(value)
        .then((devices) => {
          this.fireplaces = devices;
          this.requestUpdate();
        })
        .catch(() => {
          this.discoveryFailed = true;
          this.requestUpdate();
        });
    }
    this.requestUpdate();
  }
  setConfig(value: unknown): void {
    if (value && typeof value === 'object' && !Array.isArray(value))
      this.config = structuredClone(value as Record<string, unknown>);
    this.requestUpdate();
  }
  private t(key: string): string {
    return localize(this.currentHass?.locale?.language ?? this.currentHass?.language ?? 'en', key);
  }
  private bindings(): CardConfig['entities'] {
    return (this.config.entities as CardConfig['entities']) ?? {};
  }
  private emit(): void {
    try {
      const config = parseConfig(this.config);
      this.error = '';
      this.dispatchEvent(
        new CustomEvent('config-changed', { detail: { config }, bubbles: true, composed: true }),
      );
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'Invalid configuration';
    }
    this.requestUpdate();
  }
  private entity(role: EntityRole, event: Event): void {
    const value = (event.currentTarget as HTMLSelectElement).value;
    const entities = { ...this.bindings() };
    if (value) entities[role] = value;
    else delete entities[role];
    this.config = { ...this.config, entities };
    this.emit();
  }
  private selectDevice(event: Event): void {
    const device = this.fireplaces.find(
      (entry) => entry.id === (event.currentTarget as HTMLSelectElement).value,
    );
    if (!device) return;
    const ambient = this.bindings().ambient;
    this.config = {
      ...this.config,
      entities: { ...device.entities, ...(ambient ? { ambient } : {}) },
    };
    this.emit();
  }
  private options(role: EntityRole): string[] {
    return Object.keys(this.currentHass?.states ?? {})
      .filter((entity) => {
        if (!entity.startsWith(ROLES[role])) return false;
        return (
          role !== 'ambient' ||
          this.currentHass?.states[entity]?.attributes.device_class === 'temperature'
        );
      })
      .sort((left, right) => left.localeCompare(right, 'en'));
  }
  protected render() {
    const bindings = this.bindings();
    const images = this.config.images as CardConfig['images'] | undefined;
    return html`<div class="editor">
      <p class="hint">${this.t('editor_description')}</p>
      <label
        >${this.t('discovery')}<select
          aria-label=${this.t('discovery')}
          @change=${(event: Event) => this.selectDevice(event)}
        >
          <option value="">${this.t('select')}</option>
          ${this.fireplaces.map((device) => html`<option value=${device.id}>${device.name}</option>`)}
        </select></label
      >
      ${this.discoveryFailed ? html`<p class="hint" role="status">${this.t('discovery_failed')}</p>` : nothing}
      <label
        >${this.t('name')}<input
          aria-label=${this.t('name')}
          .value=${String(this.config.name ?? '')}
          @change=${(event: Event) => {
            const name = (event.currentTarget as HTMLInputElement).value.trim();
            this.config = { ...this.config };
            if (name) this.config.name = name;
            else delete this.config.name;
            this.emit();
          }}
      /></label>
      <div class="entities">
        ${(Object.keys(ROLES) as EntityRole[]).map(
          (role) =>
            html` <label
              >${this.t(role === 'climate' ? 'heating' : role)}<select
                aria-label=${this.t(role === 'climate' ? 'heating' : role)}
                .value=${bindings[role] ?? ''}
                @change=${(event: Event) => this.entity(role, event)}
              >
                <option value="">—</option>
                ${bindings[role] && !this.options(role).includes(bindings[role]!) ? html`<option value=${bindings[role]!} selected>${bindings[role]} (${this.t('not_available')})</option>` : nothing}
                ${this.options(role).map((entity) => html`<option value=${entity} ?selected=${bindings[role] === entity}>${this.currentHass?.states[entity]?.attributes.friendly_name ?? entity} (${entity})</option>`)}
              </select></label
            >`,
        )}
      </div>
      <p class="hint">${this.t('entity_hint')}</p>
      <p class="hint">${this.t('sensor_hint')}</p>
      ${(['show_power', 'show_image'] as const).map(
        (key) =>
          html`<label class="check"
            ><input
              type="checkbox"
              .checked=${key === 'show_image' ? this.config[key] !== false : this.config[key] === true}
              @change=${(event: Event) => {
                this.config = {
                  ...this.config,
                  [key]: (event.currentTarget as HTMLInputElement).checked,
                };
                this.emit();
              }}
            />${this.t(key)}</label
          >`,
      )}
      <p class="hint">${this.t('power_hint')}</p>
      <details>
        <summary>${this.t('show_image')}</summary>
        <div class="entities">
          ${(['off', 'flame', 'heat', 'both'] as const).map(
            (key) =>
              html`<label
                >${this.t(`image_${key}`)}<input
                  aria-label=${this.t(`image_${key}`)}
                  placeholder=${this.t('image_path')}
                  .value=${images?.[key] ?? ''}
                  @change=${(event: Event) => {
                    const value = (event.currentTarget as HTMLInputElement).value;
                    const next = { ...images };
                    if (value) next[key] = value;
                    else delete next[key];
                    this.config = { ...this.config, images: next };
                    this.emit();
                  }}
              /></label>`,
          )}
        </div>
      </details>
      ${this.error ? html`<p role="alert" class="error">${this.t('invalid_config')}: ${this.error}</p>` : nothing}
    </div>`;
  }
}
if (!customElements.get('flame-connect-card-editor'))
  customElements.define('flame-connect-card-editor', FlameConnectCardEditor);
