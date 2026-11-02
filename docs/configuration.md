# Configuration

Use the visual card editor or the dashboard's YAML card editor. These options configure a dashboard card; they do not belong in `configuration.yaml`.

| Option             | Type    | Default                                             | Meaning                                                                                      |
| ------------------ | ------- | --------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `type`             | string  | Required                                            | `custom:flame-connect-card`                                                                  |
| `version`          | integer | `1`                                                 | Configuration schema version, independent of package version                                 |
| `name`             | string  | Entity name                                         | Card title                                                                                   |
| `entities`         | object  | Required                                            | Entity-role mapping below                                                                    |
| `show_power`       | boolean | `true`                                              | Display the configured whole-device power button                                             |
| `show_image`       | boolean | `true`                                              | Display the fireplace illustration                                                           |
| `show_flame`       | boolean | `true`                                              | Display the decorative flame button                                                          |
| `show_heating`     | boolean | `true`                                              | Display the heating/ventilation button                                                       |
| `show_target`      | boolean | `true`                                              | Display the target-temperature slider                                                        |
| `show_ambient`     | boolean | `true`                                              | Display the external room-temperature reading                                                |
| `show_mode`        | boolean | `true`                                              | Display the heating preset selector                                                          |
| `show_color`       | boolean | `true`                                              | Display the flame color selector                                                             |
| `show_brightness`  | boolean | `true`                                              | Display the flame brightness selector                                                        |
| `show_speed`       | boolean | `true`                                              | Display the flame-speed slider when its number entity is mapped                              |
| `control_order`    | array   | `[ambient, target, mode, color, brightness, speed]` | Reading and selector order; include each key exactly once                                    |
| `image_background` | string  | `"#000000"`                                         | Fireplace image background: `none`, `transparent`, `black`, `white` or a six-digit hex color |
| `images`           | object  | Bundled artwork                                     | Optional per-state images                                                                    |

## Visible elements

In the dashboard, edit the card and use **Visible elements** to choose which controls and readings appear. The editor follows your Home Assistant language; Spanish users see **Elementos visibles**. All elements are visible by default when their required entities are mapped. Missing bindings still hide the corresponding elements.

For example, uncheck **Show target temperature** to keep heating on/off and its mode selector while removing the target-temperature slider. The equivalent card configuration is:

```yaml
type: custom:flame-connect-card
entities:
  flame: light.living_room_flame
  climate: climate.living_room_heating
show_target: false
control_order:
  - mode
  - ambient
  - target
  - color
  - brightness
  - speed
```

Visibility options do not remove entity bindings, alter the fireplace state or send commands. They persist per card and can be restored independently. Empty control rows collapse automatically. Under **Control order** (**Orden de los controles**), use the up/down buttons to reorder room temperature, target temperature, heating/fan mode, color, brightness and flame speed. Items follow this order from left to right and top to bottom, stacking in the same order on narrow screens. Hidden items retain their position when shown again. Power, flame and heating buttons stay in their separate action group. Hiding a control is a display preference, not an authorization restriction: the entity remains accessible elsewhere in Home Assistant. To use the same fireplace on different dashboards with different visible controls, configure each card separately.

## Entity roles

| Role         | Domain    | Meaning                                                               |
| ------------ | --------- | --------------------------------------------------------------------- |
| `flame`      | `light`   | Decorative flame on/off                                               |
| `climate`    | `climate` | Heating/ventilation, target temperature and presets                   |
| `power`      | `switch`  | Optional whole-fireplace power; can enable heating and flame          |
| `speed`      | `number`  | Optional flame speed, requiring the device capability `FlameFanSpeed` |
| `ambient`    | `sensor`  | Optional room thermometer, `device_class: temperature`, °C or °F      |
| `color`      | `select`  | Optional model-specific flame palette                                 |
| `brightness` | `select`  | Optional flame brightness/effect options                              |

At least `flame` or `climate` must be configured. Automatic discovery groups enabled `flame_connect` registry entries by device and recognizes the backend's stable unique-ID suffixes. It does not infer controls from translated display names. A permission failure leaves manual entity selection available. Switching the discovered fireplace replaces its control bindings and retains the separately selected room sensor.

Disabled or nonexistent entities cannot be controlled. Color entities usually require enabling experimental controls in Flame Connect HA and then enabling the individual entity on its device page. Do not confuse the climate target with the legacy unavailable reported-temperature sensor.

## Temperature

The target uses the climate entity's exposed unit, limits and step; the card does not convert a command a second time. The target is adjusted with a horizontal slider using those limits and increments. Dragging previews the position locally; releasing it sends one command. The numeric reading remains the confirmed setpoint until Home Assistant reports the change. Arrow keys adjust by one step, while Home/End select the minimum/maximum. Preview mode, pending commands, missing limits and fixed ranges disable the slider.

Room readings are converted to the target's unit when available, otherwise the HA unit preference or sensor unit is used. The original sensor state is never changed. Unknown, unavailable, empty, non-finite and incompatible readings display as unavailable. An unchanged temperature is not considered stale solely because its value has not changed.

Normal, Eco and Fan only are offered only when included in `preset_modes`. If another preset is active, the card displays it without silently replacing it. Brightness options can include `high`, `low`, `flicker_high` and `flicker_low`; palette combinations depend on the model.

## Flame speed

Select the fireplace's **Flame speed** Number entity in the visual editor, or map `entities.speed` in YAML. Automatic discovery recognizes enabled `flame_connect` number entities ending in `_speed`.

```yaml
type: custom:flame-connect-card
entities:
  flame: light.living_room_flame
  speed: number.living_room_flame_speed
show_speed: true
```

The slider uses the Number entity's `min`, `max` and `step` attributes. Flame Connect HA normally exposes integer values 1–5 when the fireplace supports `FlameFanSpeed`. Speed changes use `number.set_value`; they do not change brightness, color, heating or power. Dragging sends no commands until release. The numeric reading and committed slider position follow confirmed entity updates, including external changes from the original app.

Use **Visible elements → Show flame speed** or `show_speed: false` to hide the slider, and **Control order** to move it. Without a mapped entity it is hidden; an unavailable entity or missing/invalid limits disables it. It also stays disabled during a pending command and in card previews.

Existing five-item `control_order` arrays remain accepted and append `speed` at the end. New complete arrays contain `ambient`, `target`, `mode`, `color`, `brightness` and `speed` exactly once. The old order and entity bindings are retained; adding a speed role does not send commands or turn the fireplace on.

## Image background

Use **Fireplace image background** in the visual editor. Choose **None (transparent)** to show the card background through the artwork's transparent areas, or **Background color** and use the color picker. Black is the default. In Spanish the section is **Fondo de la imagen de la chimenea**. Switching from transparent to color starts with black.

```yaml
image_background: none
# Or use a color, for example:
# image_background: "#ffffff"
```

The setting applies only to the illustration area, not the whole card or the fireplace's physical flame color. It persists per card and sends no device commands. The bundled artwork supports transparency; opaque backgrounds embedded in custom images remain opaque. Hiding the image retains the chosen background for when it is shown again.

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
