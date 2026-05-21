/** @jsxImportSource @opentui/solid */
import { type TuiPluginApi, type TuiThemeCurrent } from "@opencode-ai/plugin/tui"
import { createSignal, createEffect, onCleanup, Show, For } from "solid-js"
import type { WeatherData, WeatherConfig, WeatherField, TempUnit, WindUnit, Alignment } from "./config.js"
import { DEFAULT_ALIGNMENT, DEFAULT_INTERVAL, DEFAULT_FIELDS, DEFAULT_SHOW_HINT, DEFAULT_SHOW_ICONS, DEFAULT_SHOW_LOCATION, DEFAULT_LOCATION_COLOR, weatherEmoji, weatherDescription, isImperialCountry, numOrUndefined, strOrUndefined, windDirectionLabel } from "./config.js"
import { fetchWeather } from "./weather.js"

const TEMP_UNITS = ["C", "F"] as const
const WIND_UNITS = ["km/h", "mph"] as const
const ALIGNMENTS = ["left", "center", "right"] as const

type Seg = { kind: "muted" | "normal" | "location"; text: string }

function resolveThemeColor(theme: TuiThemeCurrent, name: string) {
  const valid = ["accent", "info", "warning", "success", "error", "text", "textMuted"] as const
  const key = valid.includes(name as typeof valid[number]) ? (name as typeof valid[number]) : DEFAULT_LOCATION_COLOR as typeof valid[number]
  return theme[key] ?? theme.text
}

function readConfig(api: TuiPluginApi): WeatherConfig {
  const lat = numOrUndefined(api.kv.get<unknown>("weather_lat"))
  const lon = numOrUndefined(api.kv.get<unknown>("weather_lon"))
  const city = api.kv.get<string>("weather_city")
  const rawTempUnit = strOrUndefined<TempUnit>(TEMP_UNITS)(api.kv.get<unknown>("weather_temp_unit"))
  const rawWindUnit = strOrUndefined<WindUnit>(WIND_UNITS)(api.kv.get<unknown>("weather_wind_unit"))

  const countryCode = api.kv.get<string>("weather_country_code")
  const isImperial = isImperialCountry(countryCode ?? "")

  return {
    lat,
    lon,
    city,
    tempUnit: rawTempUnit ?? (isImperial ? "F" : "C"),
    windUnit: rawWindUnit ?? (isImperial ? "mph" : "km/h"),
    interval: api.kv.get<number>("weather_interval", DEFAULT_INTERVAL),
    alignment: strOrUndefined<Alignment>(ALIGNMENTS)(api.kv.get<unknown>("weather_alignment")) ?? DEFAULT_ALIGNMENT,
    fields: api.kv.get<WeatherField[]>("weather_fields", DEFAULT_FIELDS),
    showHint: api.kv.get<boolean>("weather_show_hint", DEFAULT_SHOW_HINT),
    showIcons: api.kv.get<boolean>("weather_show_icons", DEFAULT_SHOW_ICONS),
    showLocation: api.kv.get<boolean>("weather_show_location", DEFAULT_SHOW_LOCATION),
    locationColor: api.kv.get<string>("weather_location_color", DEFAULT_LOCATION_COLOR),
  }
}

function formatFields(data: WeatherData, config: WeatherConfig): Seg[] {
  const segs: Seg[] = []
  let first = true

  const emit = (kind: "muted" | "normal" | "location", text: string) => {
    if (!first) segs.push({ kind: "muted" as const, text: " · " })
    first = false
    segs.push({ kind, text })
  }

  // Show location at the start
  if (config.showLocation && config.city) {
    emit("location", config.city)
  }

  // Field definitions: icon, label, value extractor
  type FieldDef = {
    icon: string
    label: string
    value: (d: WeatherData, c: WeatherConfig) => string | undefined
  }

  const FIELD_DEFS: Record<WeatherField, FieldDef> = {
    temp:       { icon: "🌡", label: "Temp",   value: (d, c) => `${d.temp}°${c.tempUnit}` },
    cloud:      { icon: "☁",  label: "Cloud",  value: (d) => `${d.cloudCover}%` },
    wind:       { icon: "💨", label: "Wind",   value: (d, c) => `${d.windSpeed}${c.windUnit}` },
    humidity:   { icon: "💧", label: "Hum",    value: (d) => `${d.humidity}%` },
    feels_like: { icon: "🌡", label: "Feels",  value: (d, c) => d.feelsLike !== undefined ? `${d.feelsLike}°${c.tempUnit}` : undefined },
    precip:     { icon: "🌧", label: "Precip", value: (d) => d.precipitation !== undefined ? `${d.precipitation.toFixed(1)}mm` : undefined },
    pressure:   { icon: "🔽", label: "Press", value: (d) => d.pressure !== undefined ? `${d.pressure}hPa` : undefined },
    wind_gust:  { icon: "💨", label: "Gust",   value: (d, c) => d.windGust !== undefined ? `${d.windGust}${c.windUnit}` : undefined },
    wind_dir:   { icon: "🧭", label: "Dir",    value: (d) => d.windDirection !== undefined ? windDirectionLabel(d.windDirection) : undefined },
    uv_index:   { icon: "☀",  label: "UV",     value: (d) => d.uvIndex !== undefined ? `${d.uvIndex}` : undefined },
    condition:  { icon: "",    label: "",        value: (d) => weatherDescription(d.weatherCode) },
    rain_chance:{ icon: "🌧", label: "Rain",   value: (d) => d.rainChance !== undefined ? `${d.rainChance}%` : undefined },
  }

  for (const field of config.fields) {
    const def = FIELD_DEFS[field]
    const val = def.value(data, config)
    if (val === undefined) continue

    if (config.showIcons) {
      if (field === "condition") {
        emit("normal", `${weatherEmoji(data.weatherCode)} ${val}`)
      } else {
        emit("normal", `${def.icon} ${val}`)
      }
    } else {
      if (field === "condition") {
        emit("normal", val)
      } else {
        segs.push({ kind: "muted", text: (first ? "" : " · ") + def.label + ": " })
        first = false
        segs.push({ kind: "normal", text: val })
      }
    }
  }

  return segs
}

export function WeatherWidget(props: { api: TuiPluginApi; refreshVersion: () => number; configVersion: () => number }) {
  const [data, setData] = createSignal<WeatherData | null>(null)
  const [error, setError] = createSignal<string | null>(null)
  const [config, setConfig] = createSignal<WeatherConfig>(readConfig(props.api))

  const theme = () => props.api.theme.current
  const signal = props.api.lifecycle.signal

  let gen = 0

  const load = async () => {
    const cfg = readConfig(props.api)
    setConfig(cfg)

    if (cfg.lat === undefined || cfg.lon === undefined) {
      setError("No location set")
      setData(null)
      return
    }

    const currentGen = ++gen

    try {
      const w = await fetchWeather(cfg.lat, cfg.lon, cfg.tempUnit, cfg.windUnit)
      if (signal.aborted || currentGen !== gen) return
      setData(w)
      setError(null)
    } catch {
      if (signal.aborted || currentGen !== gen) return
      setError("Weather unavailable")
    }
  }

  createEffect(() => {
    props.refreshVersion()
    load()
  })

  createEffect(() => {
    props.configVersion()
    const cfg = readConfig(props.api)
    setConfig(cfg)
  })

  createEffect(() => {
    const intervalMs = config().interval * 60 * 1000
    const timer = setInterval(load, intervalMs)
    onCleanup(() => clearInterval(timer))
  })

  const hasLocation = () => config().lat !== undefined && config().lon !== undefined
  const showHint = () => config().showHint

  return (
    <box
      flexDirection="row"
      flexGrow={1}
      paddingRight={2}
    >
      <Show when={showHint() && hasLocation()}>
        <text
          fg={theme().textMuted}
          flexShrink={0}
          onMouseDown={() => props.api.keymap.dispatchCommand("weather.settings")}
        >
          Alt+W Settings
        </text>
        <box width={1} flexShrink={0} />
      </Show>
      <box flexGrow={1} flexDirection="row" justifyContent={justifyContent(config().alignment)}>
        <Show when={hasLocation()} fallback={
          <text fg={theme().textMuted} onMouseDown={() => props.api.keymap.dispatchCommand("weather.settings")}>
            No location set — click to configure
          </text>
        }>
          <Show
            when={data()}
            fallback={
              <text
                fg={theme().textMuted}
                onMouseDown={() => props.api.keymap.dispatchCommand("weather.refresh")}
              >
                {error() ?? "Loading..."}
              </text>
            }
          >
            {(w) => {
              const segs = formatFields(w(), config())
              return (
                <box flexDirection="row">
                  <For each={segs}>
                    {(seg) => {
                      const fg = seg.kind === "location"
                        ? resolveThemeColor(theme(), config().locationColor)
                        : seg.kind === "normal"
                          ? theme().text
                          : theme().textMuted
                      return <text fg={fg}>{seg.text}</text>
                    }}
                  </For>
                </box>
              )
            }}
          </Show>
        </Show>
      </box>
    </box>
  )
}

function justifyContent(align: Alignment): "flex-start" | "center" | "flex-end" {
  switch (align) {
    case "left": return "flex-start"
    case "center": return "center"
    case "right": return "flex-end"
  }
}
