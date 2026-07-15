"""Sensor platform for Pooly."""
from __future__ import annotations

from homeassistant.components.sensor import SensorEntity
from homeassistant.core import HomeAssistant
from homeassistant.helpers.device_registry import DeviceInfo
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from . import PoolyConfigEntry
from .const import DOMAIN, FIELD_META, FIELD_NAMES
from .coordinator import PoolyDataUpdateCoordinator


async def async_setup_entry(
    hass: HomeAssistant,
    entry: PoolyConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    coordinator = entry.runtime_data
    entities: list[PoolySensor] = []
    for installation_id, installation in coordinator.data.items():
        for field, value in installation["fields"].items():
            if field not in FIELD_META or not value:
                continue
            entities.append(
                PoolySensor(coordinator, entry.entry_id, installation_id, field)
            )
    async_add_entities(entities)


class PoolySensor(CoordinatorEntity[PoolyDataUpdateCoordinator], SensorEntity):
    """A single measurement field for a single installation."""

    _attr_has_entity_name = True

    def __init__(
        self,
        coordinator: PoolyDataUpdateCoordinator,
        entry_id: str,
        installation_id: int,
        field: str,
    ) -> None:
        super().__init__(coordinator)
        self._installation_id = installation_id
        self._field = field

        device_class, state_class, icon = FIELD_META[field]
        self._attr_device_class = device_class
        self._attr_state_class = state_class
        self._attr_icon = icon
        self._attr_name = FIELD_NAMES[field]
        self._attr_unique_id = f"{entry_id}_{installation_id}_{field}"

    @property
    def _installation(self) -> dict | None:
        return self.coordinator.data.get(self._installation_id)

    @property
    def _field_value(self) -> dict | None:
        installation = self._installation
        if not installation:
            return None
        return installation["fields"].get(self._field)

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
        return super().available and self._field_value is not None

    @property
    def native_value(self) -> float | None:
        value = self._field_value
        return value["value"] if value else None

    @property
    def native_unit_of_measurement(self) -> str | None:
        value = self._field_value
        return value.get("unit") if value else None

    @property
    def extra_state_attributes(self) -> dict | None:
        value = self._field_value
        if not value:
            return None
        return {"date": value["date"]}
