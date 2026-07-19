# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

## [0.1.0] - 2026-07-19

### Added

- Home Assistant button entities for one-tap maintenance logging (cartridge cleaning, skimmer filter cleaning, backwash, pH calibration, purge, water change) (#12).
- Home Assistant `pooly.log_measurement` service for logging water measurements from a dashboard, script, or automation (#12).
- Versioning and release CI/CD pipeline: tags and GitHub Releases are cut automatically on merge to `main`, with the version bump driven by a `release:patch` / `release:minor` / `release:major` / `release:no-release` PR label (#18).

### Changed

- Removed the "pool condition" (clear/cloudy/green) card from the main dashboard; it was based on a simplistic heuristic that didn't reliably reflect actual water condition (#13).
