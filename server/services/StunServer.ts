import { createSocket, type Socket, type RemoteInfo } from 'node:dgram';
import {
  parseStunHeader,
  isBindingRequest,
  buildBindingResponse
} from './StunProtocol';

/**
 * In-process STUN server using Node's dgram UDP socket.
 *
 * Per ADR 0002: enabled by default, with a config flag to disable.
 * Implements only the Binding Request/Response flow (RFC 5389 subset)
 * — sufficient for ICE server-reflexive candidate discovery.
 */
export class StunServer {
  private socket: Socket | null = null;
  private readonly port: number;
  private readonly host: string;
  private bound = false;

  constructor (opts: { port?: number; host?: string } = {}) {
    this.port = opts.port ?? 3478;
    this.host = opts.host ?? '0.0.0.0';
  }

  /**
   * Start listening for UDP STUN requests.
   * Returns when the socket is bound.
   */
  start (): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.socket) {
        resolve();
        return;
      }

      const socket = createSocket('udp4');

      socket.on('message', (msg: Buffer, rinfo: RemoteInfo) => {
        this.handlePacket(msg, rinfo);
      });

      socket.on('error', (err: Error) => {
        // eslint-disable-next-line no-console
        console.error('[stun] socket error:', err);
      });

      socket.bind(this.port, this.host, () => {
        this.socket = socket;
        this.bound = true;
        resolve();
      });

      socket.on('error', (err: Error) => {
        if (!this.bound) {
          reject(err);
        }
      });
    });
  }

  /**
   * Stop the STUN server and close the UDP socket.
   */
  stop (): Promise<void> {
    return new Promise((resolve) => {
      if (!this.socket) {
        resolve();
        return;
      }
      const socket = this.socket;
      this.socket = null;
      this.bound = false;
      socket.close(() => resolve());
    });
  }

  /** Whether the server is currently listening. */
  get isRunning (): boolean {
    return this.bound;
  }

  /** The port the server is bound to (useful when port 0 was requested). */
  get boundPort (): number | undefined {
    if (!this.socket) { return undefined; }
    const addr = this.socket.address();
    return typeof addr.port === 'number' ? addr.port : undefined;
  }

  /**
   * Handle an incoming UDP packet. Parses the STUN header; if it's a
   * Binding Request, builds a Binding Response with the client's
   * reflected address and sends it back.
   */
  private handlePacket (msg: Buffer, rinfo: RemoteInfo): void {
    const packet = new Uint8Array(msg.buffer, msg.byteOffset, msg.byteLength);
    const header = parseStunHeader(packet);
    if (!header || !isBindingRequest(header)) {
      return; // Not a STUN Binding Request — silently drop
    }

    const response = buildBindingResponse(header.transactionId, rinfo.address, rinfo.port);
    this.socket?.send(response, rinfo.port, rinfo.address);
  }
}
