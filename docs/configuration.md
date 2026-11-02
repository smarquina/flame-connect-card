# Configuration

Use the visual card editor or the dashboard's YAML card editor. These options configure a dashboard card; they do not belong in `configuration.yaml`.

| Option            | Type    | Default         | Meaning                                                      |
| ----------------- | ------- | --------------- | ------------------------------------------------------------ |
| `type`            | string  | Required        | `custom:flame-connect-card`                                  |
| `version`         | integer | `1`             | Configuration schema version, independent of package version |
| `name`            | string  | Entity name     | Card title                                                   |
| `entities`        | object  | Required        | Entity-role mapping below                                    |
| `show_power`      | boolean | `true`          | Display the configured whole-device power button             |
| `show_image`      | boolean | `true`          | Display the fireplace illustration                           |
| `show_flame`      | boolean | `true`          | Display the decorative flame button                          |
| `show_heating`    | boolean | `true`          | Display the heating/ventilation button                       |
| `show_target`     | boolean | `true`          | Display the target temperature input and adjustment buttons  |
| `show_ambient`    | boolean | `true`          | Display the external room-temperature reading                |
| `show_mode`       | boolean | `true`          | Display the heating preset selector                          |
| `show_color`      | boolean | `true`          | Display the flame color selector                             |
| `show_brightness` | boolean | `true`          | Display the flame brightness selector                        |
| `images`          | object  | Bundled artwork | Optional per-state images                                    |

## Visible elements

In the dashboard, edit the card and use **Visible elements** to choose which controls and readings appear. The editor follows your Home Assistant language; Spanish users see **Elementos visibles**. All elements are visible by default when their required entities are mapped. Missing bindings still hide the corresponding elements.

For example, uncheck **Show target temperature** to keep heating on/off and its mode selector while removing the setpoint input and its plus/minus buttons. The equivalent card configuration is:

```yaml
type: custom:flame-connect-card
entities:
  flame: light.living_room_flame
  climate: climate.living_room_heating
show_target: false
```

Visibility options do not remove entity bindings, alter the fireplace state or send commands. They persist per card and can be restored independently. Empty control rows collapse automatically. Hiding a control is a display preference, not an authorization restriction: the entity remains accessible elsewhere in Home Assistant. To use the same fireplace on different dashboards with different visible controls, configure each card separately.

## Entity roles

| Role         | Domain    | Meaning                                                          |
| ------------ | --------- | ---------------------------------------------------------------- |
| `flame`      | `light`   | Decorative flame on/off                                          |
| `climate`    | `climate` | Heating/ventilation, target temperature and presets              |
| `power`      | `switch`  | Optional whole-fireplace power; can enable heating and flame     |
| `ambient`    | `sensor`  | Optional room thermometer, `device_class: temperature`, °C or °F |
| `color`      | `select`  | Optional model-specific flame palette                            |
| `brightness` | `select`  | Optional flame brightness/effect options                         |

At least `flame` or `climate` must be configured. Automatic discovery groups enabled `flame_connect` registry entries by device and recognizes the backend's stable unique-ID suffixes. It does not infer controls from translated display names. A permission failure leaves manual entity selection available. Switching the discovered fireplace replaces its control bindings and retains the separately selected room sensor.

Disabled or nonexistent entities cannot be controlled. Color entities usually require enabling experimental controls in Flame Connect HA and then enabling the individual entity on its device page. Do not confuse the climate target with the legacy unavailable reported-temperature sensor.

## Temperature

The target uses the climate entity's exposed unit, limits and step; the card does not convert a command a second time. Room readings are converted to the target's unit when available, otherwise the HA unit preference or sensor unit is used. The original sensor state is never changed. Unknown, unavailable, empty, non-finite and incompatible readings display as unavailable. An unchanged temperature is not considered stale solely because its value has not changed.

Normal, Eco and Fan only are offered only when included in `preset_modes`. If another preset is active, the card displays it without silently replacing it. Brightness options can include `high`, `low`, `flicker_high` and `flicker_low`; palette combinations depend on the model.

## Images

```yaml
images:
  off: /local/fireplace-off.png
  flame: /local/fireplace-flame.png
  heat: /local/fireplace-heat.png
  both: /local/fireplace-both.png
```

Paths must be absolute and same-origin. Remote URLs, protocol-relative URLs, data URLs and script URLs are rejected. Missing overrides use the corresponding quadrant of the bundled four-state artwork. Overrides are static images fitted inside the illustration area; color controls do not recolor them. Omit `images` to use the supplied artwork.

## Language

Card and editor text follow the Home Assistant user's language. Spanish language variants use Spanish; other languages fall back to English. Custom titles and entity names are preserved. The card does not change your HA language or unit settings.
