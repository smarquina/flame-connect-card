import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import type { FlameConnectCard } from '../../src/presentation/card';
import { CARD_TYPE } from '../../src/domain/model';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Living room', exact: true })).toBeVisible();
});

test('compiled HACS module loads with embedded artwork and sends actions', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/tests/fixtures/production.html');
  await expect(page.getByRole('heading', { name: 'Living room', exact: true })).toBeVisible();
  await expect(page.getByRole('img')).toHaveCSS('background-image', /data:image\/png;base64/);
  await page.getByRole('button', { name: 'Flame · On', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Flame · Off', exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test('renders the four supplied fireplace states and a neutral unknown state', async ({
  page,
}, info) => {
  const scene = page.getByRole('img');
  for (const [heat, flame, position] of [
    [false, false, '0% 0%'],
    [false, true, '100% 0%'],
    [true, false, '0% 100%'],
    [true, true, '100% 100%'],
  ] as const) {
    await page.evaluate(
      ({ heat, flame }) => {
        window.demo.hass.states['climate.fire_heating']!.state = heat ? 'heat' : 'off';
        window.demo.hass.states['light.fire_flame']!.state = flame ? 'on' : 'off';
        window.demo.update();
      },
      { heat, flame },
    );
    await expect(scene).toHaveCSS('background-position', position);
    await expect(scene).toHaveCSS('background-image', /data:image\/png;base64/);
  }
  await page
    .locator('flame-connect-card')
    .screenshot({ path: `test-results/card-${info.project.name}.png` });
  await page.evaluate(() => {
    window.demo.hass.states['light.fire_flame']!.state = 'unavailable';
    window.demo.update();
  });
  await expect(scene).toHaveAccessibleName(/State unavailable/);
  await expect(scene.locator('svg')).toBeVisible();
  await expect(scene).toHaveCSS('background-image', 'none');
  expect(await page.evaluate(() => window.demo.calls)).toHaveLength(0);
});

test('controls flame and heating independently and reflects external updates', async ({ page }) => {
  await page.getByRole('button', { name: 'Flame · On', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Flame · Off', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Heating · On', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Heating · On', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Heating · Off', exact: true })).toBeVisible();
  const calls = await page.evaluate(() => window.demo.calls);
  expect(calls).toEqual([
    { domain: 'light', service: 'turn_off', data: {}, target: { entity_id: 'light.fire_flame' } },
    {
      domain: 'climate',
      service: 'set_hvac_mode',
      data: { hvac_mode: 'off' },
      target: { entity_id: 'climate.fire_heating' },
    },
  ]);
  await page.evaluate(() => {
    window.demo.hass.states['light.fire_flame']!.state = 'on';
    window.demo.update();
  });
  await expect(page.getByRole('button', { name: 'Flame · On', exact: true })).toBeVisible();
});

test('keeps room and target temperatures independent and validates bounds', async ({ page }) => {
  await expect(page.getByText('19.5 °C', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Increase target temperature' }).click();
  await expect(
    page.getByRole('spinbutton', { name: 'Target temperature', exact: true }),
  ).toHaveValue('22.5');
  await expect(page.getByText('19.5 °C', { exact: true })).toBeVisible();
  await page.getByRole('spinbutton', { name: 'Target temperature', exact: true }).fill('99');
  await page.getByRole('spinbutton', { name: 'Target temperature', exact: true }).press('Tab');
  await expect(page.getByRole('alert')).toContainText('supported value');
  expect(await page.evaluate(() => window.demo.calls)).toHaveLength(1);
});

test('reads preset/color/brightness options and sends supported discrete selections', async ({
  page,
}) => {
  await page.getByRole('combobox', { name: 'Mode', exact: true }).selectOption('fan_only');
  await expect(page.getByRole('button', { name: 'Ventilation · On' })).toBeVisible();
  await expect(page.getByRole('img')).toHaveCSS('background-position', '100% 0%');
  await page.getByRole('combobox', { name: 'Flame color' }).selectOption('blue');
  await page.getByRole('combobox', { name: 'Flame brightness' }).selectOption('flicker_low');
  await expect(page.getByRole('combobox', { name: 'Flame color' })).toHaveValue('blue');
  await expect(page.getByRole('combobox', { name: 'Flame brightness' })).toHaveValue('flicker_low');
  await expect(
    page.getByRole('combobox', { name: 'Mode', exact: true }).locator('option'),
  ).toHaveCount(3);
});

test('shows English and Spanish according to Home Assistant language', async ({ page }) => {
  await page.evaluate(() => {
    window.demo.hass.language = 'es';
    window.demo.update();
  });
  await expect(page.getByRole('button', { name: 'Llama · Encendido' })).toBeVisible();
  await expect(
    page.getByRole('spinbutton', { name: 'Temperatura objetivo', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Brillo de llama' })).toBeVisible();
  await expect(page.getByText('19,5 °C', { exact: true })).toBeVisible();
  await page.evaluate(() => {
    window.demo.hass.language = 'en';
    window.demo.update();
  });
  await expect(page.getByRole('button', { name: 'Flame · On', exact: true })).toBeVisible();
});

test('does not equate service acceptance with device confirmation or replay commands', async ({
  page,
}) => {
  await page.evaluate(() => {
    window.demo.defer = true;
  });
  await page.getByRole('button', { name: 'Flame · On', exact: true }).click();
  await expect(page.locator('.feedback')).toBeVisible();
  await expect(page.locator('.feedback')).toHaveAttribute('title', 'Waiting for confirmed state…');
  await expect(page.getByRole('button', { name: 'Flame · On', exact: true })).toBeDisabled();
  await page.evaluate(() => {
    window.demo.hass.states['light.fire_flame']!.state = 'off';
    window.demo.update();
  });
  await expect(page.getByText('Waiting for confirmed state…')).toHaveCount(0);
  expect(await page.evaluate(() => window.demo.calls)).toHaveLength(1);
});

test('service errors are redacted and do not change confirmed state', async ({ page }) => {
  await page.evaluate(() => {
    window.demo.fail = true;
  });
  await page.getByRole('button', { name: 'Flame · On', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('The action failed');
  await expect(page.getByRole('button', { name: 'Flame · On', exact: true })).toBeEnabled();
  await expect(page.getByRole('alert')).not.toContainText('Synthetic');
});

test('standby never implicitly enables power when clicking a flame control', async ({ page }) => {
  await page.evaluate(() => {
    window.demo.hass.states['switch.fire_power']!.state = 'off';
    window.demo.hass.states['light.fire_flame']!.state = 'off';
    window.demo.update();
  });
  await expect(page.getByRole('button', { name: 'Flame · Off', exact: true })).toBeDisabled();
  await expect(page.getByRole('img')).toHaveAccessibleName(/Standby/);
  await expect(page.getByRole('button', { name: 'Turn fireplace on', exact: true })).toBeVisible();
  expect(await page.evaluate(() => window.demo.calls)).toHaveLength(0);
});

test('preview sends no commands and multiple cards share confirmed updates', async ({ page }) => {
  await page.evaluate(() => {
    const card = window.demo.add('Second fireplace');
    card.preview = true;
    card.requestUpdate();
  });
  const second = page.locator('flame-connect-card').nth(1);
  await expect(second.getByRole('button', { name: 'Flame · On', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Flame · On', exact: true }).first().click();
  await expect(second.getByRole('button', { name: 'Flame · Off', exact: true })).toBeVisible();
});

test('editor supports registry discovery, external sensors and safe image configuration', async ({
  page,
}) => {
  await page.evaluate(async () => {
    const ctor = customElements.get('flame-connect-card') as unknown as {
      getConfigElement(): Promise<HTMLElement>;
    };
    const editor = (await ctor.getConfigElement()) as HTMLElement & {
      hass: typeof window.demo.hass;
      setConfig(config: unknown): void;
    };
    editor.setConfig({ type: 'custom:flame-connect-card', entities: {} });
    editor.hass = window.demo.hass;
    document.body.append(editor);
    editor.addEventListener('config-changed', (event) => {
      const card = document.querySelector('flame-connect-card') as FlameConnectCard;
      card.setConfig((event as CustomEvent).detail.config);
      card.hass = window.demo.hass;
    });
  });
  const editor = page.locator('flame-connect-card-editor');
  await editor
    .getByRole('combobox', { name: 'Choose a Flame Connect fireplace' })
    .selectOption('fire-device');
  await editor
    .getByRole('combobox', { name: 'Room temperature', exact: true })
    .selectOption('sensor.room_temperature');
  await editor.getByRole('textbox', { name: 'Card title' }).fill('My fireplace');
  await editor.getByRole('textbox', { name: 'Card title' }).press('Tab');
  await expect(page.getByRole('heading', { name: 'My fireplace' })).toBeVisible();
  await editor.locator('summary').click();
  await editor
    .getByRole('textbox', { name: 'Image: effects off', exact: true })
    .fill('https://untrusted.test/test.png');
  await editor.getByRole('textbox', { name: 'Image: effects off', exact: true }).press('Tab');
  await expect(editor.getByRole('alert')).toContainText('same-origin');
});

test('supports keyboard navigation, responsive layout and accessible controls', async ({
  page,
}) => {
  const results = await new AxeBuilder({ page }).include('flame-connect-card').analyze();
  expect(results.violations).toEqual([]);
  await page.getByRole('button', { name: 'Flame · On', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Flame · Off', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});

test('renders untrusted names as text and uses only safe custom images', async ({ page }) => {
  await page.evaluate((type) => {
    const card = document.querySelector('flame-connect-card') as FlameConnectCard;
    card.setConfig({
      type,
      name: '<img src=x onerror=alert(1)>',
      entities: { flame: 'light.fire_flame' },
      images: { flame: '/src/assets/fireplaces.png' },
    });
    card.hass = window.demo.hass;
  }, CARD_TYPE);
  await expect(page.getByRole('heading', { name: '<img src=x onerror=alert(1)>' })).toBeVisible();
  expect(await page.locator('flame-connect-card').locator('img').count()).toBe(0);
  await expect(page.getByRole('img')).toHaveCSS('background-size', 'contain');
});

test('supports the dark theme without losing contrast or keyboard controls', async ({ page }) => {
  await page.evaluate(() => {
    const card = document.querySelector('flame-connect-card') as HTMLElement;
    const variables = {
      '--primary-text-color': '#f4f4f4',
      '--secondary-text-color': '#ccc',
      '--card-background-color': '#202020',
      '--ha-card-background': '#202020',
      '--divider-color': '#999',
      '--primary-color': '#9b4215',
      '--text-primary-color': '#fff',
    };
    for (const [name, value] of Object.entries(variables)) card.style.setProperty(name, value);
  });
  expect(
    (await new AxeBuilder({ page }).include('flame-connect-card').analyze()).violations,
  ).toEqual([]);
  await expect(
    page.getByRole('spinbutton', { name: 'Target temperature', exact: true }),
  ).toBeEnabled();
});

test('groups icon-only actions and switches the power icon between start and shutdown', async ({
  page,
}, info) => {
  const group = page.getByRole('group', { name: 'Fireplace controls' });
  await expect(group.getByRole('button')).toHaveCount(3);
  const shutdown = group.getByRole('button', { name: 'Turn fireplace off', exact: true });
  const shutdownPath = await shutdown.locator('path').getAttribute('d');
  for (const control of await group.getByRole('button').all()) {
    expect((await control.innerText()).trim()).toBe('');
    await expect(control.locator('svg')).toBeVisible();
    const box = await control.boundingBox();
    expect(box!.width).toBeGreaterThanOrEqual(44);
    expect(box!.height).toBeGreaterThanOrEqual(44);
  }
  await shutdown.click();
  const start = group.getByRole('button', { name: 'Turn fireplace on', exact: true });
  await expect(start).toBeEnabled();
  expect(await start.locator('path').getAttribute('d')).not.toBe(shutdownPath);
  await start.click();
  await expect(shutdown).toBeEnabled();
  expect(await page.evaluate(() => window.demo.calls)).toEqual([
    { domain: 'switch', service: 'turn_off', data: {}, target: { entity_id: 'switch.fire_power' } },
    { domain: 'switch', service: 'turn_on', data: {}, target: { entity_id: 'switch.fire_power' } },
  ]);
  await expect(page.locator('flame-connect-card .hint')).toHaveCount(0);
  await page
    .locator('flame-connect-card')
    .screenshot({ path: `test-results/icon-controls-${info.project.name}.png` });
});

test('visual editor hides the target independently while heating remains controllable', async ({
  page,
}) => {
  await page.evaluate((type) => {
    const ctor = customElements.get('flame-connect-card') as unknown as {
      getConfigElement(): HTMLElement;
    };
    const editor = ctor.getConfigElement() as HTMLElement & {
      hass: typeof window.demo.hass;
      setConfig(config: unknown): void;
    };
    editor.setConfig({
      type,
      entities: {
        climate: 'climate.fire_heating',
        flame: 'light.fire_flame',
        ambient: 'sensor.room_temperature',
      },
    });
    editor.hass = window.demo.hass;
    editor.addEventListener('config-changed', (event) => {
      const card = document.querySelector('flame-connect-card') as FlameConnectCard;
      card.setConfig((event as CustomEvent).detail.config);
      card.hass = window.demo.hass;
    });
    document.body.append(editor);
  }, CARD_TYPE);
  const editor = page.locator('flame-connect-card-editor');
  await editor.getByRole('checkbox', { name: 'Show target temperature', exact: true }).uncheck();
  await expect(
    page.getByRole('spinbutton', { name: 'Target temperature', exact: true }),
  ).toHaveCount(0);
  await expect(page.getByText('19.5 °C', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Heating · On', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Heating · Off', exact: true })).toBeVisible();
  await editor.getByRole('checkbox', { name: 'Show room temperature', exact: true }).uncheck();
  await expect(page.locator('flame-connect-card .temperatures')).toBeHidden();
  await editor.getByRole('checkbox', { name: 'Show heating mode', exact: true }).uncheck();
  await expect(page.locator('flame-connect-card .options')).toBeHidden();
  await editor.getByRole('checkbox', { name: 'Show flame control', exact: true }).uncheck();
  await editor.getByRole('checkbox', { name: 'Show heating control', exact: true }).uncheck();
  await expect(page.locator('flame-connect-card .toggles')).toBeHidden();
  await editor.getByRole('checkbox', { name: 'Show target temperature', exact: true }).check();
  await expect(
    page.getByRole('spinbutton', { name: 'Target temperature', exact: true }),
  ).toHaveValue('22');
  expect(await page.evaluate(() => window.demo.calls)).toHaveLength(1);
});
