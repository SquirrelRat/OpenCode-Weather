# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2025-05-23

### Fixed

#### Critical
- **Null reference crash on optional weather fields** — `Math.round(null)` threw when API omitted `feelsLike`, `pressure`, `windGust`, `windDirection`, or `uvIndex`. All 7 optional fields now use `!= null` guards.
- **Stale data race condition** — `flushSignals` used `setTimeout(fn, 0)` allowing UI to read partially-updated signals. Replaced with SolidJS `batch()` for synchronous atomic updates.
- **Widget never disposed on unmount** — `WeatherWidget` now calls `onCleanup` to dispose the weather controller and clear its interval timer.
- **Settings reset did not reload config** — Reset handler cleared KV values but never called `configReload(api)`, so the polling timer kept the old interval and location.

#### High
- **Dead-on-arrival controller init** — Controllers created after plugin lifecycle abort now bail immediately instead of starting fetches that can never render.
- **Unhandled promise rejection in readConfig** — Both `reload()` and `requestConfigReload()` wrap `readConfig` in try/catch.
- **Location change did not reload config** — Selecting a new geocoded location wrote coordinates but never called `configReload(api)`.
- **Geocode search crashes when API returns error** — Response body now checked for `data.error`; results validated at runtime instead of using unsafe `as` cast.
- **Empty geocode query sent to API** — Blank/whitespace-only queries guarded before fetch.
- **Empty fields array blanked the widget** — Field toggle now prevents removing the last remaining field.

#### Medium
- **Loading signal stuck true on stale version** — Early returns in reload now set `loading(false)`.
- **Unnecessary re-renders in field list** — `formatFields` memoized with `createMemo`; `For` uses tracked `segments()` signal.
- **Pending request checks before controller stored** — Moved after `weatherControllers.set` to prevent orphaning.
- **Interval parsing accepted NaN/Infinity** — Replaced `parseInt` with `Number()` + `isFinite()` + `Math.floor()`, capped at 1440 min (24h).
- **Async dialog lifecycle crash** — All `api.ui.dialog.replace()` calls wrapped in try/catch to handle dismissed dialog during geocode search.

#### Low
- **Error messages lacked detail** — Catch blocks now include `err.message` in user-visible error text.
- **Separator style inconsistency** — Non-icon mode now uses same `info`-colored separator as icon mode.
- **resolveThemeColor could return undefined** — Added fallback chain `?? theme.text ?? ""`.
- **KV reset used set(undefined)** — Now uses `delete` when available, falls back to `set(undefined)`.
- **Overlapping geocode searches** — Module-level `geocodeInFlight` guard prevents concurrent API calls.
- **windDirectionLabel returned NaN** — `isFinite(deg)` guard returns `"?"` for non-finite values.
- **locationColor typed as bare string** — New `LocationColor` union type narrows to valid theme color names.

### Changed
- `fetchWeather` accepts optional `AbortSignal` parameter for combined abort-on-dispose + timeout via `AbortSignal.any`.
- `display.tsx` uses `fetchAbort` controller — previous fetch aborted on new request and on widget dispose.
- `geocode.ts` runtime validates geocoding results instead of TypeScript `as` cast.

## [0.1.0] - 2025-05-21

### Added
- Initial release — weather widget for OpenCode TUI status bar.
- Current conditions display (temp, cloud, wind, humidity, rain chance).
- Location search via Open-Meteo geocoding API.
- Configurable update interval, fields, and display units.
- Icon and text rendering modes.
- Location color theming (accent, info, warning, success, error).
