/** @jsxImportSource @opentui/solid */
import type { TuiPluginApi } from "@opencode-ai/plugin/tui"
import { searchLocation } from "./geocode.js"
import type { GeocodingResult, Alignment, TempUnit, WindUnit, WeatherField } from "./config.js"
import { DEFAULT_ALIGNMENT, DEFAULT_INTERVAL, DEFAULT_FIELDS, DEFAULT_SHOW_HINT, DEFAULT_SHOW_ICONS, DEFAULT_SHOW_LOCATION, DEFAULT_LOCATION_COLOR, FIELD_LABELS, LOCATION_COLOR_OPTIONS } from "./config.js"

type SettingsTempUnit = TempUnit | "auto"
type SettingsWindUnit = WindUnit | "auto"

function refresh(api: TuiPluginApi) {
  api.keymap.dispatchCommand("weather.refresh")
}

function configReload(api: TuiPluginApi) {
  api.keymap.dispatchCommand("weather.config_reload")
}

export function showLocationPicker(api: TuiPluginApi) {
  api.ui.dialog.replace(
    () => (
      <api.ui.DialogPrompt
        title="Set weather location"
        placeholder="Enter city, zip, or address..."
        onCancel={() => showWeatherSettings(api)}
        onConfirm={async (value: string) => {
          const q = value.trim()
          if (!q) return

          api.ui.dialog.replace(() => (
            <box padding={1}>
              <text>Searching locations...</text>
            </box>
          ))

          try {
            const results = await searchLocation(q)
            if (results.length === 0) {
              api.ui.dialog.replace(() => (
                <box padding={1} gap={1}>
                  <text>No locations found for "{q}"</text>
                  <text onMouseDown={() => showLocationPicker(api)}>
                    ← Try again
                  </text>
                </box>
              ))
              return
            }

            api.ui.dialog.replace(() => (
              <api.ui.DialogSelect
                title="Select a location"
                options={results.map((r: GeocodingResult) => ({
                  title: r.name + (r.admin1 ? `, ${r.admin1}` : ""),
                  description: r.country,
                  value: r,
                  onSelect: () => {
                    api.kv.set("weather_lat", r.latitude)
                    api.kv.set("weather_lon", r.longitude)
                    api.kv.set("weather_city", r.name)
                    api.kv.set("weather_country_code", r.country_code)
                    refresh(api)
                    api.ui.dialog.clear()
                  },
                }))}
              />
            ))
          } catch {
            api.ui.dialog.replace(() => (
              <box padding={1} gap={1}>
                <text>Search failed. Check connection.</text>
                <text onMouseDown={() => showLocationPicker(api)}>
                  ← Try again
                </text>
              </box>
            ))
          }
        }}
      />
    ),
    () => {},
  )
}

function showFieldPicker(api: TuiPluginApi) {
  const fieldLabels = FIELD_LABELS
  const allFields: WeatherField[] = ["temp", "cloud", "wind", "humidity", "feels_like", "precip", "pressure", "wind_gust", "wind_dir", "uv_index", "condition", "rain_chance"]
  const current = api.kv.get<WeatherField[]>("weather_fields", DEFAULT_FIELDS)

  api.ui.dialog.replace(() => (
    <api.ui.DialogSelect
      title="Display fields (select to toggle)"
      options={[
        ...allFields.map((f) => ({
          title: `${current.includes(f) ? "✓" : "○"} ${fieldLabels[f]}`,
          value: f,
          onSelect: () => {
            const updated = current.includes(f)
              ? current.filter((x) => x !== f)
              : [...current, f]
            api.kv.set("weather_fields", updated)
            configReload(api)
            showFieldPicker(api)
          },
        })),
        {
          title: "← Back",
          value: "back",
          onSelect: () => showWeatherSettings(api),
        },
      ]}
    />
  ))
}

function showOptionPicker<T extends string>(
  api: TuiPluginApi,
  title: string,
  kvKey: string,
  options: { label: string; value: T }[],
  onBack: () => void,
  configOnly?: boolean,
) {
  const current = api.kv.get<string>(kvKey)
  api.ui.dialog.replace(() => (
    <api.ui.DialogSelect
      title={title}
      options={[
        ...options.map((opt) => ({
          title: `${current === opt.value ? "› " : "  "}${opt.label}`,
          value: opt.value,
          onSelect: () => {
            api.kv.set(kvKey, opt.value)
            if (configOnly) configReload(api)
            else refresh(api)
            onBack()
          },
        })),
        {
          title: "← Back",
          value: "back",
          onSelect: onBack,
        },
      ]}
    />
  ))
}

function showIntervalPicker(api: TuiPluginApi) {
  const current = api.kv.get<number>("weather_interval", DEFAULT_INTERVAL)
  api.ui.dialog.replace(
    () => (
      <api.ui.DialogPrompt
        title="Refresh interval (minutes)"
        value={String(current)}
        placeholder="5"
        onCancel={() => showWeatherSettings(api)}
        onConfirm={(value: string) => {
          const n = parseInt(value, 10)
          if (isNaN(n) || n < 1) return
          api.kv.set("weather_interval", n)
          configReload(api)
          refresh(api)
          showWeatherSettings(api)
        }}
      />
    ),
    () => {},
  )
}

function showBooleanToggle(api: TuiPluginApi, title: string, kvKey: string, defaultVal: boolean, onBack: () => void, configOnly?: boolean) {
  const current = api.kv.get<boolean>(kvKey, defaultVal)
  api.ui.dialog.replace(() => (
    <api.ui.DialogSelect
      title={title}
      options={[
        {
          title: `${current ? "›" : " "} Yes`,
          value: "yes",
          onSelect: () => {
            api.kv.set(kvKey, true)
            if (configOnly) configReload(api)
            else refresh(api)
            onBack()
          },
        },
        {
          title: `${!current ? "›" : " "} No`,
          value: "no",
          onSelect: () => {
            api.kv.set(kvKey, false)
            if (configOnly) configReload(api)
            else refresh(api)
            onBack()
          },
        },
        {
          title: "← Back",
          value: "back",
          onSelect: onBack,
        },
      ]}
    />
  ))
}

export function showWeatherSettings(api: TuiPluginApi) {
  const city = api.kv.get<string>("weather_city")
  const fields = api.kv.get<WeatherField[]>("weather_fields", DEFAULT_FIELDS)
  const tempUnit = api.kv.get<string>("weather_temp_unit") ?? "auto"
  const windUnit = api.kv.get<string>("weather_wind_unit") ?? "auto"
  const interval = api.kv.get<number>("weather_interval", DEFAULT_INTERVAL)
  const alignment = api.kv.get<string>("weather_alignment") ?? DEFAULT_ALIGNMENT
  const showHint = api.kv.get<boolean>("weather_show_hint", DEFAULT_SHOW_HINT)
  const showIcons = api.kv.get<boolean>("weather_show_icons", DEFAULT_SHOW_ICONS)
  const showLocation = api.kv.get<boolean>("weather_show_location", DEFAULT_SHOW_LOCATION)
  const locationColor = api.kv.get<string>("weather_location_color", DEFAULT_LOCATION_COLOR)

  api.ui.dialog.replace(() => (
    <api.ui.DialogSelect
      title="Weather settings"
      options={[
        {
          title: city ? `📍 ${city}` : "📍 Set location",
          value: "set-location",
          onSelect: () => showLocationPicker(api),
        },
        {
          title: `Fields: ${fields.length} shown`,
          value: "fields",
          onSelect: () => showFieldPicker(api),
        },
        {
          title: `Temp: ${tempUnit === "auto" ? "Auto" : tempUnit === "C" ? "Celsius" : "Fahrenheit"}`,
          value: "temp",
          onSelect: () =>
            showOptionPicker<SettingsTempUnit>(api, "Temperature unit", "weather_temp_unit", [
              { label: "Auto (detect from location)", value: "auto" },
              { label: "Celsius (°C)", value: "C" },
              { label: "Fahrenheit (°F)", value: "F" },
            ], () => showWeatherSettings(api)),
        },
        {
          title: `Wind: ${windUnit === "auto" ? "Auto" : windUnit === "km/h" ? "km/h" : "mph"}`,
          value: "wind",
          onSelect: () =>
            showOptionPicker<SettingsWindUnit>(api, "Wind speed unit", "weather_wind_unit", [
              { label: "Auto (detect from location)", value: "auto" },
              { label: "km/h", value: "km/h" },
              { label: "mph", value: "mph" },
            ], () => showWeatherSettings(api)),
        },
        {
          title: `Align: ${alignment}`,
          value: "align",
          onSelect: () =>
            showOptionPicker<Alignment>(api, "Alignment", "weather_alignment", [
              { label: "Left", value: "left" },
              { label: "Center", value: "center" },
              { label: "Right", value: "right" },
            ], () => showWeatherSettings(api), true),
        },
        {
          title: `Refresh: every ${interval} min`,
          value: "interval",
          onSelect: () => showIntervalPicker(api),
        },
        {
          title: `Hint: ${showHint ? "Show" : "Hide"}`,
          value: "hint",
          onSelect: () => showBooleanToggle(api, "Show command hint", "weather_show_hint", DEFAULT_SHOW_HINT, () => showWeatherSettings(api), true),
        },
        {
          title: `Icons: ${showIcons ? "On" : "Off"}`,
          value: "icons",
          onSelect: () => showBooleanToggle(api, "Use icons", "weather_show_icons", DEFAULT_SHOW_ICONS, () => showWeatherSettings(api), true),
        },
        {
          title: `Location: ${showLocation ? "Show" : "Hide"}`,
          value: "location",
          onSelect: () => showBooleanToggle(api, "Show location in bar", "weather_show_location", DEFAULT_SHOW_LOCATION, () => showWeatherSettings(api), true),
        },
        {
          title: `Location color: ${locationColor}`,
          value: "loccolor",
          onSelect: () =>
            showOptionPicker(api, "Location color", "weather_location_color",
              LOCATION_COLOR_OPTIONS.map(o => ({ label: o.label, value: o.value })),
              () => showWeatherSettings(api), true),
        },
        {
          title: "Reset to defaults",
          value: "reset",
          onSelect: () => {
            const keys = [
              "weather_temp_unit", "weather_wind_unit", "weather_interval",
              "weather_alignment", "weather_fields", "weather_show_hint",
              "weather_show_icons", "weather_show_location", "weather_location_color",
            ]
            for (const k of keys) api.kv.set(k, undefined)
            refresh(api)
            showWeatherSettings(api)
          },
        },
        {
          title: "Close",
          value: "close",
          onSelect: () => api.ui.dialog.clear(),
        },
      ]}
    />
  ))
}
