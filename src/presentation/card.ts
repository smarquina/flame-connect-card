import { LitElement, css, html, nothing } from 'lit';
import { styleMap } from 'lit/directives/style-map.js';
import scene from '../assets/fireplaces.png?inline';
import { parseConfig } from '../configuration/config';
import {
  CARD_TYPE,
  ControlError,
  type CardConfig,
  type Command,
  type FireplaceState,
  type EntityRole,
  type VisibilityOption,
} from '../domain/model';
import { visualState, visibleModes } from '../domain/state';
import { mapState } from '../adapters/home-assistant/state-mapper';
import type { HomeAssistant } from '../adapters/home-assistant/types';
import { localize, numberText } from '../localization/localize';
import { composeController } from '../composition';
import type { FireplaceController } from '../application/controller';
import { sharedStyles } from './styles';
import { icon } from './icons';
import './editor';

export class FlameConnectCard extends LitElement {
  static readonly properties = { preview: { type: Boolean } };
  static readonly styles = [
    sharedStyles,
    css`
      ha-card {
        display: block;
        overflow: hidden;
        border: 1px solid var(--ha-card-border-color, var(--divider-color, #ddd));
        border-radius: var(--ha-card-border-radius, 16px);
        background: var(--ha-card-background, var(--card-background-color, #fff));
      }
      header {
        padding: 18px 20px 12px;
        display: flex;
        gap: 12px;
        justify-content: space-between;
        align-items: center;
      }
      h2 {
        font-size: 1.15rem;
        margin: 0 0 4px;
        font-weight: 600;
      }
      .scene {
        aspect-ratio: 2.05;
        background-color: #000;
        background-size: 200% 200%;
        background-repeat: no-repeat;
      }
      .scene.unknown {
        background-image: none !important;
        display: grid;
        place-items: center;
        color: #ddd;
      }
      .body {
        display: grid;
        gap: 18px;
        padding: 18px 20px;
      }
      .toggles:empty,
      .temperatures:empty,
      .options:empty {
        display: none;
      }
      .toggles {
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
        justify-content: center;
      }
      .toggles button {
        width: 56px;
        height: 56px;
        display: grid;
        place-items: center;
        padding: 0;
        border: none;
        border-radius: 16px;
        background: var(--secondary-background-color, #f2f2f2);
      }
      .toggles button[aria-pressed='true'] {
        color: var(--primary-color, #007a91);
        box-shadow: inset 0 0 0 2px currentColor;
      }
      svg {
        width: 24px;
        height: 24px;
        fill: none;
        stroke: currentColor;
        stroke-width: 1.8;
        stroke-linecap: round;
        stroke-linejoin: round;
        flex-shrink: 0;
      }
      .control-label {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .feedback {
        display: flex;
        justify-content: center;
      }
      .sr-only {
        position: absolute;
        width: 1px;
        height: 1px;
        padding: 0;
        margin: -1px;
        overflow: hidden;
        clip-path: inset(50%);
        white-space: nowrap;
        border: 0;
      }
      .temperatures {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
        gap: 14px;
      }
      .reading-label {
        display: inline-flex;
        color: var(--secondary-text-color, #555);
      }
      .reading {
        font-size: 1.7rem;
        font-weight: 600;
        margin-top: 6px;
      }
      .stepper {
        display: flex;
        align-items: center;
        gap: 6px;
        margin-top: 6px;
      }
      .stepper input {
        min-width: 0;
        text-align: center;
      }
      .stepper button {
        padding: 8px 13px;
        font-size: 1.2rem;
      }
      .options {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
        gap: 12px;
      }
      @media (max-width: 360px) {
        header {
          padding: 14px;
        }
        .body {
          padding: 14px;
        }
        .temperatures {
          grid-template-columns: 1fr;
        }
      }
    `,
  ];
  preview = false;
  private config?: CardConfig;
  private currentHass?: HomeAssistant;
  private controller?: FireplaceController;
  private error = '';
  private generation = 0;

  set hass(value: HomeAssistant) {
    this.currentHass = value;
    if (this.config) this.controller?.update(mapState(this.config, value));
    this.requestUpdate();
  }
  setConfig(value: unknown): void {
    const config = parseConfig(value);
    this.generation++;
    this.controller?.dispose();
    this.config = config;
    this.error = '';
    this.controller = composeController(
      () => this.currentHass,
      config.entities,
      () => this.requestUpdate(),
    );
    this.requestUpdate();
  }
  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.generation++;
    this.controller?.dispose();
  }
  getCardSize(): number {
    return 8;
  }
  getGridOptions() {
    return { columns: 12, rows: 'auto', min_columns: 6 };
  }
  static getConfigElement(): HTMLElement {
    return document.createElement('flame-connect-card-editor');
  }
  static getStubConfig() {
    return { type: CARD_TYPE, entities: {} };
  }
  private t(key: string): string {
    return localize(this.currentHass?.locale?.language ?? this.currentHass?.language ?? 'en', key);
  }
  private get disabled(): boolean {
    return this.preview || this.controller?.busy === true;
  }
  private async run(command: Command): Promise<void> {
    if (!this.isConnected || this.disabled || !this.config || !this.currentHass || !this.controller)
      return;
    const generation = this.generation;
    this.error = '';
    try {
      await this.controller.execute(mapState(this.config, this.currentHass), command);
    } catch (error) {
      if (generation === this.generation)
        this.error = error instanceof ControlError ? error.code : 'failed';
    }
    this.requestUpdate();
  }
  private choose(
    kind: 'mode' | 'color' | 'brightness',
    event: Event,
    confirmed: string | null,
  ): void {
    const input = event.currentTarget as HTMLSelectElement;
    const value = input.value;
    void this.run({ kind, value });
    // The displayed selection follows confirmed state, not native optimistic selection.
    input.value = confirmed ?? '';
  }
  private snapshot(): FireplaceState | undefined {
    return this.config && this.currentHass ? mapState(this.config, this.currentHass) : undefined;
  }
  private temperature(value: number): void {
    void this.run({ kind: 'temperature', value });
  }
  private selectControl(state: FireplaceState, kind: 'mode' | 'color' | 'brightness') {
    const options = kind === 'mode' ? visibleModes(state) : state[kind].options;
    const current = kind === 'mode' ? state.mode : state[kind].value;
    const enabled = kind === 'mode' ? state.climateAvailable : state[kind].available;
    const placeholder = current ? this.t(current) : this.t('select');
    return html`<label class="control-label" title=${this.t(kind)}
      >${icon(kind)}<span class="sr-only">${this.t(kind)}</span
      ><select
        aria-label=${this.t(kind)}
        .value=${current ?? ''}
        ?disabled=${this.disabled || !enabled}
        @change=${(event: Event) => this.choose(kind, event, current)}
      >
        ${!current || !options.includes(current) ? html`<option value=${current ?? ''}>${placeholder}</option>` : nothing}
        ${options.map((option) => html`<option value=${option} ?selected=${current === option}>${this.t(option)}</option>`)}
      </select></label
    >`;
  }
  private status(state: FireplaceState): string {
    if (state.power === false) return 'standby_label';
    const visual = visualState(state);
    if (visual === 'unknown') return 'state_unknown';
    if (state.heating && state.mode === 'fan_only') return 'fan_active';
    return `state_${visual}`;
  }
  private image(state: FireplaceState, config: CardConfig) {
    if (!config.show_image) return nothing;
    const visual = visualState(state);
    const customImage = visual !== 'unknown' ? config.images[visual] : undefined;
    const positions = {
      off: '0% 0%',
      flame: '100% 0%',
      heat: '0% 100%',
      both: '100% 100%',
      unknown: '0% 0%',
    };
    const label = this.t(this.status(state)) + '. ' + this.t('image_hint');
    const image = 'url(' + JSON.stringify(customImage ?? scene) + ')';
    const unknown = visual === 'unknown';
    return html`<div
      class="scene ${unknown ? 'unknown' : ''}"
      role="img"
      aria-label=${label}
      style=${styleMap({ backgroundImage: image, backgroundSize: customImage ? 'contain' : '200% 200%', backgroundPosition: customImage ? 'center' : positions[visual] })}
    >
      ${unknown ? icon('unavailable') : nothing}
    </div>`;
  }
  private toggle(state: FireplaceState, kind: 'flame' | 'heating') {
    const value = state[kind];
    const unavailable = value === null;
    const status = value ? 'on' : 'off';
    const label = kind === 'heating' && state.mode === 'fan_only' ? 'ventilation' : kind;
    const standby = kind === 'flame' && state.power === false && !value;
    return html`<button
      aria-label=${this.t(label) + ' · ' + this.t(unavailable ? 'not_available' : status)}
      title=${this.t(label) + ' · ' + this.t(unavailable ? 'not_available' : status)}
      aria-pressed=${String(value === true)}
      ?disabled=${this.disabled || unavailable || standby}
      @click=${() => this.run({ kind, value: !value })}
    >
      ${icon(label === 'ventilation' ? 'mode' : kind)}
    </button>`;
  }
  private targetControl(state: FireplaceState) {
    const canTarget =
      state.target !== null &&
      state.minimum !== null &&
      state.maximum !== null &&
      state.step !== null;
    const value = state.target?.value;
    return html`<div>
      <label class="control-label" for="target" title=${this.t('target')}>
        ${icon('target')}<span class="sr-only">${this.t('target')}</span>${state.target?.unit ?? ''}
      </label>
      <div class="stepper">
        <button
          aria-label=${this.t('decrease')}
          ?disabled=${this.disabled || !canTarget || value! <= state.minimum!}
          @click=${() => this.temperature(Number((value! - state.step!).toFixed(3)))}
        >
          −
        </button>
        <input
          id="target"
          type="number"
          aria-label=${this.t('target')}
          .value=${value === undefined ? '' : String(value)}
          min=${state.minimum ?? nothing}
          max=${state.maximum ?? nothing}
          step=${state.step ?? nothing}
          ?disabled=${this.disabled || !canTarget}
          @change=${(event: Event) => {
            const input = event.currentTarget as HTMLInputElement;
            this.temperature(input.valueAsNumber);
            input.value = value === undefined ? '' : String(value);
          }}
        />
        <button
          aria-label=${this.t('increase')}
          ?disabled=${this.disabled || !canTarget || value! >= state.maximum!}
          @click=${() => this.temperature(Number((value! + state.step!).toFixed(3)))}
        >
          +
        </button>
      </div>
    </div>`;
  }
  private ambientControl(state: FireplaceState) {
    let reading = '—';
    if (state.ambient) {
      const language = this.currentHass?.locale?.language ?? this.currentHass?.language ?? 'en';
      reading = numberText(language, state.ambient.value) + ' ' + state.ambient.unit;
    }
    return html`<div>
      <div class="reading-label" title=${this.t('ambient')}>
        ${icon('ambient')}<span class="sr-only">${this.t('ambient')}</span>
      </div>
      <div class="reading">${reading}</div>
    </div>`;
  }
  private powerControl(state: FireplaceState, config: CardConfig) {
    if (!config.show_power || !config.entities.power) return nothing;
    return html`<button
      aria-label=${this.t(state.power ? 'power_off' : 'power_on')}
      aria-pressed=${String(state.power === true)}
      title=${this.t(state.power ? 'power_off' : 'power_on')}
      ?disabled=${this.disabled || state.power === null}
      @click=${() => this.run({ kind: 'power', value: !state.power })}
    >
      ${icon(state.power ? 'power_off' : 'power_on')}
    </button>`;
  }
  private isVisible(config: CardConfig, option: VisibilityOption, role: EntityRole): boolean {
    return config[option] && Boolean(config.entities[role]);
  }
  protected render() {
    const state = this.snapshot();
    const config = this.config;
    if (!state || !config) return nothing;
    return html`<ha-card aria-label=${state.name}>
      <header>
        <div>
          <h2>${state.name === 'Fireplace' ? this.t('title') : state.name}</h2>
          <p class="sr-only" role="status">${this.t(this.status(state))}</p>
        </div>
      </header>
      ${this.image(state, config)}
      <div class="body">
        <div class="toggles" role="group" aria-label=${this.t('controls')}>
          ${this.powerControl(state, config)}${this.isVisible(config, 'show_flame', 'flame') ? this.toggle(state, 'flame') : nothing}${this.isVisible(config, 'show_heating', 'climate') ? this.toggle(state, 'heating') : nothing}
        </div>
        <div class="temperatures">
          ${this.isVisible(config, 'show_ambient', 'ambient') ? this.ambientControl(state) : nothing}${this.isVisible(config, 'show_target', 'climate') ? this.targetControl(state) : nothing}
        </div>
        <div class="options">
          ${this.isVisible(config, 'show_mode', 'climate') ? this.selectControl(state, 'mode') : nothing}${this.isVisible(config, 'show_color', 'color') ? this.selectControl(state, 'color') : nothing}${this.isVisible(config, 'show_brightness', 'brightness') ? this.selectControl(state, 'brightness') : nothing}
        </div>
        ${this.controller?.busy ? html`<div class="feedback" role="status" title=${this.t('pending')}>${icon('pending')}<span class="sr-only">${this.t('pending')}</span></div>` : nothing}
        ${this.error ? html`<div class="feedback error" role="alert" title=${this.t(this.error)}>${icon('unavailable')}<span class="sr-only">${this.t(this.error)}</span></div>` : nothing}
      </div>
    </ha-card>`;
  }
}
