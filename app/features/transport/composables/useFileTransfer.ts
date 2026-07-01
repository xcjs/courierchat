import { ref, type Ref } from 'vue';
import type { FileTransferMeta, IncomingFileTransfer } from '#shared/types/FileTransfer';

export interface FileTransferEntry {
  id: string;
  peerId: string;
  meta: FileTransferMeta;
  direction: 'incoming' | 'outgoing';
  progress: number;
  status: 'active' | 'complete' | 'error';
  error?: string;
  file?: File;
}

export interface UseFileTransferReturn {
  transfers: Ref<FileTransferEntry[]>;
  onTransferStart: (transfer: IncomingFileTransfer) => void;
  onTransferProgress: (id: string, receivedBytes: number, totalBytes: number) => void;
  onTransferComplete: (id: string, file: File, meta: FileTransferMeta) => void;
  onTransferError: (id: string, reason: string) => void;
  onOutgoingProgress: (id: string, sentBytes: number, totalBytes: number) => void;
  onOutgoingComplete: (id: string) => void;
  onOutgoingError: (id: string, reason: string) => void;
  addOutgoing: (id: string, peerId: string, meta: FileTransferMeta) => void;
  clear: () => void;
}

export function useFileTransfer (): UseFileTransferReturn {
  const transfers = ref<FileTransferEntry[]>([]);

  function addOutgoing (id: string, peerId: string, meta: FileTransferMeta): void {
    transfers.value = [...transfers.value, {
      id,
      peerId,
      meta,
      direction: 'outgoing',
      progress: 0,
      status: 'active'
    }];
  }

  function onTransferStart (transfer: IncomingFileTransfer): void {
    transfers.value = [...transfers.value, {
      id: transfer.id,
      peerId: transfer.peerId,
      meta: transfer.meta,
      direction: 'incoming',
      progress: 0,
      status: 'active'
    }];
  }

  function onTransferProgress (id: string, receivedBytes: number, totalBytes: number): void {
    transfers.value = transfers.value.map(t =>
      t.id === id ? { ...t, progress: totalBytes > 0 ? receivedBytes / totalBytes : 0 } : t
    );
  }

  function onTransferComplete (id: string, file: File, meta: FileTransferMeta): void {
    transfers.value = transfers.value.map(t =>
      t.id === id ? { ...t, progress: 1, status: 'complete', file, meta } : t
    );
  }

  function onTransferError (id: string, reason: string): void {
    transfers.value = transfers.value.map(t =>
      t.id === id ? { ...t, status: 'error', error: reason } : t
    );
  }

  function onOutgoingProgress (id: string, sentBytes: number, totalBytes: number): void {
    transfers.value = transfers.value.map(t =>
      t.id === id ? { ...t, progress: totalBytes > 0 ? sentBytes / totalBytes : 0 } : t
    );
  }

  function onOutgoingComplete (id: string): void {
    transfers.value = transfers.value.map(t =>
      t.id === id ? { ...t, progress: 1, status: 'complete' } : t
    );
  }

  function onOutgoingError (id: string, reason: string): void {
    transfers.value = transfers.value.map(t =>
      t.id === id ? { ...t, status: 'error', error: reason } : t
    );
  }

  function clear (): void {
    transfers.value = [];
  }

  return {
    transfers,
    onTransferStart,
    onTransferProgress,
    onTransferComplete,
    onTransferError,
    onOutgoingProgress,
    onOutgoingComplete,
    onOutgoingError,
    addOutgoing,
    clear
  };
}
