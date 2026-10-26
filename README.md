# MMM-DailyScripture

A daily cached scripture card with offline fallback and optional birthday-aware
hiding.

Version 0.1.0. MIT-licensed standalone MagicMirror module.

![Synthetic standalone module preview](docs/preview.png)

## Installation

From your MagicMirror installation directory:

```sh
cd modules
git clone https://github.com/QuietNodeLab/MMM-DailyScripture.git
```

Alternatively, download the repository ZIP and extract it as the folder below.

Copy this folder into `MagicMirror/modules/MMM-DailyScripture`. No extra npm
runtime packages or shared dashboard stylesheet are required. Use MagicMirror
2.38.0 with Node 24 as the tested baseline; other versions still need
verification.

Add a module entry to your local config:

```js
{
  module: "MMM-DailyScripture",
  position: "top_left",
  config: {
    "provider": "web",
    "timezone": "Europe/London",
    "hideOnBirthdays": false
  }
}
```

## Behavior and configuration

No companion module or birthday data is required by default. The `web` provider
retrieves a random World English Bible verse and retains it for the local
calendar day. It is a daily cached selection, not a curated daily reading plan.
The optional `ourmanna` provider uses OurManna's daily verse with WEB backup.

Options: `provider` (web or ourmanna), `timezone` (null = browser zone),
`refreshInterval` (600000 ms), `hideOnBirthdays` (false), `birthdayFile`
(birthdays.json), `birthdayShowFromHour` (0), `birthdayShowUntilHour` (24),
`preview` (false; bypasses birthday hiding only).

If birthday hiding is enabled, copy birthdays.example.json to the config
directory and maintain it locally. Missing/invalid opted-in birthday data hides
the card to avoid covering a celebration. Bundled birthday logic removes the
sibling-module dependency. Cache files are written under the module's ignored
`cache/` directory; allow write access there for persistent caching. If writes
fail, in-memory caching and the built-in WEB fallback still work.

The screenshot uses a mocked synthetic response, not a live API call. See
ATTRIBUTION.md for content/provider terms. Requests have timeouts, response-size
checks and limited approved redirects. Do not use an untrusted proxy to inject
private API credentials; no API keys are needed.

## Development

`npm ci --ignore-scripts` and `npm test` run offline with Node 24. External APIs
must be mocked. JSON date modules use calendar dates; the configured zone
selects "today". Private configuration and cache data are ignored. All example
people, locations and events are synthetic or public examples. Screenshots use
only mock data.

Styles are scoped to the module. Change its own card CSS in your local
custom.css if desired; do not copy a full dashboard theme. Keep filenames as
filenames rather than absolute deployment paths. JSON helpers search config
first, then the module. Timers stop when the module is suspended and restart
when it resumes.

See [VALIDATION.md](VALIDATION.md) for tests actually performed and their
limits.

## License and attribution

The custom package code is MIT-licensed under module contributors; see
[LICENSE](LICENSE). No source-project Git history, private configuration,
optional device services or upstream module implementation is bundled.
MagicMirror is a separate dependency. See [ATTRIBUTION.md](ATTRIBUTION.md) for
artwork and external data notes.
