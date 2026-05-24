import type { WeatherData, TempUnit, WindUnit } from "./config.js"

const WEATHER_URL = "https://api.open-meteo.com/v1/forecast"

export async function fetchWeather(
  lat: number,
  lon: number,
  tempUnit: TempUnit,
  windUnit: WindUnit,
  signal?: AbortSignal,
): Promise<WeatherData> {
  const url = new URL(WEATHER_URL)
  url.searchParams.set("latitude", lat.toString())
  url.searchParams.set("longitude", lon.toString())
  url.searchParams.set("current", "temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,pressure_msl,cloud_cover,wind_speed_10m,wind_direction_10m,wind_gusts_10m,uv_index,weather_code")
  url.searchParams.set("daily", "precipitation_probability_max")
  url.searchParams.set("timezone", "auto")
  url.searchParams.set("temperature_unit", tempUnit === "F" ? "fahrenheit" : "celsius")
  url.searchParams.set("wind_speed_unit", windUnit === "mph" ? "mph" : "kmh")

  const res = await fetch(url.toString(), {   signal: signal
    ? AbortSignal.any([signal, AbortSignal.timeout(10_000)])
    : AbortSignal.timeout(10_000) })
  if (!res.ok) throw new Error(`Weather API returned ${res.status}`)

  const body = await res.json()

  if (body.error) {
    throw new Error(`Weather API error: ${body.reason ?? "unknown"}`)
  }

  const current = body.current
  if (!current || typeof current.temperature_2m !== "number" ||
      typeof current.cloud_cover !== "number" ||
      typeof current.wind_speed_10m !== "number" ||
      typeof current.relative_humidity_2m !== "number" ||
      typeof current.weather_code !== "number") {
    throw new Error("Weather API returned unexpected shape")
  }

  return {
    temp: Math.round(current.temperature_2m),
    cloudCover: current.cloud_cover,
    windSpeed: current.wind_speed_10m,
    humidity: current.relative_humidity_2m,
    weatherCode: current.weather_code,
    feelsLike: current.apparent_temperature != null ? Math.round(current.apparent_temperature) : undefined,
    precipitation: current.precipitation ?? undefined,
    pressure: current.pressure_msl != null ? Math.round(current.pressure_msl) : undefined,
    windGust: current.wind_gusts_10m != null ? Math.round(current.wind_gusts_10m) : undefined,
    windDirection: current.wind_direction_10m != null ? Math.round(current.wind_direction_10m) : undefined,
    uvIndex: current.uv_index != null ? Math.round(current.uv_index * 10) / 10 : undefined,
    rainChance: body.daily?.precipitation_probability_max?.[0] ?? undefined,
  }
}
