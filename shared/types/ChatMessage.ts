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
}
