import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FileTransferManager, type FileTransferHandlers } from './FileTransferManager';
import type { FileTransferControl, FileTransferStart } from '#shared/types/FileTransfer';

interface MockChannel extends RTCDataChannel {
  readyState: RTCDataChannelState;
  bufferedAmount: number;
}

function makeMockChannel (): MockChannel {
  return {
    readyState: 'open',
    bufferedAmount: 0,
    bufferedAmountLowThreshold: 0,
    send: vi.fn(),
    close: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn()
  } as unknown as MockChannel;
}

function makeHandlers (): FileTransferHandlers {
  return {
    onTransferStart: vi.fn(),
    onTransferProgress: vi.fn(),
    onTransferComplete: vi.fn(),
    onTransferError: vi.fn(),
    onOutgoingProgress: vi.fn(),
    onOutgoingComplete: vi.fn(),
    onOutgoingError: vi.fn()
  };
}

function makeFile (name = 'test.txt', size = 10, mimeType = 'text/plain'): File {
  const data = new Uint8Array(size);
  return new File([data], name, { type: mimeType });
}

describe('FileTransferManager.handleControlMessage', () => {
  let mgr: FileTransferManager;
  let handlers: FileTransferHandlers;

  beforeEach(() => {
    mgr = new FileTransferManager();
    handlers = makeHandlers();
    mgr.setHandlers(handlers);
  });

  it('handles file-start by creating an incoming entry and calling onTransferStart', () => {
    const msg: FileTransferControl = { type: 'file-start', id: 'tf-1', name: 'pic.png', size: 100, mimeType: 'image/png' };
    mgr.handleControlMessage('p-2', JSON.stringify(msg));

    expect(handlers.onTransferStart).toHaveBeenCalledTimes(1);
    const calls = (handlers.onTransferStart as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls.length).toBe(1);
    const transfer = calls[0]![0];
    expect(transfer).toMatchObject({
      id: 'tf-1',
      peerId: 'p-2',
      meta: { id: 'tf-1', name: 'pic.png', size: 100, mimeType: 'image/png' },
      receivedBytes: 0,
      chunks: []
    });
  });

  it('handles file-complete by assembling the file from accumulated chunks', () => {
    const start: FileTransferControl = { type: 'file-start', id: 'tf-2', name: 'data.bin', size: 5, mimeType: 'application/octet-stream' };
    mgr.handleControlMessage('p-3', JSON.stringify(start));

    const chunk = new ArrayBuffer(5);
    mgr.handleBinaryMessage('p-3', chunk);

    const complete: FileTransferControl = { type: 'file-complete', id: 'tf-2' };
    mgr.handleControlMessage('p-3', JSON.stringify(complete));

    expect(handlers.onTransferComplete).toHaveBeenCalledTimes(1);
    const calls = (handlers.onTransferComplete as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls.length).toBe(1);
    const [id, file, meta] = calls[0]!;
    expect(id).toBe('tf-2');
    expect(file).toBeInstanceOf(File);
    expect(file.name).toBe('data.bin');
    expect(file.size).toBe(5);
    expect(file.type).toBe('application/octet-stream');
    expect(meta).toEqual({ id: 'tf-2', name: 'data.bin', size: 5, mimeType: 'application/octet-stream' });
  });

  it('ignores file-complete when no matching incoming entry exists', () => {
    const complete: FileTransferControl = { type: 'file-complete', id: 'unknown' };
    mgr.handleControlMessage('p-3', JSON.stringify(complete));
    expect(handlers.onTransferComplete).not.toHaveBeenCalled();
  });

  it('handles file-error by cleaning up the incoming entry and calling onTransferError', () => {
    const start: FileTransferControl = { type: 'file-start', id: 'tf-err', name: 'f.txt', size: 8, mimeType: 'text/plain' };
    mgr.handleControlMessage('p-4', JSON.stringify(start));

    const err: FileTransferControl = { type: 'file-error', id: 'tf-err', reason: 'aborted' };
    mgr.handleControlMessage('p-4', JSON.stringify(err));

    expect(handlers.onTransferError).toHaveBeenCalledWith('tf-err', 'aborted');
  });

  it('fires onTransferError for file-error even when no matching incoming entry exists', () => {
    const err: FileTransferControl = { type: 'file-error', id: 'nope', reason: 'x' };
    mgr.handleControlMessage('p-4', JSON.stringify(err));
    expect(handlers.onTransferError).toHaveBeenCalledWith('nope', 'x');
  });

  it('ignores invalid JSON', () => {
    mgr.handleControlMessage('p-5', 'not json');
    expect(handlers.onTransferStart).not.toHaveBeenCalled();
    expect(handlers.onTransferComplete).not.toHaveBeenCalled();
    expect(handlers.onTransferError).not.toHaveBeenCalled();
  });
});

describe('FileTransferManager.handleBinaryMessage', () => {
  let mgr: FileTransferManager;
  let handlers: FileTransferHandlers;

  beforeEach(() => {
    mgr = new FileTransferManager();
    handlers = makeHandlers();
    mgr.setHandlers(handlers);
  });

  it('accumulates chunks and fires onTransferProgress', () => {
    const start: FileTransferControl = { type: 'file-start', id: 'tf-b1', name: 'f.dat', size: 10, mimeType: 'application/octet-stream' };
    mgr.handleControlMessage('p-6', JSON.stringify(start));

    const chunk1 = new ArrayBuffer(4);
    mgr.handleBinaryMessage('p-6', chunk1);
    expect(handlers.onTransferProgress).toHaveBeenCalledWith('tf-b1', 4, 10);

    const chunk2 = new ArrayBuffer(3);
    mgr.handleBinaryMessage('p-6', chunk2);
    expect(handlers.onTransferProgress).toHaveBeenCalledWith('tf-b1', 7, 10);
  });

  it('completes transfer when receivedBytes reaches total size', () => {
    const start: FileTransferControl = { type: 'file-start', id: 'tf-b2', name: 'small.txt', size: 5, mimeType: 'text/plain' };
    mgr.handleControlMessage('p-7', JSON.stringify(start));

    const chunk = new ArrayBuffer(5);
    mgr.handleBinaryMessage('p-7', chunk);

    expect(handlers.onTransferComplete).toHaveBeenCalledTimes(1);
    const calls = (handlers.onTransferComplete as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls.length).toBe(1);
    const [id, file] = calls[0]!;
    expect(id).toBe('tf-b2');
    expect(file).toBeInstanceOf(File);
    expect(file.size).toBe(5);
  });

  it('does nothing when there is no active incoming transfer', () => {
    const chunk = new ArrayBuffer(8);
    mgr.handleBinaryMessage('p-8', chunk);
    expect(handlers.onTransferProgress).not.toHaveBeenCalled();
    expect(handlers.onTransferComplete).not.toHaveBeenCalled();
  });
});

describe('FileTransferManager.sendFile', () => {
  let mgr: FileTransferManager;
  let handlers: FileTransferHandlers;

  beforeEach(() => {
    mgr = new FileTransferManager();
    handlers = makeHandlers();
    mgr.setHandlers(handlers);
  });

  it('throws and fires onOutgoingError when channel is not open', async () => {
    const channel = makeMockChannel();
    channel.readyState = 'closed';
    const file = makeFile();

    await expect(mgr.sendFile('p-9', file, channel)).rejects.toThrow('DataChannel is not open');
    expect(handlers.onOutgoingError).toHaveBeenCalledWith('', 'DataChannel is not open');
  });

  it('sends file-start control message, streams chunks, and sends file-complete', async () => {
    const channel = makeMockChannel();
    const file = makeFile('hello.txt', 16, 'text/plain');

    const id = await mgr.sendFile('p-10', file, channel);

    expect(id).toBeTruthy();
    const sends = (channel.send as ReturnType<typeof vi.fn>).mock.calls.map(c => c[0]);
    const startMsg = sends.find(s => typeof s === 'string' && s.includes('file-start'));
    const completeMsg = sends.find(s => typeof s === 'string' && s.includes('file-complete'));
    expect(startMsg).toBeTruthy();
    expect(completeMsg).toBeTruthy();

    const parsedStart = JSON.parse(startMsg as string) as FileTransferControl;
    expect(parsedStart.type).toBe('file-start');
    expect(parsedStart).toMatchObject({ name: 'hello.txt', size: 16, mimeType: 'text/plain' });

    const parsedComplete = JSON.parse(completeMsg as string) as FileTransferControl;
    expect(parsedComplete.type).toBe('file-complete');
    expect(parsedComplete.id).toBe(id);

    expect(handlers.onOutgoingComplete).toHaveBeenCalledWith(id);
    expect(handlers.onOutgoingProgress).toHaveBeenCalled();
  });

  it('fires onOutgoingError if channel closes mid-transfer', async () => {
    const channel = makeMockChannel();
    const file = makeFile('big.dat', 64, 'application/octet-stream');
    let readCount = 0;
    Object.defineProperty(file, 'stream', {
      value: () => ({
        getReader: () => ({
          read: (): Promise<ReadableStreamReadResult<Uint8Array>> => {
            readCount++;
            if (readCount === 1) {
              return Promise.resolve({ done: false, value: new Uint8Array(32) });
            }
            channel.readyState = 'closed';
            return Promise.resolve({ done: false, value: new Uint8Array(32) });
          },
          releaseLock: vi.fn()
        })
      })
    });

    await mgr.sendFile('p-11', file, channel);

    expect(handlers.onOutgoingError).toHaveBeenCalledWith(expect.any(String), 'DataChannel closed during transfer');
  });
});

describe('FileTransferManager cancellation', () => {
  it('cancelIncoming removes the entry', () => {
    const mgr = new FileTransferManager();
    const handlers = makeHandlers();
    mgr.setHandlers(handlers);

    const start: FileTransferControl = { type: 'file-start', id: 'tf-c1', name: 'x.txt', size: 4, mimeType: 'text/plain' };
    mgr.handleControlMessage('p-12', JSON.stringify(start));
    mgr.cancelIncoming('tf-c1');

    const complete: FileTransferControl = { type: 'file-complete', id: 'tf-c1' };
    mgr.handleControlMessage('p-12', JSON.stringify(complete));
    expect(handlers.onTransferComplete).not.toHaveBeenCalled();
  });

  it('cancelOutgoing removes the entry', () => {
    const mgr = new FileTransferManager();
    mgr.cancelOutgoing('tf-c2');
  });

  it('clearForPeer clears all incoming and outgoing entries', () => {
    const mgr = new FileTransferManager();
    const handlers = makeHandlers();
    mgr.setHandlers(handlers);

    const start: FileTransferControl = { type: 'file-start', id: 'tf-cl', name: 'c.txt', size: 3, mimeType: 'text/plain' };
    mgr.handleControlMessage('p-13', JSON.stringify(start));
    mgr.clearForPeer('p-13');

    const complete: FileTransferControl = { type: 'file-complete', id: 'tf-cl' };
    mgr.handleControlMessage('p-13', JSON.stringify(complete));
    expect(handlers.onTransferComplete).not.toHaveBeenCalled();
  });
});

describe('FileTransferManager backpressure', () => {
  let mgr: FileTransferManager;
  let handlers: FileTransferHandlers;

  beforeEach(() => {
    mgr = new FileTransferManager();
    handlers = makeHandlers();
    mgr.setHandlers(handlers);
  });

  it('waits for bufferedamountlow event when bufferedAmount exceeds threshold', async () => {
    const channel = makeMockChannel();
    channel.bufferedAmountLowThreshold = 64;
    const file = makeFile('big.dat', 32, 'application/octet-stream');

    let lowListener: (() => void) | null = null;
    (channel.addEventListener as ReturnType<typeof vi.fn>).mockImplementation((event: string, cb: () => void) => {
      if (event === 'bufferedamountlow') { lowListener = cb; }
    });
    (channel.removeEventListener as ReturnType<typeof vi.fn>).mockImplementation(() => {});

    const sendPromise = mgr.sendFile('p-bp1', file, channel);

    (channel.send as ReturnType<typeof vi.fn>).mockImplementation((data: ArrayBuffer | string) => {
      if (typeof data !== 'string') {
        channel.bufferedAmount = 128;
      }
    });

    await vi.waitFor(() => { expect(lowListener).not.toBeNull(); });

    channel.bufferedAmount = 0;
    lowListener!();

    await sendPromise;

    expect(handlers.onOutgoingComplete).toHaveBeenCalledTimes(1);
  });

  it('sends file-start with correct metadata for empty file', async () => {
    const channel = makeMockChannel();
    const file = makeFile('empty.txt', 0, 'text/plain');

    const id = await mgr.sendFile('p-bp2', file, channel);

    expect(id).toBeTruthy();
    const sends = (channel.send as ReturnType<typeof vi.fn>).mock.calls.map(c => c[0]);
    const startMsg = sends.find(s => typeof s === 'string' && s.includes('file-start'));
    expect(startMsg).toBeTruthy();
    const parsedStart = JSON.parse(startMsg as string) as FileTransferStart;
    expect(parsedStart.type).toBe('file-start');
    expect(parsedStart.size).toBe(0);
    expect(handlers.onOutgoingComplete).toHaveBeenCalledWith(id);
  });
});

describe('FileTransferManager multiple transfers', () => {
  let mgr: FileTransferManager;
  let handlers: FileTransferHandlers;

  beforeEach(() => {
    mgr = new FileTransferManager();
    handlers = makeHandlers();
    mgr.setHandlers(handlers);
  });

  it('tracks multiple incoming transfers independently', () => {
    const start1: FileTransferControl = { type: 'file-start', id: 'tf-m1', name: 'a.txt', size: 5, mimeType: 'text/plain' };
    const start2: FileTransferControl = { type: 'file-start', id: 'tf-m2', name: 'b.txt', size: 3, mimeType: 'text/plain' };
    mgr.handleControlMessage('p-m1', JSON.stringify(start1));
    mgr.handleControlMessage('p-m2', JSON.stringify(start2));

    expect(handlers.onTransferStart).toHaveBeenCalledTimes(2);

    mgr.handleBinaryMessage('p-m1', new ArrayBuffer(5));
    expect(handlers.onTransferComplete).toHaveBeenCalledTimes(1);
    expect((handlers.onTransferComplete as ReturnType<typeof vi.fn>).mock.calls[0]![0]).toBe('tf-m1');

    mgr.handleBinaryMessage('p-m2', new ArrayBuffer(3));
    expect(handlers.onTransferComplete).toHaveBeenCalledTimes(2);
    expect((handlers.onTransferComplete as ReturnType<typeof vi.fn>).mock.calls[1]![0]).toBe('tf-m2');
  });

  it('handleBinaryMessage with oversized chunk still completes transfer', () => {
    const start: FileTransferControl = { type: 'file-start', id: 'tf-ov', name: 'ov.bin', size: 3, mimeType: 'application/octet-stream' };
    mgr.handleControlMessage('p-ov', JSON.stringify(start));

    mgr.handleBinaryMessage('p-ov', new ArrayBuffer(10));

    expect(handlers.onTransferComplete).toHaveBeenCalledTimes(1);
    const file = (handlers.onTransferComplete as ReturnType<typeof vi.fn>).mock.calls[0]![1] as File;
    expect(file.size).toBe(10);
  });

  it('cancelIncoming prevents completion via binary auto-complete', () => {
    const start: FileTransferControl = { type: 'file-start', id: 'tf-cn', name: 'c.txt', size: 4, mimeType: 'text/plain' };
    mgr.handleControlMessage('p-cn', JSON.stringify(start));
    mgr.cancelIncoming('tf-cn');

    mgr.handleBinaryMessage('p-cn', new ArrayBuffer(4));
    expect(handlers.onTransferComplete).not.toHaveBeenCalled();
    expect(handlers.onTransferProgress).not.toHaveBeenCalled();
  });

  it('sendFile generates unique IDs for concurrent transfers', async () => {
    const channel = makeMockChannel();
    const file1 = makeFile('a.txt', 4, 'text/plain');
    const file2 = makeFile('b.txt', 4, 'text/plain');

    const id1 = await mgr.sendFile('p-ua', file1, channel);
    const id2 = await mgr.sendFile('p-ua', file2, channel);

    expect(id1).not.toBe(id2);
  });
});
