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
  type DetailControl,
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
      .status-icons {
        display: flex;
        gap: 8px;
        color: var(--secondary-text-color, #555);
      }
      .status-icons [data-state='on'] {
        color: var(--primary-color, #007a91);
      }
      .status-icons [data-state='unknown'] {
        color: var(--error-color, #a72020);
      }
      .view-toggle {
        display: grid;
        place-items: center;
        min-width: 44px;
      }
      ha-card[data-view='compact'] .body {
        padding-top: 8px;
        gap: 12px;
      }
      ha-card[data-view='compact'] .scene {
        width: min(100%, 220px);
        margin-inline: auto;
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
      .settings:empty {
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
      .settings {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
        gap: 14px;
        align-items: center;
      }
      .settings > div {
        min-width: 0;
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
      .settings > [data-control='target'],
      .settings > [data-control='speed'] {
        grid-column: 1 / -1;
      }
      .slider-row {
        display: flex;
        align-items: center;
        gap: 14px;
        padding: 12px;
        border: 1px solid var(--divider-color, #ddd);
        border-radius: 18px;
      }
      .slider-label {
        display: flex;
        align-items: center;
        gap: 10px;
        flex-shrink: 0;
      }
      .slider-label > svg {
        box-sizing: content-box;
        padding: 10px;
        border-radius: 50%;
        background: var(--secondary-background-color, #f2f2f2);
      }
      .slider-value {
        font-size: 1.1rem;
        font-weight: 600;
        white-space: nowrap;
      }
      input[type='range'] {
        appearance: none;
        -webkit-appearance: none;
        min-width: 0;
        width: 100%;
        height: 48px;
        min-height: 48px;
        margin: 0;
        padding: 0 9px;
        border: 0;
        border-radius: 16px;
        background: linear-gradient(
          to right,
          var(--state-climate-heat-color, #ffab56) var(--fill),
          var(--secondary-background-color, #eee) var(--fill)
        );
        cursor: pointer;
      }
      input[type='range']:disabled {
        cursor: default;
      }
      input[type='range']::-webkit-slider-runnable-track {
        height: 28px;
        background: transparent;
      }
      input[type='range']::-webkit-slider-thumb {
        appearance: none;
        -webkit-appearance: none;
        width: 5px;
        height: 28px;
        border: 0;
        border-radius: 4px;
        background: #fff;
        box-shadow: 0 0 0 1px #888;
      }
      input[type='range']::-moz-range-track {
        height: 28px;
        background: transparent;
      }
      input[type='range']::-moz-range-thumb {
        width: 5px;
        height: 28px;
        border: 0;
        border-radius: 4px;
        background: #fff;
        box-shadow: 0 0 0 1px #888;
      }
      @media (max-width: 360px) {
        header {
          padding: 14px;
        }
        .body {
          padding: 14px;
        }
        .settings {
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
  private expanded = true;

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
    this.expanded = config.initial_view === 'expanded';
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
    if (this.expanded) return 8;
    return 3 + this.config!.compact_controls.length * 2;
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
      style=${styleMap({ backgroundColor: config.image_background, backgroundImage: image, backgroundSize: customImage ? 'contain' : '200% 200%', backgroundPosition: customImage ? 'center' : positions[visual] })}
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
  private sliderFill(value: number, minimum: number, maximum: number): string {
    const fraction = maximum > minimum ? (value - minimum) / (maximum - minimum) : 0;
    return `${Math.max(0, Math.min(1, fraction)) * 100}%`;
  }
  private targetControl(state: FireplaceState) {
    return this.sliderControl(
      'target',
      state.target?.value ?? null,
      state.minimum,
      state.maximum,
      state.step,
      state.target?.unit ?? '',
    );
  }
  private speedControl(state: FireplaceState) {
    return this.sliderControl(
      'speed',
      state.speed?.value ?? null,
      state.speed?.minimum ?? null,
      state.speed?.maximum ?? null,
      state.speed?.step ?? null,
      '',
    );
  }
  private sliderControl(
    kind: 'target' | 'speed',
    confirmed: number | null,
    lower: number | null,
    upper: number | null,
    step: number | null,
    unit: string,
  ) {
    const enabled =
      confirmed !== null && lower !== null && upper !== null && step !== null && upper > lower;
    const minimum = lower ?? 0;
    const maximum = upper ?? minimum;
    const value = confirmed ?? minimum;
    const fill = this.sliderFill(value, minimum, maximum);
    const language = this.currentHass?.locale?.language ?? this.currentHass?.language ?? 'en';
    const format = (number: number) => numberText(language, number) + (unit ? ' ' + unit : '');
    const reading = confirmed === null ? '—' : format(confirmed);
    return html`<div class="slider-row">
      <label class="slider-label" for=${kind} title=${this.t(kind)}>
        ${icon(kind)}<span class="sr-only">${this.t(kind)}</span>
        <span class="slider-value ${kind}-value">${reading}</span>
      </label>
      <input
        id=${kind}
        type="range"
        aria-label=${this.t(kind)}
        aria-valuetext=${reading}
        .value=${String(value)}
        min=${minimum}
        max=${maximum}
        step=${step ?? 1}
        style=${styleMap({ '--fill': fill })}
        ?disabled=${this.disabled || !enabled}
        @input=${(event: Event) => {
          const input = event.currentTarget as HTMLInputElement;
          input.style.setProperty('--fill', this.sliderFill(input.valueAsNumber, minimum, maximum));
          input.setAttribute('aria-valuetext', format(input.valueAsNumber));
        }}
        @change=${(event: Event) => {
          const input = event.currentTarget as HTMLInputElement;
          void this.run({
            kind: kind === 'target' ? 'temperature' : 'speed',
            value: input.valueAsNumber,
          });
          input.value = String(value);
          input.style.setProperty('--fill', fill);
          input.setAttribute('aria-valuetext', reading);
        }}
      />
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
  private detailControl(state: FireplaceState, config: CardConfig, kind: DetailControl) {
    const roles = {
      ambient: 'ambient',
      target: 'climate',
      mode: 'climate',
      color: 'color',
      brightness: 'brightness',
      speed: 'speed',
    } as const;
    if (!this.isVisible(config, `show_${kind}`, roles[kind])) return nothing;
    const renderers = {
      ambient: () => this.ambientControl(state),
      target: () => this.targetControl(state),
      mode: () => this.selectControl(state, 'mode'),
      color: () => this.selectControl(state, 'color'),
      brightness: () => this.selectControl(state, 'brightness'),
      speed: () => this.speedControl(state),
    };
    return html`<div data-control=${kind}>${renderers[kind]()}</div>`;
  }
  private statusIcons(state: FireplaceState, config: CardConfig) {
    return html`<div class="status-icons" role="group" aria-label=${this.t('effect_status')}>
      ${(['flame', 'heating'] as const).map((kind) => {
        const role = kind === 'flame' ? 'flame' : 'climate';
        if (!config.entities[role]) return nothing;
        const value = state.power === false ? false : state[kind];
        let status = 'unknown';
        if (value !== null) status = value ? 'on' : 'off';
        const label = kind === 'heating' && state.mode === 'fan_only' ? 'ventilation' : kind;
        const statusIcon = label === 'ventilation' ? 'mode' : kind;
        const text =
          this.t(label) + ' · ' + this.t(status === 'unknown' ? 'not_available' : status);
        return html`<span
          role="status"
          data-status=${kind}
          data-state=${status}
          aria-label=${text}
          title=${text}
          >${icon(status === 'unknown' ? 'unavailable' : statusIcon)}</span
        >`;
      })}
    </div>`;
  }
  private changeView(): void {
    this.expanded = !this.expanded;
    this.requestUpdate();
  }
  private settings(state: FireplaceState, config: CardConfig) {
    const controls = config.control_order.filter(
      (kind) => this.expanded || config.compact_controls.includes(kind),
    );
    if (!controls.length) return nothing;
    return html`<div id="settings" class="settings">
      ${controls.map((kind) => this.detailControl(state, config, kind))}
    </div>`;
  }
  protected render() {
    const state = this.snapshot();
    const config = this.config;
    if (!state || !config) return nothing;
    return html`<ha-card
      aria-label=${state.name}
      data-view=${this.expanded ? 'expanded' : 'compact'}
    >
      <header>
        <div>
          <h2>${state.name === 'Fireplace' ? this.t('title') : state.name}</h2>
          <p class="sr-only" role="status">${this.t(this.status(state))}</p>
          ${this.statusIcons(state, config)}
        </div>
        <button
          class="view-toggle"
          type="button"
          aria-label=${this.t(this.expanded ? 'collapse' : 'expand')}
          title=${this.t(this.expanded ? 'collapse' : 'expand')}
          aria-expanded=${String(this.expanded)}
          aria-controls="card-body"
          @click=${() => this.changeView()}
        >
          ${icon(this.expanded ? 'collapse' : 'expand')}
        </button>
      </header>
      ${this.expanded || config.compact_image ? this.image(state, config) : nothing}
      <div class="body" id="card-body">
        <div class="toggles" role="group" aria-label=${this.t('controls')}>
          ${this.powerControl(state, config)}${this.isVisible(config, 'show_flame', 'flame') ? this.toggle(state, 'flame') : nothing}${this.isVisible(config, 'show_heating', 'climate') ? this.toggle(state, 'heating') : nothing}
        </div>
        ${this.settings(state, config)}
        ${this.controller?.busy ? html`<div class="feedback" role="status" title=${this.t('pending')}>${icon('pending')}<span class="sr-only">${this.t('pending')}</span></div>` : nothing}
        ${this.error ? html`<div class="feedback error" role="alert" title=${this.t(this.error)}>${icon('unavailable')}<span class="sr-only">${this.t(this.error)}</span></div>` : nothing}
      </div>
    </ha-card>`;
  }
}
