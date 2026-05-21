/** @jsxImportSource @opentui/solid */
import type { TuiPlugin, TuiPluginModule } from "@opencode-ai/plugin/tui"
import { createSignal } from "solid-js"
import { WeatherWidget } from "./display.js"
import { showWeatherSettings, showLocationPicker } from "./settings.js"

const PLUGIN_ID = "opencode-weather"

const tui: TuiPlugin = async (api) => {
  const [refreshVersion, setRefreshVersion] = createSignal(0)
  const [configVersion, setConfigVersion] = createSignal(0)

  api.keymap.registerLayer({
    commands: [
      {
        namespace: "palette",
        name: "weather.settings",
        title: "Open weather settings",
        description: "Configure weather location, units, display fields, and more",
        category: "Weather",
        slashName: "weather",
        run: () => showWeatherSettings(api),
      },
      {
        namespace: "palette",
        name: "weather.set_location",
        title: "Set weather location",
        description: "Search and set your weather location (city, zip, or address)",
        category: "Weather",
        slashName: "weather-location",
        run: () => showLocationPicker(api),
      },
      {
        namespace: "palette",
        name: "weather.refresh",
        title: "Refresh weather",
        description: "Force weather data refresh now",
        category: "Weather",
        slashName: "weather-refresh",
        run: () => setRefreshVersion((v) => v + 1),
      },
      {
        namespace: "palette",
        name: "weather.config_reload",
        title: "Reload weather config",
        description: "Reload display settings without re-fetching weather data",
        category: "Weather",
        slashName: "weather-config",
        run: () => setConfigVersion((v) => v + 1),
      },
    ],
    bindings: [
      { key: "alt+w", cmd: "weather.settings", desc: "Open weather settings" },
    ],
  })

  api.slots.register({
    order: 500,
    slots: {
      app_bottom() {
        return <WeatherWidget api={api} refreshVersion={refreshVersion} configVersion={configVersion} />
      },
    },
  })
}

const plugin: TuiPluginModule & { id: string } = { id: PLUGIN_ID, tui }
export default plugin
