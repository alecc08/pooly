These assets are prepared for submission to
[home-assistant/brands](https://github.com/home-assistant/brands), which is what
populates the icon shown on the Home Assistant Integrations page for `homepool`
(HA does not read icons from this repo directly).

Source: `apps/web/src/assets/homepool-icon.svg`, converted with `rsvg-convert`.

## To submit

1. Fork `home-assistant/brands`.
2. Copy this directory's contents (`icon.png`, `icon@2x.png`) to
   `custom_integrations/homepool/` in the fork.
3. Open a PR there. See their `README.md` for size/format requirements
   (square icon, transparent or brand-color background, 256×256 and 512×512).

No `logo.png` yet — the source SVG is a square app icon, not a wordmark; add one
later if a wide logo variant is wanted.
