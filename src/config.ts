export type WeatherData = {
  temp: number
  cloudCover: number
  windSpeed: number
  humidity: number
  weatherCode: number
  feelsLike?: number
  precipitation?: number
  pressure?: number
  windGust?: number
  windDirection?: number
  uvIndex?: number
  rainChance?: number
}

export type TempUnit = "C" | "F"
export type WindUnit = "km/h" | "mph"
export type Alignment = "left" | "center" | "right"
export type WeatherField = "temp" | "cloud" | "wind" | "humidity" | "feels_like" | "precip" | "pressure" | "wind_gust" | "wind_dir" | "uv_index" | "condition" | "rain_chance"

export type LocationColor = "accent" | "info" | "warning" | "success" | "error" | "text" | "textMuted"

export type WeatherConfig = {
  lat: number | undefined
  lon: number | undefined
  city: string | undefined
  tempUnit: TempUnit
  windUnit: WindUnit
  interval: number
  alignment: Alignment
  fields: WeatherField[]
  showHint: boolean
  showIcons: boolean
  showLocation: boolean
  locationColor: LocationColor
}

export type GeocodingResult = {
  id: number
  name: string
  country: string
  country_code: string
  latitude: number
  longitude: number
  admin1?: string
}

export const DEFAULT_ALIGNMENT: Alignment = "left"
export const DEFAULT_INTERVAL = 5
export const DEFAULT_FIELDS: WeatherField[] = ["temp", "cloud", "wind", "humidity", "rain_chance"]
export const DEFAULT_SHOW_HINT = false
export const DEFAULT_SHOW_ICONS = false
export const DEFAULT_SHOW_LOCATION = true
export const DEFAULT_LOCATION_COLOR = "accent"

export const LOCATION_COLOR_OPTIONS = [
  { label: "Accent", value: "accent" },
  { label: "Info", value: "info" },
  { label: "Warning", value: "warning" },
  { label: "Success", value: "success" },
  { label: "Error", value: "error" },
  { label: "Text", value: "text" },
  { label: "Muted", value: "textMuted" },
] as const

export const FIELD_LABELS: Record<WeatherField, string> = {
  temp: "Temperature",
  cloud: "Cloud cover",
  wind: "Wind speed",
  humidity: "Humidity",
  feels_like: "Feels like",
  precip: "Precipitation",
  pressure: "Air pressure",
  wind_gust: "Wind gusts",
  wind_dir: "Wind direction",
  uv_index: "UV index",
  condition: "Condition text",
  rain_chance: "Rain chance (%)",
}

export function windDirectionLabel(deg: number): string {
  if (!isFinite(deg)) return "?"
  const dirs = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"]
  return dirs[((Math.round(deg / 22.5) % 16) + 16) % 16]
}

export function isImperialCountry(code: string): boolean {
  return code === "US" || code === "LR" || code === "MM"
}

export function weatherEmoji(code: number): string {
  if (code >= 95) return "⛈"
  if (code >= 85) return "🌨"
  if (code >= 80) return "🌦"
  if (code >= 71) return "🌨"
  if (code >= 66) return "🌧"
  if (code >= 61) return "🌧"
  if (code >= 56) return "🌧"
  if (code >= 51) return "🌦"
  if (code >= 45) return "🌫"
  if (code >= 3)  return "☁"
  if (code >= 2)  return "⛅"
  if (code >= 1)  return "🌤"
  return "☀"
}

export function weatherDescription(code: number): string {
  if (code >= 97) return "Severe thunderstorm"
  if (code >= 95) return "Thunderstorm"
  if (code >= 85) return "Snow showers"
  if (code >= 80) return "Rain showers"
  if (code >= 71) return "Snow"
  if (code >= 66) return "Freezing rain"
  if (code >= 61) return "Rain"
  if (code >= 56) return "Freezing drizzle"
  if (code >= 51) return "Drizzle"
  if (code >= 45) return "Foggy"
  if (code >= 3) return "Overcast"
  if (code >= 2) return "Partly cloudy"
  if (code >= 1) return "Mainly clear"
  return "Clear"
}

export function numOrUndefined(v: unknown): number | undefined {
  return typeof v === "number" ? v : undefined
}

export function strOrUndefined<T extends string>(allowed: readonly T[]): (v: unknown) => T | undefined {
  return (v: unknown): T | undefined => (typeof v === "string" && allowed.includes(v as T) ? (v as T) : undefined)
}
