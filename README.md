<p align="center">
  <img src="public/courierchat.svg" alt="CourierChat" width="120">
</p>

# CourierChat

Ephemeral chat rooms with basic anonymity. WebRTC-based peer-to-peer messaging with no persistent storage. Identities can be freely claimed and abandoned.

## Features

- **P2P messaging** — WebRTC DataChannels with automatic mesh/star/relay topology selection based on room size
- **Direct file transfer** — chunked peer-to-peer file sending over a dedicated DataChannel with progress indicators and backpressure handling
- **Typing indicators** — real-time "user is typing" display scoped to room membership
- **Presence** — online/offline status broadcast across the signaling layer
- **Message delivery status** — per-message send confirmation using `RtcManager.broadcast()` return values
- **Toast notifications** — non-intrusive UI for signaling errors, file transfer failures, and room lifecycle events
- **Tier-based room access** — minor/adult tier isolation enforced on room join (server-side check against client-declared tiers)
- **In-process STUN server** — RFC 5389 binding request/response for ICE candidate gathering

## Stack

- **Framework:** Nuxt 4 + Nitro (full-stack, all-in-one process)
- **Language:** TypeScript (strict mode, `noUnusedLocals`, `noUnusedParameters`)
- **State:** Pinia (cross-cutting domain state) + Nuxt `useState` (feature-local ephemeral state)
- **Styling:** Tailwind CSS + plain CSS
- **Testing:** Vitest (440 tests) with `@vitest/coverage-v8`
- **Linting:** ESLint (`@nuxtjs/eslint-config-typescript`)
- **Transport:** WebRTC DataChannels (see `docs/adrs/0002-webrtc-transport-and-signaling.md`)
- **License:** AGPL-3.0

## Development

```bash
npm install
npm run dev
```

The dev server starts on `http://localhost:3000`.

### Commands

| Command | Description |
| --- | --- |
| `npm run dev` | Start dev server with hot reload |
| `npm run build` | Production build |
| `npm run preview` | Preview the production build |
| `npm run test` | Run unit tests once |
| `npm run test:watch` | Run unit tests in watch mode |
| `npm run test:coverage` | Run unit tests with coverage report |
| `npm run lint` | Lint with ESLint |
| `npm run typecheck` | Type-check with vue-tsc |

### Docker

```bash
docker compose up
```

Runs the dev server with hot reload via volume mounts. Exposes port 3000 (HTTP) and 3478/udp (in-process STUN).

## Architecture

This project follows domain-driven design principles. Features are grouped together; each feature bundles its own components, composables, stores, services, types, and tests. Nuxt conventions are followed for placement and naming where they apply.

```text
app/
  components/          # Auto-imported Vue components (shell/, rooms/)
  composables/         # Auto-imported composables
  features/
    room/              # Chat domain (types, composables)
    transport/         # WebRTC transport layer
      composables/     # useSignaling, useRoomTransport, useFileTransfer
      services/        # RtcManager, SignalingClient, FileTransferManager
      types/           # Transport enums and interfaces
  middleware/          # Route guards (auth, decideAuth)
  pages/               # File-based routing
  plugins/             # Nuxt plugins (session revalidation)
  stores/              # Pinia stores (Session, Rooms, Connection, Presence, Notifications)
server/
  routes/              # WebSocket signaling handler, API routes
  services/            # SignalingServer, RoomRegistry, UsernameRegistry, StunServer, HubElectionStrategy
  plugins/             # STUN server bootstrap
shared/
  types/               # Shared types (Signaling, Tier, FileTransfer, etc.)
test/                  # Integration tests
docs/
  adrs/                # Architecture Decision Records
```

See `docs/adrs/` for architecture decisions:

- `0001-technology-stack-migration.md` — Nuxt + TypeScript + Docker migration
- `0002-webrtc-transport-and-signaling.md` — WebRTC transport, signaling, star topology, in-process STUN

## License

GNU Affero General Public License v3.0. See `LICENSE`.
