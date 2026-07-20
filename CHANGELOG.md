# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

## [0.1.1] - 2026-07-20

### Added

- Dashboard tiles for CYA/stabilizer and hardness alongside the existing pH, chlorine/bromine, TAC, and temperature tiles (#11).
- A "Simulator" tool for freestyle what-if dosage estimates and a pool heating-energy (kWh) calculator, without needing a saved installation reading (#11).

### Changed

- **Breaking:** renamed the Home Assistant integration's domain from `pooly` to `homepool` to match the web app's rebrand. If you already had the integration installed, entity IDs change from `sensor.pooly_*` to `sensor.homepool_*` and the service moves from `pooly.log_measurement` to `homepool.log_measurement` — update any dashboards or automations that reference the old names, then reinstall/reload the integration (#11).

### Fixed

- Dosage recommendations now trigger as soon as a reading leaves the tighter "ideal" band, matching the dashboard's "Watch" status badge; previously a param could show a "Watch" warning on the dashboard while the Recommendations page reported everything as fine (#11).

## [0.1.0] - 2026-07-19

### Added

- Home Assistant button entities for one-tap maintenance logging (cartridge cleaning, skimmer filter cleaning, backwash, pH calibration, purge, water change) (#12).
- Home Assistant `pooly.log_measurement` service for logging water measurements from a dashboard, script, or automation (#12).
- Versioning and release CI/CD pipeline: tags and GitHub Releases are cut automatically on merge to `main`, with the version bump driven by a `release:patch` / `release:minor` / `release:major` / `release:no-release` PR label (#18).

### Changed

- Removed the "pool condition" (clear/cloudy/green) card from the main dashboard; it was based on a simplistic heuristic that didn't reliably reflect actual water condition (#13).
