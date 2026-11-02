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
} from '../domain/model';
import { visualState, visibleModes } from '../domain/state';
import { mapState } from '../adapters/home-assistant/state-mapper';
import type { HomeAssistant } from '../adapters/home-assistant/types';
import { localize, numberText } from '../localization/localize';
import { composeController } from '../composition';
import type { FireplaceController } from '../application/controller';
import { sharedStyles } from './styles';
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
      .status {
        margin: 0;
        font-size: 0.85rem;
        color: var(--secondary-text-color, #555);
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
      .toggles {
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
      }
      .toggles button {
        flex: 1;
      }
      .temperatures {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
        gap: 14px;
      }
      .reading-label {
        font-size: 0.85rem;
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
      .message {
        margin: 0;
        font-size: 0.9rem;
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
      () => {
        if (!this.currentHass) throw new ControlError('unavailable');
        return this.currentHass;
      },
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
    if (this.disabled || !this.config || !this.currentHass || !this.controller) return;
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
  private choose(kind: 'mode' | 'color' | 'brightness', event: Event): void {
    const input = event.currentTarget as HTMLSelectElement;
    const value = input.value;
    void this.run({ kind, value });
    // The displayed selection follows confirmed state, not native optimistic selection.
    input.value =
      kind === 'mode' ? (this.snapshot()?.mode ?? '') : (this.snapshot()?.[kind].value ?? '');
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
    return html`<label
      >${this.t(kind)}<select
        aria-label=${this.t(kind)}
        .value=${current ?? ''}
        ?disabled=${this.disabled || !enabled}
        @change=${(event: Event) => this.choose(kind, event)}
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
      ${unknown ? this.t('not_available') : nothing}
    </div>`;
  }
  private toggle(state: FireplaceState, kind: 'flame' | 'heating') {
    const value = state[kind];
    const unavailable = value === null;
    const status = value ? 'on' : 'off';
    const label = kind === 'heating' && state.mode === 'fan_only' ? 'ventilation' : kind;
    const standby = kind === 'flame' && state.power === false && !value;
    return html`<button
      aria-pressed=${String(value === true)}
      ?disabled=${this.disabled || unavailable || standby}
      @click=${() => this.run({ kind, value: !value })}
    >
      ${this.t(label)} · ${this.t(unavailable ? 'not_available' : status)}
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
      <label for="target">${this.t('target')} ${state.target?.unit ?? ''}</label>
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
    let reading = this.t('not_available');
    if (state.ambient) {
      const language = this.currentHass?.locale?.language ?? this.currentHass?.language ?? 'en';
      reading = numberText(language, state.ambient.value) + ' ' + state.ambient.unit;
    }
    return html`<div>
      <div class="reading-label">${this.t('ambient')}</div>
      <div class="reading">${reading}</div>
    </div>`;
  }
  private powerControl(state: FireplaceState, config: CardConfig) {
    if (!config.show_power || !config.entities.power) return nothing;
    return html`<button
      aria-label=${this.t('power')}
      aria-pressed=${String(state.power === true)}
      title=${this.t('power_hint')}
      ?disabled=${this.disabled || state.power === null}
      @click=${() => this.run({ kind: 'power', value: !state.power })}
    >
      ⏻
    </button>`;
  }
  protected render() {
    const state = this.snapshot();
    const config = this.config;
    if (!state || !config) return nothing;
    return html`<ha-card aria-label=${state.name}>
      <header>
        <div>
          <h2>${state.name === 'Fireplace' ? this.t('title') : state.name}</h2>
          <p class="status" role="status">${this.t(this.status(state))}</p>
        </div>
        ${this.powerControl(state, config)}
      </header>
      ${this.image(state, config)}
      <div class="body">
        <div class="toggles">
          ${config.entities.flame ? this.toggle(state, 'flame') : nothing}
          ${config.entities.climate ? this.toggle(state, 'heating') : nothing}
        </div>
        <div class="temperatures">
          ${config.entities.ambient ? this.ambientControl(state) : nothing}
          ${config.entities.climate ? this.targetControl(state) : nothing}
        </div>
        <div class="options">
          ${config.entities.climate ? this.selectControl(state, 'mode') : nothing}
          ${config.entities.color ? this.selectControl(state, 'color') : nothing}
          ${config.entities.brightness ? this.selectControl(state, 'brightness') : nothing}
        </div>
        ${this.preview ? html`<p class="hint">${this.t('preview')}</p>` : nothing}
        ${config.entities.ambient ? html`<p class="hint">${this.t('sensor_hint')}</p>` : nothing}
        ${state.power === false ? html`<p class="hint">${this.t('standby')}</p>` : nothing}
        ${this.controller?.busy ? html`<p class="message" role="status">${this.t('pending')}</p>` : nothing}
        ${this.error ? html`<p class="error" role="alert">${this.t(this.error)}</p>` : nothing}
      </div>
    </ha-card>`;
  }
}
