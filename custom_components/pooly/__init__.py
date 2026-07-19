"""The Pooly integration."""
from __future__ import annotations

import voluptuous as vol
from homeassistant.config_entries import ConfigEntry, ConfigEntryState
from homeassistant.const import CONF_API_KEY, CONF_URL, Platform
from homeassistant.core import HomeAssistant, ServiceCall
from homeassistant.exceptions import HomeAssistantError
from homeassistant.helpers import config_validation as cv

from .api import PoolyApiError
from .const import DOMAIN
from .coordinator import PoolyDataUpdateCoordinator

PLATFORMS: list[Platform] = [Platform.SENSOR, Platform.BUTTON]

SERVICE_LOG_MEASUREMENT = "log_measurement"

SERVICE_LOG_MEASUREMENT_SCHEMA = vol.Schema(
    {
        vol.Required("installation_id"): cv.positive_int,
        vol.Optional("ph"): vol.Coerce(float),
        vol.Optional("chlorine"): vol.Coerce(float),
        vol.Optional("bromine"): vol.Coerce(float),
        vol.Optional("tac"): vol.Coerce(float),
        vol.Optional("hardness"): vol.Coerce(float),
        vol.Optional("salt"): vol.Coerce(float),
        vol.Optional("stabilizer"): vol.Coerce(float),
        vol.Optional("cc"): vol.Coerce(float),
        vol.Optional("temp"): vol.Coerce(float),
        vol.Optional("notes"): cv.string,
    }
)

type PoolyConfigEntry = ConfigEntry[PoolyDataUpdateCoordinator]


async def async_setup_entry(hass: HomeAssistant, entry: PoolyConfigEntry) -> bool:
    coordinator = PoolyDataUpdateCoordinator(
        hass, entry.data[CONF_URL], entry.data[CONF_API_KEY]
    )
    await coordinator.async_config_entry_first_refresh()

    entry.runtime_data = coordinator
    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)

    if not hass.services.has_service(DOMAIN, SERVICE_LOG_MEASUREMENT):
        async def _async_log_measurement(call: ServiceCall) -> None:
            installation_id = call.data["installation_id"]
            fields = {
                k: v for k, v in call.data.items()
                if k not in ("installation_id",)
            }
            for candidate_entry in hass.config_entries.async_entries(DOMAIN):
                candidate_coordinator = candidate_entry.runtime_data
                if candidate_coordinator is None or installation_id not in candidate_coordinator.data:
                    continue
                try:
                    await candidate_coordinator.client.create_measurement(installation_id, **fields)
                except PoolyApiError as err:
                    raise HomeAssistantError(str(err)) from err
                await candidate_coordinator.async_request_refresh()
                return
            raise HomeAssistantError(f"Unknown Pooly installation_id: {installation_id}")

        hass.services.async_register(
            DOMAIN, SERVICE_LOG_MEASUREMENT, _async_log_measurement, schema=SERVICE_LOG_MEASUREMENT_SCHEMA
        )

    return True


async def async_unload_entry(hass: HomeAssistant, entry: PoolyConfigEntry) -> bool:
    unloaded = await hass.config_entries.async_unload_platforms(entry, PLATFORMS)
    if unloaded:
        other_loaded = [
            e for e in hass.config_entries.async_entries(DOMAIN)
            if e.entry_id != entry.entry_id and e.state is ConfigEntryState.LOADED
        ]
        if not other_loaded:
            hass.services.async_remove(DOMAIN, SERVICE_LOG_MEASUREMENT)
    return unloaded
