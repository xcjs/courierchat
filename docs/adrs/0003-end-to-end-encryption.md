# ADR 0003: End-to-end message encryption

Date: 2026-07-02
Status: Proposed

## Context

ADR 0002 introduced WebRTC DataChannel transport with three modes: mesh, star
(topology with an elected hub peer), and WebSocket relay fallback. ADR 0002
also documented the hub-peer trust caveat: in star mode the hub is an
untrusted anonymous peer that sees every message. Message integrity via
ECDSA P-256 signatures was subsequently implemented (see ADR 0002 section 5,
"Message integrity"), preventing the hub and relay server from tampering
with message content without detection.

However, **confidentiality remains unprotected**. The hub in star mode can
read every message it relays. The relay server can read every message that
traverses it in relay mode. DataChannels are DTLS-encrypted at the transport
level, but in star topology the hub decrypts each incoming channel, reads the
plaintext, and re-encrypts for the next hop — so DTLS protects
peer-to-hub and hub-to-leaf links individually but does not provide
end-to-end confidentiality. The server is not zero-knowledge: in relay mode it
sees all message content as plaintext.

CourierChat's core value propositions are ephemerality, anonymity, and
privacy. Users join anonymous chat rooms without persistent accounts; the
lack of message history is a feature, not a limitation. Transport-level
encryption (WSS, DTLS) protects against network eavesdroppers but not against
the hub peer or the relay server — both of which are inside the encrypted
channel and can observe plaintext.

### Threat model

| Threat | Actor | Current protection | Gap |
|--------|-------|--------------------|-----|
| Network eavesdropping | External attacker | WSS (signaling), DTLS (DataChannel) | Covered |
| Message tampering | Hub peer | ECDSA signatures (implemented) | Covered |
| Message tampering | Relay server | ECDSA signatures (implemented) | Covered |
| Message content disclosure | Hub peer | None — hub reads plaintext | **Open** |
| Message content disclosure | Relay server | None — server reads plaintext | **Open** |
| Message dropping | Hub peer | None | Open (out of scope here) |
| Metadata collection | Server | None — server sees rooms, usernames, public keys | Open (inherent to the signaling design) |

This ADR addresses the two "Open" confidentiality gaps (content disclosure to
hub and relay server). Message dropping and metadata minimization are
separate concerns left to future work.

## Decision

Encrypt message content end-to-end using a symmetric cipher (AES-GCM-256)
with per-room ephemeral keys distributed via a hybrid encryption scheme. Only
intended recipients can decrypt; the hub, the relay server, and the
signaling server never gain access to plaintext message content.

### Key agreement and distribution

1. **Existing keypair reuse:** each client already generates an ECDSA P-256
   keypair on connect (for message signing, per ADR 0002). This keypair is
   used only for signing/verification. For encryption, each client generates
   an additional ECDH P-256 keypair on connect. The ECDH public key is
   distributed alongside the signing public key via the existing Hello →
   PeerJoined signaling flow (same field, new `encPublicKey` property on
   `PeerIdentity`).

2. **Pairwise shared secrets:** when a peer joins a room, the joining client
   and each existing peer perform ECDH key agreement using their respective
   ECDH private keys and the other peer's ECDH public key. This produces a
   pairwise shared secret unique to each pair of peers. The ECDH exchange
   happens implicitly through the public keys distributed by the signaling
   server — no additional round-trips are needed.

3. **Per-message encryption:**
   - The sender encrypts the message content (and only the content field;
     `id`, `author`, and `timestamp` remain in plaintext for routing,
   display, and signature verification) using AES-GCM-256 with a random
     96-bit IV and a key derived from the pairwise ECDH shared secret via
     HKDF-SHA-256.
   - The encrypted content and IV are included in the message payload.
   - The signature (ECDSA, already implemented) is computed over the
     canonical form using the **plaintext** content, then the content is
     encrypted. Recipients decrypt first, then verify the signature against
     the decrypted content. This ensures the signature binds the original
     plaintext and the encryption does not break integrity verification.

4. **Relay mode:** in relay mode, the server relays the encrypted payload
   without modification. The server cannot decrypt the content because it
   does not have the ECDH private key of either peer. Only the recipient's
   ECDH private key can derive the shared secret needed for decryption.

5. **Star mode:** the hub relays encrypted content. The hub cannot decrypt
   messages between two leaves because it does not have the pairwise shared
   secret for that pair. If the hub is also a participant (sends its own
   messages), those messages are encrypted with the hub-leaf pairwise
   secret, which the hub can decrypt — but only for messages addressed to
   or from the hub itself, not for messages between other leaves.

   > **Clarification:** in star topology, the hub receives each message and
   > retransmits it to all other leaves. The hub cannot decrypt a message
   > from leaf A to leaf B because the message is encrypted with the
   > A↔B pairwise key (derived from A's and B's ECDH keys). The hub has
   > neither A's nor B's ECDH private key, so it cannot derive the A↔B shared
   > secret. The hub simply forwards the opaque ciphertext.

### Message format

The `ChatMessage` and `ChatMessagePayload` types gain two optional fields:

```typescript
interface ChatMessage {
  id: string;
  author: string;
  content: string;       // plaintext on the sender side; encrypted wire format on the wire
  timestamp: number;
  signature?: string;     // base64 ECDSA over plaintext canonical form (existing)
  encIv?: string;        // base64 96-bit IV for AES-GCM (new)
  encKey?: string;        // base64 encrypted symmetric key wrapped for each recipient (new; see below)
}
```

**Simplification — pairwise encryption, not group keys:**

Rather than maintaining a single shared room key (which requires rekeying on
every join/leave and is complex to get right), the approach is **pairwise
encryption**: the sender encrypts the content for each recipient individually
using their pairwise ECDH-derived key. This means the sender encrypts the
message N times (once per recipient) and includes all encrypted copies in the
payload. For small rooms (the common case, <=8 peers in mesh) this is
trivially cheap. For larger star rooms, the sender encrypts once per leaf
and the hub forwards the appropriate ciphertext.

To avoid bloating the message with N encrypted copies, a **hybrid envelope**
approach is used:

1. The sender generates a random AES-GCM-256 content key (CEK) for the
   message.
2. The sender encrypts the content with the CEK (one encryption, not N).
3. The sender wraps the CEK for each recipient using their pairwise ECDH
   key (AES-KW or AES-GCM key wrapping).
4. The message includes the encrypted content, the IV, and a map of
   `peerId → wrappedCEK`.

Recipients look up their `peerId` in the map, unwrap the CEK using their
pairwise key, and decrypt the content. Peers not in the map (e.g., the hub
when it is only relaying) cannot unwrap the CEK and thus cannot read the
content.

### Key derivation

The pairwise ECDH shared secret is processed through HKDF-SHA-256 with a
room-specific salt (the room name) and an info string identifying the
purpose (`courierchat:v1:encryption`) to produce the wrapping key for each
pair. This ensures keys are scoped per-room and per-purpose and prevents
cross-room key reuse.

### Backward compatibility

The `encIv` and `encKey` fields are optional. Messages without them are
treated as plaintext by recipients (same lenient policy as signatures:
deliver unsigned/unencrypted messages for backward compatibility). A
recipient that supports encryption will attempt to decrypt if the fields are
present; if decryption fails (e.g., key mismatch), the message is dropped.

### Performance considerations

- ECDH key agreement is performed once per peer pair (on join), not per
  message. The resulting shared secret is cached.
- Per-message cost: one AES-GCM-256 encrypt (content) + N AES-GCM key wraps
  (one per recipient). For typical rooms (2–8 peers) this is negligible.
- For large rooms (50+ peers in star), the N key wraps are the dominant
  cost. The hub forwards the full message including all wrapped keys;
  recipients only unwrap their own entry. If this becomes a bottleneck, a
  future optimization could use a room-wide key with periodic rekeying,
  but the pairwise approach is chosen initially for simplicity and
  forward secrecy properties.

### Forward secrecy

Pairwise ECDH keys are ephemeral (generated on connect, discarded on
disconnect). If a peer's ECDH private key is compromised, only messages
exchanged during that session are decryptable. Past sessions used different
keys and remain secure. This provides **per-session forward secrecy**. Full
per-message forward secrecy (ratchet) is not implemented initially; it is a
future optimization if the threat model warrants it.

## Consequences

Positive:
- The hub peer cannot read message content between other leaves.
- The relay server cannot read message content in relay mode.
- The signaling server never sees encrypted content (it only distributes
  public keys, which are already public by definition).
- Forward secrecy per session: compromise of one session's keys does not
  affect other sessions.
- Integrates cleanly with the existing ECDSA signing infrastructure — same
  key distribution channel (Hello → PeerJoined), same message types.

Negative:
- Increased message size (encrypted content + IV + wrapped CEKs for each
  recipient). For a 200-character message in a 5-peer room, this adds
  roughly 500–800 bytes of overhead.
- Increased CPU cost on the sender (one AES-GCM encrypt + N key wraps per
  message) and on each recipient (one key unwrap + one AES-GCM decrypt).
  Negligible for small rooms; measurable for very large rooms.
- Increased implementation complexity: key management, wrapping/unwrapping,
  cache lifecycle, and a new failure mode (decryption failure → drop).
- Late joiners cannot read messages sent before they joined (consistent
  with the ephemeral/no-history guarantee — this is a feature, not a bug).
- The server still sees metadata: room membership, usernames, public keys,
  message timing and size (traffic analysis). E2E encryption does not
  address metadata leakage; that would require additional techniques
  (e.g., padding, dummy traffic, onion routing) which are out of scope.

## Open questions

1. **Room-wide key vs pairwise wrapping:** for very large rooms, should we
   switch to a single room-wide CEK with rekeying on join/leave to reduce
   per-message overhead? The pairwise approach is simpler and more secure
   (no rekeying races) but scales O(n) in message size. Decision deferred
   until performance data is available from real-world usage.

2. **Double ratchet:** should we implement the Signal-style double ratchet
   for per-message forward secrecy and post-compromise security? This
   would be a significant complexity increase. Proposed only if the threat
   model expands to include targeted compromise of individual sessions.

3. **File transfer encryption:** file transfers currently use raw
   DataChannel binary. Should files also be E2E encrypted? The pairwise key
   infrastructure exists; applying it to file transfers is straightforward
   but adds per-chunk encryption overhead. Proposed as a follow-up.

4. **Hub as participant:** when the hub is also a chat participant (not just
   a relay), it receives messages addressed to it and can decrypt them.
   This is expected (the hub is a legitimate participant). The concern is
   only about messages between other leaves that the hub relays but is not
   a recipient of — those remain confidential.