# ADR 0002: WebRTC transport and signaling strategy

Date: 2026-06-30
Status: Proposed

## Context

CourierChat is a social chat room site with basic anonymity. Per the README,
connections are encrypted, messages are not persisted, identities can be freely
claimed and abandoned, and only session-identifier cookies are used.

The current implementation (src/server/app.js) is an Express app serving a
legacy AngularJS client. Chat transport is not WebRTC-based. We want to
introduce WebRTC DataChannels as the primary message transport so messages flow
peer-to-peer and are never stored server-side, reinforcing the ephemerality and
anonymity goals.

Connectivity constraints: the deployment must not require external STUN or TURN
infrastructure. An in-process STUN server is acceptable (see below); external
STUN/TURN and any form of TURN relay are out of scope.

This ADR depends on ADR 0001 (the Nuxt 3 + Nitro all-in-one server hosts the
signaling, coordination, in-process STUN, and relay services described here).

## Decision

Adopt a hybrid WebRTC DataChannel / WebSocket relay transport, with a
co-located signaling and coordination server, and an optional in-process STUN
server. No external STUN. No TURN.

### Architecture

1. Signaling & coordination server (co-located with the Nuxt/Nitro server, see
   ADR 0001):
   - Tracks active rooms (in-memory only; rooms are destroyed when empty).
   - Tracks claimed usernames in a global (site-wide) registry; a username is
     unique across the entire service regardless of which room its owner
     occupies.
   - Relays SDP offers/answers and ICE candidates between peers joining a room.
   - Enforces username uniqueness at claim time.
   - Fallback WebSocket relay for messages in rooms that exceed the mesh
     threshold (see below).

2. WebRTC client:
   - `RTCPeerConnection` per remote peer in the room (full mesh) for small
     rooms.
   - `RTCDataChannel` for text message transport (ordered, reliable).
   - ICE configuration: optional in-process STUN server only. No TURN.
   - Signaling messages carried over the same WebSocket used for coordination.

3. In-process STUN server:
   - Runs in the same process as the signaling/coordination server using Node's
     `dgram` UDP socket (or an equivalent library).
   - Clients reference it via `stun:<host>:<port>`.
   - Sufficient for some NAT types (full-cone, restricted-cone). Does not solve
     symmetric NAT or strict firewalls (those require TURN).
   - In-process TURN is not pursued and is explicitly out of scope. Reasons:
     (a) no mature production-grade Node TURN library exists - `node-turn` is
     experimental/basic and maintaining non-trivial allocation/permission/channel
     state machine code in-process is not justified; (b) TURN relays traffic at
     the UDP packet level including large file transfers (this project allows
     no hard file-size limit), exposing the all-in-one process to
     hard-to-throttle bandwidth consumption; (c) TURN and the WebSocket relay
     fallback solve the same problem (peers that cannot connect directly), so
     TURN would be redundant with the existing relay design; the WS relay is
     app-level and policy-enforceable (size/rate caps) whereas TURN is not.
   - Future option, not adopted now: if TURN-grade transparency becomes
     desirable (especially once media tracks per the open question below are on
     the table), run `coturn` as a Docker Compose sidecar service rather than an
     in-process Node component. This keeps the all-in-one Nuxt process
     lightweight while still avoiding external infrastructure in dev.

4. Room scaling (no hard upper limit on participants):
   - Primary mode: star topology with an elected hub peer. The
     signaling/coordination server elects one peer per room as the hub (first
     joiner, or peer reporting best bandwidth). Other peers connect only to
     the hub. The hub retransmits each received message to all other leaves
     over DataChannel. Connection count is O(n) instead of O(n^2) for the
     mesh; a 50-peer room uses 49 peer connections instead of ~1,225.
   - Hub failover: if the hub disconnects (WebSocket close or heartbeat
     timeout), the server elects a replacement hub from the remaining peers and
     instructs leaves to reconnect. Brief message-loss window during failover
     is acceptable given the ephemerality/no-history guarantee.
   - Small-room optimization: for very small rooms (<= mesh threshold,
     recommended 8 peers) the server may keep a full mesh instead of electing
     a hub, since the connection count is trivial and mesh avoids the
     hub-as-bottleneck and hub-trust concerns at small scale. Mesh threshold is
     configurable.
   - Last-resort fallback: WebSocket relay through the server. Used only when
     no peer can serve as a reachable hub (e.g. all peers are behind NATs that
     block host candidates and STUN is insufficient). Messages transit the
     server but are still in-memory only; no persistence. This preserves room
     liveness when WebRTC connectivity is impossible, at the cost of true P2P.
   - File transfers: always WebRTC DataChannel P2P, directly between the two
     participating peers (not relayed through the hub), regardless of room
     size, to avoid consuming hub bandwidth for large payloads. For peers who
     cannot establish a direct connection (no TURN available), file transfer is
     unavailable; the UI reports this.
   - Mesh threshold is configurable, not hardcoded into the design.

5. Hub-peer trust caveat:
   - In star topology, the hub peer sees every message and could drop or
     tamper with them. Unlike the operator-controlled server in the relay
     fallback, the hub is an untrusted anonymous peer. This is an accepted
     tradeoff of pure-WebRTC scaling.
   - **Message integrity (implemented):** each client generates an ECDSA
     P-256 keypair on connect and includes its public key (SPKI DER, base64)
     in the Hello payload. The server distributes public keys to other peers
     via PeerJoined. Every chat message carries a base64 signature over the
     canonical form `id|author|content|timestamp`. Recipients verify the
     signature against the author's public key and drop the message on
     mismatch. This prevents a hub from tampering with message content
     without invalidating the signature, and also protects against tampering
     by the relay server. Verification is lenient for backward compatibility:
     unsigned messages or messages from peers with no known public key are
     delivered; only messages that have a signature AND a known public key
     that fails verification are dropped.
   - **Confidentiality (future):** end-to-end encryption between leaves
     (bypassing the hub) remains a separate future concern. The hub can
     still read message content; it cannot modify it. Sequence numbers
     (detect drops) and hub rotation remain candidates for future work.

 6. Ephemeral rooms:
   - Rooms exist only in server memory while >=1 peer is connected.
   - No message history is retained; late joiners do not receive prior
     messages.
   - Room destruction on last disconnect is implicit (no persisted state).

 7. Username reclamation:
   - Username scope is site-wide (global). A claimed username is unique across
     the entire service; no two connections may hold the same name regardless
     of which room they occupy.
   - A username is bound to a single live WebSocket connection.
   - Reclaim conditions: owning connection closes, or heartbeat times out.
   - Reclaim is automatic; the server does not require explicit logout.

 8. Additional features (in scope):
   - Typing indicators: carried over the same transport as messages.
   - Presence: online/offline state per username, broadcast on change.
   - File transfer: WebRTC DataChannel P2P (see room scaling above).

### Constraints & limits

- Without TURN, connectivity across symmetric NATs and strict firewalls is not
  guaranteed. In-process STUN expands reachability but does not make it
  universal. Cross-network use may fail for some peer pairs; this is an
  accepted tradeoff.
- Mesh WebRTC scales O(n^2) in peer connections; star topology reduces this to
  O(n) at the cost of hub bandwidth and a hub-trust caveat (see section 5).
  The WebSocket-relay fallback is reserved for when no reachable hub exists.
- File transfer is only available to peers who can establish a direct
  DataChannel (no relay path).
- No persistence: refresh/reconnect loses room membership and history. This is
  intentional and consistent with the ephemerality goal.

## Consequences

Positive:
- Messages never traverse the server in star or mesh mode; reinforces anonymity
  and ephemerality.
- No external STUN/TURN infrastructure to deploy, secure, or pay for.
- Simple local-network and small-deployment story (all-in-one process).
- Room size is unbounded via the star topology (O(n) connections) plus the
  relay fallback when WebRTC connectivity is impossible.

Negative:
- Cannot reliably reach peers across all NAT types without TURN (out of scope).
- The signaling/coordination server is a required, trusted component. It is
  the last-resort relay and also transits message content in that mode (though
  never persists it).
- Three transport modes (mesh, star, relay) add client- and server-side
  complexity; the server must pick the right mode per room and handle hub
  election/failover.
- The hub peer in star mode is untrusted. Message **tampering** is now
  prevented by ECDSA signatures (see section 5), but the hub can still
  **drop** messages (no sequence-number mechanism yet) and **read** message
  content (no E2E encryption yet).
- File transfer is degraded or unavailable for peers behind NATs that block
  host candidates and where STUN is insufficient.

## Resolved decisions

1. Mesh threshold: 8 peers. Rooms with <=8 peers use a full mesh; larger rooms
   elect a hub. Configurable via runtime configuration.
2. Hub election policy: a strategy-injection pattern with a chain of fallback
   election strategies handled by pluggable services. Election proceeds through
   the chain until a strategy yields a candidate:
   a. First-joiner strategy (used initially; always available; no peer
      self-report required).
   b. Lowest-latency strategy (peer with best round-trip to the server; used
      once latency can be measured).
   c. Highest-reported-bandwidth strategy (used when latency falls back, i.e.
      latency cannot differentiate candidates or B's winner is degraded).
   Strategies are registered against a common interface so the chain order and
   the strategies themselves can be replaced or extended without changing the
   election caller. The server owns the chain; peers report metrics passively
   (not as votes).
3. Hub failover: immediate election on disconnect detection (no grace period,
   consistent with ephemerality/no-history). In-flight messages during the
   failover window are dropped (no store-and-forward). New hub is cold-started
   (no pre-warming). Keep failover simple.
4. Heartbeat: 15s interval, 45s timeout (3 missed beats). Tunable via
   configuration.
5. In-process STUN: enabled by default, with a config flag to disable. Low
   overhead, improves reachability; opt-out only when an external STUN is
   preferred.
6. Transport mode transparency: transparent to normal users. A debug/info
   panel is available (e.g. a settings or "connection info" view) for users who
   want to inspect the current mode (mesh/star/relay) and peer connection
   state.
7. File transfer: no hard size limit (DataChannel handles chunking). On
   no-direct-connection, the UI shows "Direct connection unavailable - file
   transfer not possible."
8. Hub-trust mitigations: **message integrity via ECDSA P-256 signatures is
   now implemented** (see section 5). Each client signs messages with a
   Web Crypto keypair generated on connect; recipients verify against the
   author's public key distributed via signaling. This prevents hub tampering.
   Remaining candidates for future work: message sequence numbers (detect
   drops), hub rotation, and end-to-end leaf-to-leaf encryption
   (confidentiality, bypassing the hub).

## Open questions

1. Whether to add real-time media (webcam, screen/app sharing) support.
   Feasible in principle (WebRTC media tracks over the same RTCPeerConnection),
   but materially expands scope and changes the hub-peer calculus (the hub in
   star mode would have to act as an SFU for media, worsening the hub-trust and
   bandwidth concerns from section 5). Proposed as a separate ADR 0003.