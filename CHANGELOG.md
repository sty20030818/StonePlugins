# Changelog

All notable changes follow [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and use [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.3.3] - 2026-08-27

### Added

- Added a maintenance-only methodology index with triggers, counter-signals, conflicts, source provenance, lifecycle gates, and decision-focused evaluation cases.
- Added conditional guidance for substitutable behavior contracts and shared contract tests, legacy characterization tests, structure-versus-behavior sequencing, and migration strategy selection.

### Changed

- Added one concise core route for methodology comparison, rule maintenance, and fixed evaluations while keeping the full methodology material out of Hook injection.

## [0.3.2] - 2026-08-27

### Changed

- Renamed the visible Skill to `Stonefish Engineering` while keeping the conversational name `石头鱼的工程规则` and the stable technical identifier `stonefish-engineering`.
- Clarified compact-session, subagent, per-prompt, and multi-Hook behavior against the current Codex Hooks contract.
- Added focused guidance for test integrity, flaky tests, failure semantics, security and privacy boundaries, lightweight threat modeling, external side effects, cross-module completion, documentation sync, accessibility basics, and evidence-stall recovery.
- Kept task-external debt read-only by default instead of requiring automatic `TODO` edits.
- Added release validation that keeps the repository package, lockfile, and plugin manifest versions aligned.

## [0.3.1] - 2026-08-27

### Changed

- Renamed the user-facing product from `石头鱼工程工作流` to `石头鱼的工程规则`.
- Polished the Chinese descriptions, starter prompts, Hook messages, and Skill metadata.

## [0.3.0] - 2026-08-26

### Changed

- Localized the plugin page, starter prompts, capability labels, and Hook status messages into Chinese.
- Renamed the visible Skill from `长期工程准则` to `工程设计、实现与验证` while keeping one routed engineering workflow.

## [0.2.1] - 2026-08-26

### Added

- Added a square plugin image shared by the composer icon and marketplace logo.

## [0.2.0] - 2026-08-26

### Changed

- Migrated Hook development, tests, and repository validation to statically checked TypeScript.
- Kept the published Hook dependency-free by committing its generated `.mjs` runtime artifact.

## [0.1.0] - 2026-08-26

### Added

- `stonefish-engineering` Skill with architecture, change-boundary, and verification references.
- Codex lifecycle Hooks for session start, subagent start, and lightweight per-prompt reminders.
- Git-backed Codex marketplace metadata.
- Dependency-free Hook tests and repository validation.

[Unreleased]: https://github.com/sty20030818/stonefish-codex-plugins/compare/v0.3.3...HEAD
[0.3.3]: https://github.com/sty20030818/stonefish-codex-plugins/compare/v0.3.2...v0.3.3
[0.3.2]: https://github.com/sty20030818/stonefish-codex-plugins/compare/v0.3.1...v0.3.2
[0.3.1]: https://github.com/sty20030818/stonefish-codex-plugins/compare/v0.3.0...v0.3.1
[0.3.0]: https://github.com/sty20030818/stonefish-codex-plugins/compare/v0.2.1...v0.3.0
[0.2.1]: https://github.com/sty20030818/stonefish-codex-plugins/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/sty20030818/stonefish-codex-plugins/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/sty20030818/stonefish-codex-plugins/releases/tag/v0.1.0
