export interface ChatMessage {
  id: string;
  author: string;
  content: string;
  timestamp: number;
  /**
   * Base64 ECDSA signature over the canonical representation
   * `${id}|${author}|${content}|${timestamp}`. Added by the transport layer
   * before sending; absent on newly created messages prior to signing.
   * Recipients verify it against the author's distributed public key and
   * drop the message on mismatch.
   */
  signature?: string;
  /**
   * Base64 96-bit initialization vector for AES-GCM-256 content encryption
   * (ADR 0003). Added by the transport layer before sending; absent on
   * newly created messages prior to encryption.
   */
  encIv?: string;
  /**
   * Per-recipient wrapped content encryption keys (ADR 0003). Added by the
   * transport layer before sending; absent on newly created messages prior
   * to encryption. Map key is the recipient's peerId.
   */
  encKeys?: Record<string, string>;
}
