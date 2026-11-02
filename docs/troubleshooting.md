# Troubleshooting

| Symptom                                 | Check                                                                                                                                             |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Custom element does not exist           | Verify the installed resource URL, JavaScript-module type, browser console and frontend cache. Avoid duplicate resources.                         |
| No fireplace in discovery               | Confirm the backend is installed and its entities are enabled. If registry access is denied, choose entities manually.                            |
| Color is absent                         | Enable experimental controls in Flame Connect HA, enable the color entity and bind it in the card. The model must support a palette.              |
| Temperature unavailable                 | Verify the external sensor has `device_class: temperature`, a finite value and °C/°F units. Target and room temperature are separate.             |
| Flame-on disabled in standby            | The card will not silently activate whole-device power, which can enable heating too. Start the fireplace explicitly and then choose its effects. |
| Target change rejected                  | Use the climate entity's minimum, maximum and step. Target changes do not turn heating on.                                                        |
| A command is unconfirmed                | Check the backend entities and original app before repeating it. The card does not automatically retry.                                           |
| Illustration and physical output differ | Images represent configured effects. Thermostat cycling, actual heat output, brightness and color are not measured by the illustration.           |
| Old UI after update                     | Refresh Companion/browser clients. For manual resources, update the version query.                                                                |

Report card version, backend version, HA version, browser, fireplace model and the affected entity domains. Include a minimal redacted card configuration only when needed. Do not post credentials, JWTs, native callback URLs or full HA state exports.
