# Changelog

## [0.1.1](https://github.com/afroze9/terrastudio/compare/v0.1.0...v0.1.1) (2026-02-20)


### Features

* add Storage Account, App Service, Key Vault resources + resolveTerraformType ([b904e2d](https://github.com/afroze9/terrastudio/commit/b904e2d8ac350562ecc8e792faafaa8aec566c92))
* add welcome screen with recent projects ([066b8ef](https://github.com/afroze9/terrastudio/commit/066b8efa3fbdb00f831036816f4dbb8d38cb6741))
* auto-layout, edge styles, canvas toolbar, and container resize improvements ([6e12d14](https://github.com/afroze9/terrastudio/commit/6e12d140c184d2894b432f1b3c9de5a065dec224))
* compute plugin, container nodes, cross-plugin connections (Phase 6) ([1ea7365](https://github.com/afroze9/terrastudio/commit/1ea73659eae47ae686662918430dd7d98ef7325c))
* custom app icon, titlebar branding, and window state persistence ([2480e4f](https://github.com/afroze9/terrastudio/commit/2480e4fc5d07cbe0d40d583fbb8c59a54e10fd51))
* dark/light mode, SVG export, and multi-theme system with 8 palettes ([f73316c](https://github.com/afroze9/terrastudio/commit/f73316cdaa440c4f0340f327bdb196d7e1b37f98))
* Phase 10 - diagram export (PNG, clipboard) and doc generation ([56032cb](https://github.com/afroze9/terrastudio/commit/56032cba21cbdd41539aa7edd7cfe6cf434bc893))
* Phase 11 - frameless UI, collapsible palette, container styling, hover tooltips ([faf1ed3](https://github.com/afroze9/terrastudio/commit/faf1ed3e204481fbf1c693e63a9c11c15811e8b1))
* Phase 12 - handle labels, edge labels, connection validation ([16263a4](https://github.com/afroze9/terrastudio/commit/16263a4cff6c4b5372cf753af2659f5a49fdd568))
* Phase 15 - resource output bindings with decoupled acceptsOutputs system ([53e6afd](https://github.com/afroze9/terrastudio/commit/53e6afdf55a2017871add4bdf77db4d69a873592))
* Phase 16 - subscription container, variable management, tfvars generation ([45563fb](https://github.com/afroze9/terrastudio/commit/45563fbef9bf2075968cefb5fbd88765aa73c108))
* Phase 17 - auto-CIDR assignment, overlap detection, and CIDR validation ([da920a1](https://github.com/afroze9/terrastudio/commit/da920a1593e5c39076e791ff9b6f1295250f4315))
* Phase 7 - project system and terraform execution ([dda591f](https://github.com/afroze9/terrastudio/commit/dda591fe2981add4db0387b6dc4469e4308bd6f4))
* Phase 8 - deployment status on diagram nodes ([5849ca0](https://github.com/afroze9/terrastudio/commit/5849ca0faa584173083e949560cf1025f267cbf0))
* Phase 9 - undo/redo, validation, dirty tracking, keyboard shortcuts ([8ba1a74](https://github.com/afroze9/terrastudio/commit/8ba1a74374b21fa7877433f09f7fe6e1fa5493d5))
* replace generated icons with official Azure SVGs, make icon optional ([735e253](https://github.com/afroze9/terrastudio/commit/735e253c27057b2e66851b94b7ab453cfaf4a272))
* scaffold Tauri 2 desktop app with Svelte Flow canvas (Phase 4) ([b4091a7](https://github.com/afroze9/terrastudio/commit/b4091a787adc610b890474126bf23f9b363c348c))
* schema-driven PropertyRenderer, DeploymentBadge, keyboard delete (Phase 5) ([15ae025](https://github.com/afroze9/terrastudio/commit/15ae0257e79cbecab67888d5606b7783154b2ca3))
* storage resources, snap-to-grid, app settings panel, and official Azure icons ([11dba59](https://github.com/afroze9/terrastudio/commit/11dba5946f94272425450c1c081d1430a11bfe5a))
* VS Code-style UI restructure with activity bar, editor tabs, and menus ([2e221db](https://github.com/afroze9/terrastudio/commit/2e221dbf38c5511ae9d9fbf8d955e7a807a83c3a))


### Bug Fixes

* add @tauri-apps/cli devDependency and tauri script to desktop app ([c1dc73e](https://github.com/afroze9/terrastudio/commit/c1dc73e0f26a385a02c55fee3ad6f1e0da1fbe09))
* add DefaultResourceNode component so dropped nodes render on canvas ([391ce37](https://github.com/afroze9/terrastudio/commit/391ce37e6fb5c81d8ee5ae9631032cb56a5d95b1))
* align PNG export with official Svelte Flow approach ([e8ee0a9](https://github.com/afroze9/terrastudio/commit/e8ee0a99b692926c679d3da49658b3f33271c84e))
* container nodes get explicit dimensions, subnet is now a container ([8a99b00](https://github.com/afroze9/terrastudio/commit/8a99b00b95ed1289a1cbdc6f588d46630a5d647d))
* debounce property edits so typing coalesces into one undo step ([2c9182f](https://github.com/afroze9/terrastudio/commit/2c9182f99a74be2fb4cb547df43cd4ae65cb1a4d))
* dynamic reparenting on drag and scaled container defaults ([6f76cdf](https://github.com/afroze9/terrastudio/commit/6f76cdfc8ca603e973a464e25a7142195927e6b4))
* enable HTML5 drag-drop in Tauri WebView2 ([13245f7](https://github.com/afroze9/terrastudio/commit/13245f765a6e71c9ac009b245c3638a7b05090e7))
* flip container relationship to canBeChildOf, fix nested nesting ([efd40f1](https://github.com/afroze9/terrastudio/commit/efd40f16d4f7169ad36fe1c3491f8382bba963a4))
* move drag-drop handlers to DOM wrapper element ([909a090](https://github.com/afroze9/terrastudio/commit/909a090d82375541fe3872b21da69dc639f1880f))
* resolve drag-and-drop from palette to canvas ([6081f1d](https://github.com/afroze9/terrastudio/commit/6081f1d97ce98cecf76a9a90b763c1d51f45bb6b))
* resolve type errors and node position persistence ([8f56f98](https://github.com/afroze9/terrastudio/commit/8f56f98c511ac6a86751e5768ce7d2bd961fcdec))
* rewrite undo/redo to snapshot after mutations ([02ae0f8](https://github.com/afroze9/terrastudio/commit/02ae0f8c219e5a8128d39b94efeef136fc9d319e))
* undo/redo structuredClone error and select-all delete ([5749bba](https://github.com/afroze9/terrastudio/commit/5749bbac1ec082d4e12849b9b994ff3a436c8474))
* use ResourceTypeId in diagram-converter getSchema parameter ([e0b7ecc](https://github.com/afroze9/terrastudio/commit/e0b7eccb8f13583c186c9bd12439ad9317dd96ee))
