"""Config flow for Homepool."""
from __future__ import annotations

from typing import Any

import voluptuous as vol
from homeassistant.config_entries import ConfigFlow, ConfigFlowResult
from homeassistant.const import CONF_API_KEY, CONF_URL
from homeassistant.helpers.aiohttp_client import async_get_clientsession

from .api import HomepoolApiError, HomepoolAuthError, HomepoolClient
from .const import DOMAIN

STEP_USER_DATA_SCHEMA = vol.Schema(
    {
        vol.Required(CONF_URL): str,
        vol.Required(CONF_API_KEY): str,
    }
)


class HomepoolConfigFlow(ConfigFlow, domain=DOMAIN):
    """Handle a config flow for Homepool."""

    VERSION = 1

    async def async_step_user(
        self, user_input: dict[str, Any] | None = None
    ) -> ConfigFlowResult:
        errors: dict[str, str] = {}
        if user_input is not None:
            base_url = user_input[CONF_URL].rstrip("/")
            api_key = user_input[CONF_API_KEY]
            client = HomepoolClient(async_get_clientsession(self.hass), base_url, api_key)
            try:
                installations = await client.list_installations()
            except HomepoolAuthError:
                errors["base"] = "invalid_auth"
            except HomepoolApiError:
                errors["base"] = "cannot_connect"
            else:
                if not installations:
                    errors["base"] = "no_installations"
                else:
                    await self.async_set_unique_id(f"{base_url}:{api_key}")
                    self._abort_if_unique_id_configured()
                    return self.async_create_entry(
                        title="Homepool",
                        data={CONF_URL: base_url, CONF_API_KEY: api_key},
                    )

        return self.async_show_form(
            step_id="user", data_schema=STEP_USER_DATA_SCHEMA, errors=errors
        )
