# ADR 0001: Technology stack migration to Nuxt + TypeScript, with Docker

Date: 2026-06-30
Status: Proposed (amended at scaffolding time: Nuxt 4 adopted as current stable)

## Context

The current implementation is a legacy scaffold: AngularJS 1.x client (generated
from the HotTouel Angular generator) served by a plain Express server
(src/server/app.js), with Gulp, Bower, Karma/Mocha/Chai/Sinon, and PhantomJS.
The project is provisioned via Vagrant (Vagrantfile + vagrant-provision.sh).
Dependencies are significantly outdated (AngularJS 1.x, Bower, Gulp 3, PhantomJS,
etc.).

CourierChat is being redesigned with WebRTC transport (see ADR 0002). The
existing client, build tooling, and provisioning are not suitable for the new
architecture and must be replaced. The server needs to host signaling,
coordination, an in-process STUN server, and a WebSocket relay fallback,
ideally as a single all-in-one process.

## Decision

Replace the existing stack with Nuxt 3 (current stable) and the latest
supported version of TypeScript, organized using domain-driven design
principles. Replace Vagrant-based provisioning with Docker.

### Stack

- Runtime: Node.js (current LTS).
- Framework: Nuxt (current stable; resolved to Nuxt 4 at scaffolding time,
  since "current stable" was the intent rather than pinning to Nuxt 3 by
  version number), used in full-stack mode (Nitro server routes for the
  signaling/coordination/STUN/relay services described in ADR 0002). This
  keeps the deployment all-in-one.
- Language: TypeScript, latest stable, with strict compiler settings
  (`"strict": true` and related flags).
- Unit tests: Vitest, co-located with features (each feature directory contains
  its own `*.test.ts` files alongside the source). Vitest is used for both
  domain-logic unit tests and Vue component tests; Jest is dropped.
- Styling: Tailwind CSS, supplemented with plain CSS where needed. Existing
  preprocessor-based styles (Sass/Less per the legacy gulp config) are not
  carried forward.

### Project organization (domain-driven design)

- Nuxt conventions are followed for placement and file naming where they apply
  (e.g. `app.vue`, page files under `pages/`, `nuxt.config.ts`, auto-imported
  composables, Nitro server routes under `server/`). This preserves framework
  ergonomics, auto-imports, and tooling support.
- Where Nuxt allows flexibility, code is grouped by feature (domain) rather
  than by technical role. For example, components for the rooms feature live
  together under a feature-named directory, server routes for the signaling
  feature live together under `server/routes/` grouped by feature, and so on.
- Each feature is self-contained to the extent Nuxt permits: it bundles its own
  components, composables, stores (Pinia), services, types, and tests rather
  than splitting them across top-level directories by role. Where Nuxt's
  directory conventions force a particular location (e.g. pages must be under
  `pages/`), the file is placed at the framework-required location and
  delegated to the feature via a thin wrapper or named import from the feature
  directory.
- The principle: follow Nuxt first, group by feature where the framework
  permits, never fight the framework's required structure.

### Naming conventions

- Classes, interfaces, and most TypeScript source files use StartCased
  filenames (e.g. `ChatRoom.ts`, `UsernameRegistry.ts`).
- This applies to class/interface/type source files. Vue component files
  follow Nuxt component naming conventions unless they contain a
  class/interface definition, in which case StartCased applies.

### Strict TypeScript settings

- `"strict": true` in tsconfig, plus adjacent strict flags (`noImplicitAny`,
  `strictNullChecks`, `strictFunctionTypes`, `strictBindCallApply`,
  `strictPropertyInitialization`, `noImplicitThis`, `alwaysStrict`).
- Additional recommended strict flags (`noUnusedLocals`,
  `noUnusedParameters`, `noFallthroughCasesInSwitch`) to be enabled unless
  they conflict with Nuxt-generated code.

### Docker (replaces Vagrant)

- A `Dockerfile` (multi-stage: deps -> build -> runtime) builds and runs the
  Nuxt app for both development and production parity.
- A `docker-compose.yml` provides a single-service definition for local
  development with hot reload via volume mounts.
- The Vagrantfile and vagrant-provision.sh are removed once the Docker setup
  is functional.
- Exposed ports: the Nuxt/Nitro server port (configurable). The in-process
  STUN UDP port (see ADR 0002) is exposed in the compose definition.
- No external services (no Redis, no separate DB) are required for the
  all-in-one deployment, consistent with the ephemerality goals.

### Retained assets

- Existing site styles and animations under src/client/styles (and any
  style/animation assets) should be evaluated and migrated where they still
  fit the redesigned UI. The intent is to preserve the visual identity, not
  the AngularJS structure or preprocessor toolchain.

## Consequences

Positive:
- Modern, maintained framework and toolchain.
- Full-stack Nuxt keeps the deployment all-in-one (server + client + signaling
  + STUN + relay in a single process), satisfying the all-in-one preference.
- Strict TypeScript catches a broad class of defects at compile time.
- DDD-style feature grouping keeps related code together, improving
  navigability as the feature set grows.
- Docker gives reproducible local dev and production parity, replacing the
  brittle Vagrant/VirtualBox dependency.

Negative:
- Full rewrite: none of the existing AngularJS client code is reusable as-is.
  Only styles/animations and the product's visual identity carry forward.
- Migration is a clean break, not incremental. The legacy src/client and
  src/server will be removed once the Nuxt replacement is functional.
- Team must be proficient in Nuxt 3, Nitro, strict TypeScript, and Docker.

### State management (hybrid)

Decision: hybrid approach (option C).
- Nuxt's `useState` composable (auto-imported, SSR-safe; not to be confused with
  React's `useState` hook of the same name) for feature-local, ephemeral state
  such as the current room view, local typing-draft text, or modal-open flags.
  State that only one feature cares about lives with that feature.
- Pinia (Vue's official store) for cross-cutting domain state touched by
  multiple features: the authenticated username/session (WebRTC, rooms,
  signaling, and presence all read it), the global username registry mirror,
  and connection status. Shared state gets a single source of truth and Vue
  devtools visibility.
- This matches DDD: feature-local state stays inside the feature; shared
  cross-feature state gets a proper store.

## Open questions

None currently.