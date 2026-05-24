import type { GeocodingResult } from "./config.js"

const GEOCODING_URL = "https://geocoding-api.open-meteo.com/v1/search"

export async function searchLocation(query: string): Promise<GeocodingResult[]> {
  const url = new URL(GEOCODING_URL)
  url.searchParams.set("name", query)
  url.searchParams.set("count", "10")
  url.searchParams.set("language", "en")
  url.searchParams.set("format", "json")

  if (!query.trim()) return []

  const res = await fetch(url.toString(), { signal: AbortSignal.timeout(10_000) })
  if (!res.ok) throw new Error(`Geocoding failed: ${res.status}`)

  const data = await res.json()
  if (data.error) {
    throw new Error(`Geocoding API error: ${data.reason ?? "unknown"}`)
  }

  const raw: unknown[] = Array.isArray(data.results) ? data.results : []
  return raw.filter((r): r is GeocodingResult =>
    typeof r === "object" && r !== null &&
    typeof (r as any).name === "string" &&
    typeof (r as any).latitude === "number" &&
    typeof (r as any).longitude === "number"
  ).map(r => ({
    id: (r as any).id ?? 0,
    name: (r as any).name,
    country: (r as any).country ?? "",
    country_code: (r as any).country_code ?? "",
    latitude: (r as any).latitude,
    longitude: (r as any).longitude,
    admin1: (r as any).admin1,
  }))
}
