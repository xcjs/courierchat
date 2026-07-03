export interface FileTransferStart {
  type: 'file-start';
  id: string;
  name: string;
  size: number;
  mimeType: string;
}

export interface FileTransferComplete {
  type: 'file-complete';
  id: string;
}

export interface FileTransferError {
  type: 'file-error';
  id: string;
  reason: string;
}

export type FileTransferControl = FileTransferStart | FileTransferComplete | FileTransferError;

export interface FileTransferMeta {
  id: string;
  name: string;
  size: number;
  mimeType: string;
}

export interface IncomingFileTransfer {
  id: string;
  peerId: string;
  meta: FileTransferMeta;
  receivedBytes: number;
  chunks: ArrayBuffer[];
}

export interface OutgoingFileTransfer {
  id: string;
  peerId: string;
  file: File;
  sentBytes: number;
}
