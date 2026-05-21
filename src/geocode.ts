import type { GeocodingResult } from "./config.js"

const GEOCODING_URL = "https://geocoding-api.open-meteo.com/v1/search"

export async function searchLocation(query: string): Promise<GeocodingResult[]> {
  const url = new URL(GEOCODING_URL)
  url.searchParams.set("name", query)
  url.searchParams.set("count", "10")
  url.searchParams.set("language", "en")
  url.searchParams.set("format", "json")

  const res = await fetch(url.toString(), { signal: AbortSignal.timeout(10_000) })
  if (!res.ok) throw new Error(`Geocoding failed: ${res.status}`)

  const data = await res.json()
  return (data.results ?? []) as GeocodingResult[]
}
