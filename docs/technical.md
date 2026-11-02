# Technical reference

## Runtime

`flame-connect-card.js` is an ES2022 module registering `flame-connect-card` and its visual editor. The card implements configuration, HA state updates, card sizing and sections-grid sizing. It uses Lit with Shadow DOM and HA theme variables. Its dependency on Flame Connect HA is through entity contracts; no Python code or cloud SDK is bundled.

## Boundaries

- `domain`: immutable state types, availability-aware commands, visual-state selection and temperature conversion. No browser or HA imports.
- `application`: command validation and confirmation lifecycle, depending on an action port.
- `adapters/home-assistant`: registry discovery, state mapping and exact service calls targeting entity IDs.
- `presentation`: Lit card, visual editor, styles and localization.
- `composition`: constructs the application controller and HA action adapter.

The architecture check rejects outward imports from the core. Coverage checks require 100% of lines, statements, branches and functions across the TypeScript source and validation scripts, without coverage-ignore annotations. Browser tests separately verify the complete rendered interface and visual editor. SonarQube consumes the LCOV report.

## Actions and state

| Operation                  | Service                              | Data                      |
| -------------------------- | ------------------------------------ | ------------------------- |
| Whole-device on/off        | `switch.turn_on` / `switch.turn_off` | None                      |
| Flame on/off               | `light.turn_on` / `light.turn_off`   | None                      |
| Heating/ventilation on/off | `climate.set_hvac_mode`              | `hvac_mode: heat` / `off` |
| Target                     | `climate.set_temperature`            | `temperature`             |
| Preset                     | `climate.set_preset_mode`            | `preset_mode`             |
| Color or brightness        | `select.select_option`               | `option`                  |

Every call targets the configured entity ID. The card sends no whole-device power action implicitly. Commands are serialized within each card and are never replayed automatically. An already satisfied command requires no call. Pending operations end on matching state, service failure, removal/reconfiguration or a 45-second deadline. Service acceptance alone does not settle a command. Raw provider errors are not displayed.

The backend remains responsible for its cloud read/modify/write serialization and the physical device's semantics. A configured power switch in standby takes precedence over retained effect flags in the illustration. Without that entity, effects-off is not interpreted as whole-device standby.

## Security and packaging

The card uses Home Assistant's authenticated frontend context. It neither stores nor obtains Flame Connect passwords, access tokens or refresh tokens. Entity data and names are rendered as escaped text. Configuration image overrides are same-origin paths. Default artwork is embedded in the self-contained bundle, with no CDN dependency or runtime discovery request for images.

Distribution validation checks the filename, self-contained imports, artwork presence and a 2.5 MB size ceiling. Source maps and the simulator are not published in `dist/`. The release workflow builds and checks the tagged commit before uploading the module. An unsuccessful required validation prevents publication.

## Quality and compatibility

The project uses TypeScript strict checks, ESLint, formatting checks, dependency auditing, unit/contract tests, browser tests, automated accessibility checks, HACS validation and SonarQube Cloud. Applicable principles of HA's quality scale guide design; this frontend plugin does not claim an official integration-quality tier. Hassfest is a Python integration validator and does not validate this dashboard card.

Documentation and build requirements are independent of runtime HA compatibility. A successful simulated test does not prove account access, physical heat output or every model-specific color option.
