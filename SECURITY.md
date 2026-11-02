# Security

Report suspected vulnerabilities privately using this repository's GitHub security reporting facility when available. Do not include credentials, tokens, account details or unredacted HA exports in public issues.

The supported security boundary is the dashboard card running inside an authenticated Home Assistant frontend. The card does not create a new authentication service, open network listeners, execute user-supplied scripts or contact Flame Connect directly. Configuration must not turn entity names, option labels or image paths into executable markup or cross-origin requests. Commands must target configured entities, validate supported values and avoid implicit whole-device startup or automatic replay.

Only the latest published version receives fixes. The backend integration's authentication, cloud transport and device behavior are separate components; report those findings to Flame Connect HA.
