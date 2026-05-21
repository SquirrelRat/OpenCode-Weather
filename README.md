# OpenCode-Weather

Weather widget plugin for [OpenCode](https://github.com/opencode-ai/opencode) TUI. Shows current conditions in the `app_bottom` bar using the [Open-Meteo](https://open-meteo.com/) API — free, no API key required.

<img width="705" height="32" alt="image" src="https://github.com/user-attachments/assets/627e95de-29a4-4ca7-8975-de0f77080454" />

## Features

- Worldwide location search (city, zip, address)
- Temperature and wind speed unit auto-detection based on country, with manual override
- 12 display fields: temp, cloud cover, wind speed, humidity, feels like, precipitation, air pressure, wind gusts, wind direction, UV index, condition text, rain chance
- Icon mode (emoji prefix) or plain text
- Left/center/right bar alignment
- Configurable refresh interval (default 5 min)
- Location name with configurable theme color
- All settings apply instantly — no restart needed
- Respects OpenCode theme colors

## Installation

Add to your OpenCode plugin config:

```json
{
  "plugin": ["github:squirrelrat/opencode-weather"]
}
```

## Usage

### Keybindings

| Shortcut | Action |
|----------|--------|
| `Alt+W` | Open weather settings |

### Slash Commands

| Command | Action |
|---------|--------|
| `/weather` | Open settings |
| `/weather-location` | Set location |
| `/weather-refresh` | Force refresh |

## Configuration

Settings are stored in OpenCode's KV store and configurable via the settings dialog (`Alt+W`) or slash commands.

<img width="480" height="345" alt="image" src="https://github.com/user-attachments/assets/b597b647-394f-4850-9970-3a08ff70eac0" />

### KV Keys

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `weather_lat` | number | — | Latitude |
| `weather_lon` | number | — | Longitude |
| `weather_city` | string | — | Display city name |
| `weather_country_code` | string | — | ISO country code (unit auto-detection) |
| `weather_temp_unit` | `"C"` \| `"F"` \| `"auto"` | auto | Temperature unit |
| `weather_wind_unit` | `"km/h"` \| `"mph"` \| `"auto"` | auto | Wind speed unit |
| `weather_interval` | number | 5 | Refresh interval in minutes |
| `weather_alignment` | `"left"` \| `"center"` \| `"right"` | left | Bar alignment |
| `weather_fields` | string[] | `["temp","cloud","wind","humidity","rain_chance"]` | Display fields (order preserved) |
| `weather_show_hint` | boolean | false | Show Alt+W hint in widget |
| `weather_show_icons` | boolean | false | Use emoji icon prefixes |
| `weather_show_location` | boolean | true | Show city name |
| `weather_location_color` | string | accent | Theme color for location name |

### Display Fields

`temp` · `cloud` · `wind` · `humidity` · `feels_like` · `precip` · `pressure` · `wind_gust` · `wind_dir` · `uv_index` · `condition` · `rain_chance`

Example — show only temperature and humidity:

```json
"weather_fields": ["temp", "humidity"]
```

## Development

```bash
bun install
bun run typecheck
```

No build step — OpenCode loads TSX directly via the plugin exports (`"exports": { "./tui": "./src/index.tsx" }`).

For local development, use a local path reference:

```json
{
  "plugin": ["/path/to/OpenCode-Weather"]
}
```

### Project Structure

```
src/
  index.tsx    Plugin entry — commands, keybindings, widget slot
  display.tsx  WeatherWidget component (SolidJS reactive)
  settings.tsx Settings dialogs
  weather.ts   Open-Meteo forecast API
  geocode.ts   Open-Meteo geocoding (city search)
  config.ts    Types, constants, defaults
```
