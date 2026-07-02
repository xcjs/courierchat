export interface ChatMessage {
  id: string;
  author: string;
  content: string;
  timestamp: number;
  /**
   * Base64 ECDSA signature over the canonical representation
   * `${id}|${author}|${content}|${timestamp}`. Present on messages from
   * clients that support message integrity; absent on legacy/test messages.
   * Recipients verify it against the author's distributed public key and
   * drop the message on mismatch.
   */
  signature?: string;
}
