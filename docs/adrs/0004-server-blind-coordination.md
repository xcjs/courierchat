# ADR 0004: Server-blind room coordination (future architecture)

Date: 2026-07-02
Status: Proposed

## Context

ADR 0002 established a signaling server that tracks room names, room
membership, usernames, and peer identities in-memory. The server uses this
knowledge to coordinate hub election, route relay broadcasts, and — until
the room list sync added alongside this ADR — distribute the room list to
clients.

ADR 0003 achieved end-to-end message confidentiality: the server and hub
peers cannot read message content. However, the server still knows:

- Which rooms exist and their names
- Which usernames are online
- Which peers are in which rooms (membership graph)
- Room metadata (tiers, icons, peer counts)

This metadata is visible to the server operator and could be logged,
subpoenaed, or leaked. CourierChat's value propositions are ephemerality,
anonymity, and privacy — server-side metadata retention undermines these
goals.

The current room list sync (implemented alongside this ADR) distributes the
room list using the server's existing knowledge. This is a pragmatic
short-term solution that works with the current architecture. This ADR
documents the future direction: making the server blind to room names,
usernames, and membership.

## Decision (future)

Transition to a **server-blind relay** architecture where the signaling
server acts as a pure message relay without knowledge of room names,
usernames, or membership. The server would:

- Relay messages by opaque room token (not human-readable name)
- Not maintain a username registry or room registry
- Not track which peers are in which rooms
- Not broadcast room lists or presence

Room discovery and membership coordination would move entirely to the
client layer, using cryptographic room identifiers and peer-to-peer
gossip or a distributed directory.

### Key design questions (unresolved)

1. **Room discovery**: How do users find rooms without a server-side
   directory? Options include: shared secrets/invite links, a
   peer-gossiped room directory, or a separate decentralized directory
   service.

2. **Room identity**: Rooms would be identified by opaque tokens (e.g.,
   a hash of a shared secret) rather than human-readable names. The
   human-readable name would be carried in encrypted metadata exchanged
   peer-to-peer.

3. **Presence**: Without a server-side username registry, presence would
   need to be established peer-to-peer within each room (peers announce
   themselves on join).

4. **Hub election**: Currently the server coordinates hub election based
   on peer metrics. In a server-blind model, peers would need to
   coordinate election peer-to-peer (e.g., via a leader election protocol
   over the relay).

5. **Relay routing**: The server would relay messages keyed by opaque
   room tokens without knowing room names. Subscriptions would be by
   token, not by name.

6. **Migration**: The transition from the current server-trusted
   architecture to a server-blind one must be incremental. The room list
   sync implemented today is the last feature that depends on server-side
   room knowledge; future work would remove that dependency.

## Status

This ADR is **Proposed** — it documents a future architectural direction,
not a current implementation. The room list sync implemented alongside
this ADR uses the existing server-trusted architecture as a pragmatic
interim solution.

## Consequences

- **Positive**: Server operator cannot observe room names, usernames, or
  membership metadata. Stronger privacy guarantees align with
  CourierChat's core values.

- **Negative**: Significantly more complex client-side coordination.
  Room discovery becomes a UX challenge. Hub election and relay routing
  require new protocols. Migration effort is substantial.

- **Neutral**: End-to-end message encryption (ADR 0003) is a prerequisite
  and already implemented; this ADR extends confidentiality to metadata.