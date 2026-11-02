# Installation, updates and removal

Install [Flame Connect HA](https://github.com/smarquina/Flame-Connect-HA) first and check its entities under the fireplace device. This card is a separate dashboard resource. It does not authenticate the account or add a device under Devices & Services.

## HACS / Marketplace

1. Add `https://github.com/smarquina/flame-connect-card` as a custom Dashboard repository.
2. Download the desired published version. Enable pre-release versions for beta packages.
3. Refresh the frontend and verify the JavaScript module resource is registered.
4. Edit your dashboard, add Flame Connect Card, and select the fireplace or its entities.
5. Optionally select a room-temperature sensor and enable the whole-device power button.

Depending on your HA/HACS version, the repository category may be displayed as Dashboard; its technical identifier is `plugin`. Use the installed resource path shown by HACS if it differs from the example in the README.

## Manual resource

Place the released `flame-connect-card.js` in `config/www/`. In the dashboard Resources settings, register `/local/flame-connect-card.js?v=0.1.0-beta.1` with type JavaScript module. Advanced Mode may be needed to access Resources. The bundle contains Lit and all four fireplace states; no additional image downloads are required for the default illustration.

## Updates

Use HACS to update the resource and refresh all open frontend clients, including Companion apps. For manually registered resources, replace the file and update its version query. Do not register the same card twice at different URLs. A backend restart is not normally needed for a JavaScript resource update.

Before downgrading, check schema compatibility in the release notes. Unsupported configuration schema versions produce an explicit error rather than silently changing behavior.

## Removal

Remove card instances from dashboards, uninstall the repository through HACS, and remove any manually registered resource or custom image files that are no longer used. Removing the card does not remove the backend integration, fireplace entities or account configuration.

## Compatibility

The intended HA baseline is 2026.10.4. Read each release's notes for actual tested versions. Chromium, Firefox and WebKit simulator tests check browser rendering and interactions; real HA and fireplace validation must be reported separately. No local LAN or Bluetooth communication is implemented by this card.
