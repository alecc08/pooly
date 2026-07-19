"""Button platform for Pooly maintenance quick-actions."""
from __future__ import annotations

from homeassistant.components.button import ButtonEntity
from homeassistant.core import HomeAssistant
from homeassistant.helpers.device_registry import DeviceInfo
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from . import PoolyConfigEntry
from .const import BUTTON_META, DOMAIN
from .coordinator import PoolyDataUpdateCoordinator


async def async_setup_entry(
    hass: HomeAssistant,
    entry: PoolyConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    coordinator = entry.runtime_data
    entities: list[ButtonEntity] = []
    for installation_id in coordinator.data:
        for action_type in BUTTON_META:
            entities.append(
                PoolyMaintenanceButton(coordinator, entry.entry_id, installation_id, action_type)
            )
    async_add_entities(entities)


class PoolyMaintenanceButton(CoordinatorEntity[PoolyDataUpdateCoordinator], ButtonEntity):
    """Logs a maintenance action for a single installation on press."""

    _attr_has_entity_name = True

    def __init__(
        self,
        coordinator: PoolyDataUpdateCoordinator,
        entry_id: str,
        installation_id: int,
        action_type: str,
    ) -> None:
        super().__init__(coordinator)
        self._installation_id = installation_id
        self._action_type = action_type

        icon, name = BUTTON_META[action_type]
        self._attr_icon = icon
        self._attr_name = name
        self._attr_unique_id = f"{entry_id}_{installation_id}_button_{action_type}"

    @property
    def _installation(self) -> dict | None:
        return self.coordinator.data.get(self._installation_id)

    @property
    def device_info(self) -> DeviceInfo | None:
        installation = self._installation
        if not installation:
            return None
        return DeviceInfo(
            identifiers={(DOMAIN, str(self._installation_id))},
            name=installation["name"],
            manufacturer="Pooly",
            model=installation["type"].capitalize(),
        )

    @property
    def available(self) -> bool:
        return super().available and self._installation is not None

    async def async_press(self) -> None:
        await self.coordinator.client.create_maintenance(self._installation_id, self._action_type)
        await self.coordinator.async_request_refresh()
