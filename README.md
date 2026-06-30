# CourierChat

Ephemeral chat rooms with basic anonymity. WebRTC-based peer-to-peer messaging with no persistent storage. Identities can be freely claimed and abandoned. Only session-identifier cookies are used.

## Stack

- **Framework:** Nuxt 4 (current stable) + Nitro (full-stack, all-in-one process)
- **Language:** TypeScript (strict mode)
- **State:** Pinia (cross-cutting domain state) + Nuxt `useState` (feature-local ephemeral state)
- **Styling:** Tailwind CSS + plain CSS
- **Testing:** Vitest
- **Linting:** ESLint (`@nuxtjs/eslint-config-typescript`)
- **Transport:** WebRTC DataChannels (see `docs/adrs/0002-webrtc-transport-and-signaling.md`)
- **License:** AGPL-3.0

## Development

```bash
npm install
npm run dev
```

The dev server starts on `http://localhost:3000`.

### Other commands

| Command | Description |
| --- | --- |
| `npm run build` | Production build |
| `npm run preview` | Preview the production build |
| `npm run test` | Run unit tests once |
| `npm run test:watch` | Run unit tests in watch mode |
| `npm run lint` | Lint with ESLint |
| `npm run typecheck` | Type-check with vue-tsc |

### Docker

```bash
docker compose up
```

Runs the dev server with hot reload via volume mounts. Exposes port 3000 (HTTP) and 3478/udp (in-process STUN, reserved for ADR 0002 implementation).

## Architecture

This project follows domain-driven design principles. Features are grouped together; each feature bundles its own components, composables, stores, services, types, and tests. Nuxt conventions are followed for placement and naming where they apply.

See `docs/adrs/` for architecture decisions:

- `0001-technology-stack-migration.md` — Nuxt + TypeScript + Docker migration
- `0002-webrtc-transport-and-signaling.md` — WebRTC transport, signaling, star topology, in-process STUN

## License

GNU Affero General Public License v3.0. See `LICENSE`.