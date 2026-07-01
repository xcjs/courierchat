import type {
  FileTransferControl,
  FileTransferMeta,
  IncomingFileTransfer
} from '#shared/types/FileTransfer';

export interface FileTransferHandlers {
  onTransferStart?: (transfer: IncomingFileTransfer) => void;
  onTransferProgress?: (id: string, receivedBytes: number, totalBytes: number) => void;
  onTransferComplete?: (id: string, file: File, meta: FileTransferMeta) => void;
  onTransferError?: (id: string, reason: string) => void;
  onOutgoingProgress?: (id: string, sentBytes: number, totalBytes: number) => void;
  onOutgoingComplete?: (id: string) => void;
  onOutgoingError?: (id: string, reason: string) => void;
}

interface IncomingEntry {
  meta: FileTransferMeta;
  receivedBytes: number;
  chunks: ArrayBuffer[];
}

interface OutgoingEntry {
  file: File;
  sentBytes: number;
}

export class FileTransferManager {
  private incoming = new Map<string, IncomingEntry>();
  private outgoing = new Map<string, OutgoingEntry>();
  private handlers: FileTransferHandlers = {};

  setHandlers (handlers: FileTransferHandlers): void {
    this.handlers = handlers;
  }

  async sendFile (peerId: string, file: File, channel: RTCDataChannel): Promise<string> {
    if (channel.readyState !== 'open') {
      this.handlers.onOutgoingError?.('', 'DataChannel is not open');
      throw new Error('DataChannel is not open');
    }

    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const meta: FileTransferMeta = { id, name: file.name, size: file.size, mimeType: file.type };
    const startMsg: FileTransferControl = { type: 'file-start', ...meta };
    channel.send(JSON.stringify(startMsg));

    this.outgoing.set(id, { file, sentBytes: 0 });
    await this.streamFile(id, peerId, file, channel);
    return id;
  }

  private async streamFile (id: string, _peerId: string, file: File, channel: RTCDataChannel): Promise<void> {
    const entry = this.outgoing.get(id);
    if (!entry) { return; }

    const reader = file.stream().getReader();
    try {
      while (true) {
        if (channel.readyState !== 'open') {
          this.handlers.onOutgoingError?.(id, 'DataChannel closed during transfer');
          this.outgoing.delete(id);
          return;
        }
        if (channel.bufferedAmount > channel.bufferedAmountLowThreshold) {
          await this.waitForDrain(channel);
        }
        const { done, value } = await reader.read();
        if (done) { break; }
        if (value) {
          const chunk = value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength);
          channel.send(chunk);
          entry.sentBytes += chunk.byteLength;
          this.handlers.onOutgoingProgress?.(id, entry.sentBytes, file.size);
        }
      }
      const completeMsg: FileTransferControl = { type: 'file-complete', id };
      channel.send(JSON.stringify(completeMsg));
      this.outgoing.delete(id);
      this.handlers.onOutgoingComplete?.(id);
    } catch (err) {
      this.handlers.onOutgoingError?.(id, (err as Error).message);
      this.outgoing.delete(id);
    } finally {
      reader.releaseLock();
    }
  }

  private waitForDrain (channel: RTCDataChannel): Promise<void> {
    return new Promise((resolve) => {
      const onLow = (): void => {
        channel.removeEventListener('bufferedamountlow', onLow);
        resolve();
      };
      channel.addEventListener('bufferedamountlow', onLow);
    });
  }

  handleControlMessage (peerId: string, data: string): void {
    let msg: FileTransferControl;
    try {
      msg = JSON.parse(data) as FileTransferControl;
    } catch {
      return;
    }
    if (msg.type === 'file-start') {
      const meta: FileTransferMeta = { id: msg.id, name: msg.name, size: msg.size, mimeType: msg.mimeType };
      const entry: IncomingEntry = { meta, receivedBytes: 0, chunks: [] };
      this.incoming.set(msg.id, entry);
      const transfer: IncomingFileTransfer = { id: msg.id, peerId, meta, receivedBytes: 0, chunks: [] };
      this.handlers.onTransferStart?.(transfer);
    } else if (msg.type === 'file-complete') {
      const entry = this.incoming.get(msg.id);
      if (!entry) { return; }
      const blob = new Blob(entry.chunks, { type: entry.meta.mimeType });
      const file = new File([blob], entry.meta.name, { type: entry.meta.mimeType });
      this.handlers.onTransferComplete?.(msg.id, file, entry.meta);
      this.incoming.delete(msg.id);
    } else if (msg.type === 'file-error') {
      const entry = this.incoming.get(msg.id);
      if (entry) { this.incoming.delete(msg.id); }
      this.handlers.onTransferError?.(msg.id, msg.reason);
    }
  }

  handleBinaryMessage (_peerId: string, buffer: ArrayBuffer): void {
    const next = this.incoming.entries().next();
    if (next.done) { return; }
    const [id, entry] = next.value;
    entry.chunks.push(buffer);
    entry.receivedBytes += buffer.byteLength;
    this.handlers.onTransferProgress?.(id, entry.receivedBytes, entry.meta.size);
    if (entry.receivedBytes >= entry.meta.size) {
      const blob = new Blob(entry.chunks, { type: entry.meta.mimeType });
      const file = new File([blob], entry.meta.name, { type: entry.meta.mimeType });
      this.handlers.onTransferComplete?.(id, file, entry.meta);
      this.incoming.delete(id);
    }
  }

  cancelIncoming (id: string): void {
    this.incoming.delete(id);
  }

  cancelOutgoing (id: string): void {
    this.outgoing.delete(id);
  }

  clearForPeer (_peerId: string): void {
    this.incoming.clear();
    this.outgoing.clear();
  }
}
