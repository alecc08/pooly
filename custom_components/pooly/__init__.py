"""The Pooly integration."""
from __future__ import annotations

from homeassistant.config_entries import ConfigEntry
from homeassistant.const import CONF_API_KEY, CONF_URL, Platform
from homeassistant.core import HomeAssistant

from .coordinator import PoolyDataUpdateCoordinator

PLATFORMS: list[Platform] = [Platform.SENSOR]

type PoolyConfigEntry = ConfigEntry[PoolyDataUpdateCoordinator]


async def async_setup_entry(hass: HomeAssistant, entry: PoolyConfigEntry) -> bool:
    coordinator = PoolyDataUpdateCoordinator(
        hass, entry.data[CONF_URL], entry.data[CONF_API_KEY]
    )
    await coordinator.async_config_entry_first_refresh()

    entry.runtime_data = coordinator
    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)
    return True


async def async_unload_entry(hass: HomeAssistant, entry: PoolyConfigEntry) -> bool:
    return await hass.config_entries.async_unload_platforms(entry, PLATFORMS)
