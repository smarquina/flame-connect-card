import { html, css, type TemplateResult } from 'lit';
import type { FireplaceState } from '../domain/model';
import { effectiveEffect } from '../domain/state';
import { icon } from './icons';

export function renderChip(
  state: FireplaceState,
  name: string,
  status: string,
  expandLabel: string,
  expand: () => void,
  actions: TemplateResult,
) {
  const flame = effectiveEffect(state, 'flame');
  const heat = effectiveEffect(state, 'heating');
  const active = flame === true || heat === true;
  const unknown = flame === null || heat === null;
  return html`<div class="chip">
    <button class="chip-summary" type="button" aria-expanded="false" @click=${expand}>
      <span class="sr-only">${expandLabel}: </span>
      <span class="chip-icon" data-active=${String(active)}>${icon('fireplace')}</span>
      <span class="chip-text"><strong>${name}</strong> <span>${status}</span></span>
      ${unknown ? html`<span class="chip-warning">${icon('unavailable')}</span>` : ''}
    </button>
    ${actions}
  </div>`;
}
export const chipStyles = css`
  .chip {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px;
  }
  .chip-summary {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 12px;
    border: 0;
    background: transparent;
    text-align: start;
    padding: 4px;
  }
  .chip-icon {
    display: grid;
    place-items: center;
    flex-shrink: 0;
    width: 48px;
    height: 48px;
    border-radius: 50%;
    background: var(--secondary-background-color, #f2f2f2);
    color: var(--secondary-text-color, #777);
  }
  .chip-icon[data-active='true'] {
    color: var(--state-climate-heat-color, #e87500);
    background: var(--secondary-background-color, #f2f2f2);
  }
  .chip-text {
    display: grid;
    min-width: 0;
    gap: 4px;
  }
  .chip-text strong,
  .chip-text > span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .chip-text > span {
    font-size: 0.85rem;
    color: var(--secondary-text-color, #555);
  }
  .chip .toggles {
    flex-shrink: 0;
    gap: 6px;
  }
  .chip .toggles button {
    width: 44px;
    height: 44px;
    border-radius: 12px;
  }
  .chip .toggles button[aria-pressed='true'] {
    color: var(--state-climate-heat-color, #e87500);
  }
  .chip-warning {
    color: var(--error-color, #a72020);
  }
  .chip-feedback:empty {
    display: none;
  }
`;
