/** @jsxImportSource @opentui/solid */
import { type TuiPluginApi, type TuiThemeCurrent } from "@opencode-ai/plugin/tui"
import { createSignal, Show, For, type Accessor } from "solid-js"
import type { WeatherData, WeatherConfig, WeatherField, TempUnit, WindUnit, Alignment } from "./config.js"
import { DEFAULT_ALIGNMENT, DEFAULT_INTERVAL, DEFAULT_FIELDS, DEFAULT_SHOW_HINT, DEFAULT_SHOW_ICONS, DEFAULT_SHOW_LOCATION, DEFAULT_LOCATION_COLOR, weatherEmoji, weatherDescription, isImperialCountry, numOrUndefined, strOrUndefined, windDirectionLabel } from "./config.js"
import { fetchWeather } from "./weather.js"

const TEMP_UNITS = ["C", "F"] as const
const WIND_UNITS = ["km/h", "mph"] as const
const ALIGNMENTS = ["left", "center", "right"] as const

type Seg = { kind: "separator" | "muted" | "normal" | "location"; text: string }

type WeatherRefreshController = {
  data: Accessor<WeatherData | null>
  error: Accessor<string | null>
  config: Accessor<WeatherConfig>
  lastUpdated: Accessor<Date | null>
  loading: Accessor<boolean>
  requestRefresh: () => void
  requestConfigReload: () => void
}

const weatherControllers = new WeakMap<TuiPluginApi, WeatherRefreshController>()
const pendingRefreshRequests = new WeakSet<TuiPluginApi>()
const pendingConfigReloadRequests = new WeakSet<TuiPluginApi>()

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
    if (!first) segs.push({ kind: "separator", text: " · " })
    first = false
    segs.push({ kind, text })
  }

  if (config.showLocation && config.city) {
    emit("location", config.city)
  }

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
    pressure:   { icon: "🔽", label: "Press",  value: (d) => d.pressure !== undefined ? `${d.pressure}hPa` : undefined },
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

function formatUpdatedAt(lastUpdated: Date) {
  return lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
}

function getWeatherController(api: TuiPluginApi): WeatherRefreshController {
  const existing = weatherControllers.get(api)
  if (existing) return existing

  const [data, setData] = createSignal<WeatherData | null>(null)
  const [error, setError] = createSignal<string | null>(null)
  const [config, setConfig] = createSignal<WeatherConfig>(readConfig(api))
  const [lastUpdated, setLastUpdated] = createSignal<Date | null>(null)
  const [loading, setLoading] = createSignal(false)

  let disposed = false
  let timer: ReturnType<typeof setInterval> | undefined
  let loadVersion = 0
  let inFlight = false
  let queued = false
  let pendingRefresh = pendingRefreshRequests.has(api)
  let pendingConfigReload = pendingConfigReloadRequests.has(api)

  pendingRefreshRequests.delete(api)
  pendingConfigReloadRequests.delete(api)

  const dispose = () => {
    if (disposed) return
    disposed = true
    if (timer !== undefined) clearInterval(timer)
    weatherControllers.delete(api)
  }

  const armScheduler = (minutes: number) => {
    if (timer !== undefined) clearInterval(timer)
    if (disposed) return
    timer = setInterval(() => { void reload() }, Math.max(1, minutes) * 60 * 1000)
  }

  const requestConfigReload = () => {
    if (disposed) return
    const previousInterval = config().interval
    const nextConfig = readConfig(api)
    setConfig(nextConfig)
    pendingConfigReload = false
    if (nextConfig.interval !== previousInterval) armScheduler(nextConfig.interval)
  }

  const flushSignals = (fn: () => void) => {
    setTimeout(() => { if (!disposed) fn() }, 0)
  }

  const reload = async () => {
    if (disposed) return
    if (inFlight) {
      queued = true
      return
    }

    const currentVersion = ++loadVersion
    inFlight = true
    setLoading(true)
    const nextConfig = readConfig(api)
    setConfig(nextConfig)

    try {
      if (nextConfig.lat === undefined || nextConfig.lon === undefined) {
        if (!disposed && currentVersion === loadVersion) {
          setError("No location set")
          setData(null)
          setLastUpdated(null)
          setLoading(false)
        }
        return
      }

      setError(null)
      const weather = await fetchWeather(nextConfig.lat, nextConfig.lon, nextConfig.tempUnit, nextConfig.windUnit)
      if (disposed || currentVersion !== loadVersion) return

      const fetchedAt = new Date()
      flushSignals(() => {
        setLastUpdated(fetchedAt)
        setData(weather)
        setError(null)
        setLoading(false)
      })
    } catch {
      if (disposed || currentVersion !== loadVersion) return
      flushSignals(() => {
        setError("Weather unavailable")
        setData(null)
        setLastUpdated(null)
        setLoading(false)
      })
    } finally {
      inFlight = false
      if (queued && !disposed) {
        queued = false
        void reload()
      }
    }
  }

  const requestRefresh = () => {
    if (disposed) return
    pendingRefresh = false
    void reload()
  }

  const controller: WeatherRefreshController = {
    data,
    error,
    config,
    lastUpdated,
    loading,
    requestRefresh,
    requestConfigReload,
  }

  weatherControllers.set(api, controller)
  api.lifecycle.signal.addEventListener("abort", dispose, { once: true })

  armScheduler(config().interval)
  void reload()

  if (pendingConfigReload) requestConfigReload()
  if (pendingRefresh) requestRefresh()

  return controller
}

export function requestWeatherRefresh(api: TuiPluginApi): void {
  const controller = weatherControllers.get(api)
  if (!controller) {
    pendingRefreshRequests.add(api)
    return
  }
  controller.requestRefresh()
}

export function requestWeatherConfigReload(api: TuiPluginApi): void {
  const controller = weatherControllers.get(api)
  if (!controller) {
    pendingConfigReloadRequests.add(api)
    return
  }
  controller.requestConfigReload()
}

export function WeatherWidget(props: { api: TuiPluginApi }) {
  const controller = getWeatherController(props.api)
  const theme = () => props.api.theme.current
  const hasLocation = () => controller.config().lat !== undefined && controller.config().lon !== undefined
  const showHint = () => controller.config().showHint

  return (
    <box flexDirection="row" flexGrow={1} paddingRight={2}>
      <Show when={showHint() && hasLocation()}>
        <text
          fg={theme().textMuted}
          flexShrink={0}
          onMouseDown={() => props.api.keymap.dispatchCommand("weather.settings")}
        >
          Alt+W Settings
        </text>
        <text fg={theme().info} flexShrink={0}> · </text>
      </Show>
      <Show when={controller.lastUpdated()}>
        {(updated) => (
          <>
            <text fg={theme().textMuted} flexShrink={0}>
              Updated {formatUpdatedAt(updated())}
            </text>
            <text fg={theme().info} flexShrink={0}> · </text>
          </>
        )}
      </Show>
      <box flexGrow={1} flexDirection="row" justifyContent={justifyContent(controller.config().alignment)}>
        <Show when={hasLocation()} fallback={
          <text fg={theme().textMuted} onMouseDown={() => props.api.keymap.dispatchCommand("weather.settings")}>
            No location set — click to configure
          </text>
        }>
          <Show
            when={controller.data()}
            fallback={
              <text
                fg={theme().textMuted}
                onMouseDown={() => props.api.keymap.dispatchCommand("weather.refresh")}
              >
                {controller.error() ?? "Loading..."}
              </text>
            }
          >
            {(w) => (
              <For each={formatFields(w(), controller.config())}>
                {(seg) => {
                  const fg = seg.kind === "separator"
                    ? theme().info
                    : seg.kind === "location"
                      ? resolveThemeColor(theme(), controller.config().locationColor)
                      : seg.kind === "normal"
                        ? theme().text
                        : theme().textMuted
                  return <text fg={fg}>{seg.text}</text>
                }}
              </For>
            )}
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
