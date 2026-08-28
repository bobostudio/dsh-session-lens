# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-08-19

### Added

- Session insights view (new in-conversation tab): five-way token breakdown
  (input / output / cache read / cache write / thinking), per-turn timeline,
  tool call statistics, and activity stats (compactions, approvals, sub-agents,
  LLM retries)
- Live mode: auto-refresh every 5 seconds while the session is running
- One-click export to a self-contained, zero-JavaScript single-file HTML
  replay (inline SVG charts, native `<details>` folds), with bilingual
  (zh/en) interface and selectable export language
- Theme selection for exported HTML
- Privacy-safe export: redaction of sensitive paths and tokens
- Headless degradation: plugin survives missing optional services
