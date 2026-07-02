// @vitest-environment nuxt
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount, type VueWrapper } from '@vue/test-utils';
import { ref, reactive, type Ref } from 'vue';
import RoomChat from './RoomChat.vue';
import { Tier } from '#shared/types/Tier';
import { SendStatus } from '~/features/room/types/RoomChat';
import { UiTransportMode } from '~/features/transport/types/Transport';
import type { PeerIdentity } from '#shared/types/Signaling';
import type { ChatMessage } from '#shared/types/ChatMessage';
import type { FileTransferEntry } from '~/features/transport/composables/useFileTransfer';
import type { UseRoomTransportReturn } from '~/features/transport/composables/useRoomTransport';

const sessionMock = reactive({ username: 'alice' });

vi.mock('~/stores/Session', () => ({
  useSessionStore: () => sessionMock
}));

const notificationsMock = {
  push: vi.fn(),
  queue: ref([]) as Ref<unknown[]>,
  dismiss: vi.fn(),
  history: ref([]) as Ref<unknown[]>,
  clearHistory: vi.fn()
};

vi.mock('~/stores/Notifications', () => ({
  useNotificationsStore: () => notificationsMock,
  NotificationSeverity: { Info: 'info', Error: 'error' }
}));

const chatMock = {
  messages: ref<ChatMessage[]>([]) as Ref<ChatMessage[]>,
  draft: ref('') as Ref<string>,
  participants: ref<string[]>([]) as Ref<string[]>,
  typingUsers: ref<string[]>([]) as Ref<string[]>,
  messageStatus: ref<Record<string, SendStatus>>({}) as Ref<Record<string, SendStatus>>,
  sendMessage: vi.fn(),
  pushRemote: vi.fn(),
  setDraft: vi.fn(),
  setTyping: vi.fn(),
  setMessageStatus: vi.fn(),
  clear: vi.fn()
};

vi.mock('~/features/room/composables/useRoomChat', () => ({
  useRoomChat: () => chatMock
}));

const fileTransferMock = {
  transfers: ref<FileTransferEntry[]>([]) as Ref<FileTransferEntry[]>,
  onTransferStart: vi.fn(),
  onTransferProgress: vi.fn(),
  onTransferComplete: vi.fn(),
  onTransferError: vi.fn(),
  onOutgoingProgress: vi.fn(),
  onOutgoingComplete: vi.fn(),
  onOutgoingError: vi.fn(),
  addOutgoing: vi.fn(),
  clear: vi.fn()
};

vi.mock('~/features/transport/composables/useFileTransfer', () => ({
  useFileTransfer: () => fileTransferMock
}));

function makeMessage (id: string, author: string, content: string): ChatMessage {
  return { id, author, content, timestamp: Date.now() };
}

function makeTransport (overrides: Partial<UseRoomTransportReturn> = {}): UseRoomTransportReturn {
  return {
    join: vi.fn(),
    leave: vi.fn(),
    sendMessage: vi.fn().mockReturnValue([]) as UseRoomTransportReturn['sendMessage'],
    sendTyping: vi.fn(),
    sendFile: vi.fn().mockResolvedValue('transfer-1'),
    setFileTransferHandlers: vi.fn(),
    setHandlers: vi.fn(),
    mode: ref<UiTransportMode>(UiTransportMode.Mesh),
    hubPeerId: ref<string | null>(null),
    peers: ref<PeerIdentity[]>([]),
    isHub: ref(false),
    joined: ref(false),
    state: { room: 'test-room', mode: UiTransportMode.Mesh, hubPeerId: null, peers: [], isHub: false },
    ...overrides
  };
}

function mountChat (transport = makeTransport()): VueWrapper {
  return mount(RoomChat, {
    props: { roomName: 'test-room', transport },
    global: {
      stubs: { Icon: { template: '<span class="icon-stub" />' } }
    }
  });
}

describe('RoomChat', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    chatMock.messages.value = [];
    chatMock.draft.value = '';
    chatMock.typingUsers.value = [];
    chatMock.messageStatus.value = {};
    fileTransferMock.transfers.value = [];
    sessionMock.username = 'alice';
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  describe('empty state', () => {
    it('shows empty state when no messages', () => {
      const wrapper = mountChat();
      expect(wrapper.text()).toContain('No messages yet.');
    });

    it('shows messages when present', () => {
      chatMock.messages.value = [makeMessage('1', 'alice', 'hello')];
      const wrapper = mountChat();
      expect(wrapper.text()).toContain('hello');
      expect(wrapper.text()).not.toContain('No messages yet.');
    });
  });

  describe('message display', () => {
    it('shows author name for remote messages', () => {
      chatMock.messages.value = [makeMessage('1', 'bob', 'hi alice')];
      const wrapper = mountChat();
      expect(wrapper.text()).toContain('bob');
    });

    it('hides author name for own messages', () => {
      chatMock.messages.value = [makeMessage('1', 'alice', 'my msg')];
      const wrapper = mountChat();
      expect(wrapper.text()).not.toContain('alice');
    });

    it('shows sending status for own pending message', () => {
      chatMock.messages.value = [makeMessage('1', 'alice', 'msg')];
      chatMock.messageStatus.value = { 1: SendStatus.Pending };
      const wrapper = mountChat();
      expect(wrapper.text()).toContain('Sending');
    });

    it('shows delivered status for own delivered message', () => {
      chatMock.messages.value = [makeMessage('1', 'alice', 'msg')];
      chatMock.messageStatus.value = { 1: SendStatus.Delivered };
      const wrapper = mountChat();
      expect(wrapper.text()).toContain('Delivered');
    });

    it('shows failed status for own failed message', () => {
      chatMock.messages.value = [makeMessage('1', 'alice', 'msg')];
      chatMock.messageStatus.value = { 1: SendStatus.Failed };
      const wrapper = mountChat();
      expect(wrapper.text()).toContain('Failed');
    });

    it('does not show status for remote messages', () => {
      chatMock.messages.value = [makeMessage('1', 'bob', 'hi')];
      chatMock.messageStatus.value = { 1: SendStatus.Delivered };
      const wrapper = mountChat();
      expect(wrapper.text()).not.toContain('Delivered');
    });
  });

  describe('typing indicator', () => {
    it('shows nothing when no one is typing', () => {
      chatMock.typingUsers.value = [];
      const wrapper = mountChat();
      expect(wrapper.text()).not.toContain('typing');
    });

    it('shows single user typing', () => {
      chatMock.typingUsers.value = ['bob'];
      const wrapper = mountChat();
      expect(wrapper.text()).toContain('bob is typing');
    });

    it('shows two users typing', () => {
      chatMock.typingUsers.value = ['bob', 'carol'];
      const wrapper = mountChat();
      expect(wrapper.text()).toContain('bob and carol are typing');
    });

    it('shows 3+ users typing', () => {
      chatMock.typingUsers.value = ['bob', 'carol', 'dave'];
      const wrapper = mountChat();
      expect(wrapper.text()).toContain('bob and 2 others are typing');
    });

    it('excludes own username from typing display', () => {
      chatMock.typingUsers.value = ['alice', 'bob'];
      const wrapper = mountChat();
      expect(wrapper.text()).toContain('bob is typing');
    });
  });

  describe('file transfer display', () => {
    it('shows nothing when no transfers', () => {
      const wrapper = mountChat();
      expect(wrapper.text()).not.toContain('arrow-up');
      expect(wrapper.text()).not.toContain('arrow-down');
    });

    it('shows outgoing transfer with progress', () => {
      fileTransferMock.transfers.value = [{
        id: 't1',
        peerId: 'peer1',
        meta: { id: 't1', name: 'file.txt', size: 1024, mimeType: 'text/plain' },
        direction: 'outgoing',
        progress: 0.5,
        status: 'active'
      }];
      const wrapper = mountChat();
      expect(wrapper.text()).toContain('file.txt');
      expect(wrapper.text()).toContain('50%');
    });

    it('shows completed incoming transfer with Save button', () => {
      fileTransferMock.transfers.value = [{
        id: 't2',
        peerId: 'peer1',
        meta: { id: 't2', name: 'doc.pdf', size: 2048, mimeType: 'application/pdf' },
        direction: 'incoming',
        progress: 1,
        status: 'complete',
        file: new File([''], 'doc.pdf', { type: 'application/pdf' })
      }];
      const wrapper = mountChat();
      expect(wrapper.text()).toContain('Save');
    });

    it('shows completed outgoing transfer as Done', () => {
      fileTransferMock.transfers.value = [{
        id: 't3',
        peerId: 'peer1',
        meta: { id: 't3', name: 'img.png', size: 512, mimeType: 'image/png' },
        direction: 'outgoing',
        progress: 1,
        status: 'complete'
      }];
      const wrapper = mountChat();
      expect(wrapper.text()).toContain('Done');
    });

    it('shows failed transfer', () => {
      fileTransferMock.transfers.value = [{
        id: 't4',
        peerId: 'peer1',
        meta: { id: 't4', name: 'bad.bin', size: 100, mimeType: '' },
        direction: 'outgoing',
        progress: 0,
        status: 'error',
        error: 'channel closed'
      }];
      const wrapper = mountChat();
      expect(wrapper.text()).toContain('Failed');
    });
  });

  describe('send button', () => {
    it('is disabled when draft is empty', () => {
      chatMock.draft.value = '';
      const wrapper = mountChat();
      const sendBtn = wrapper.find('[aria-label="Send message"]');
      expect(sendBtn.attributes('disabled')).toBeDefined();
    });

    it('is disabled when username is empty', () => {
      sessionMock.username = '';
      chatMock.draft.value = 'hello';
      const wrapper = mountChat();
      const sendBtn = wrapper.find('[aria-label="Send message"]');
      expect(sendBtn.attributes('disabled')).toBeDefined();
    });

    it('is enabled when draft has content and username set', () => {
      chatMock.draft.value = 'hello';
      const wrapper = mountChat();
      const sendBtn = wrapper.find('[aria-label="Send message"]');
      expect(sendBtn.attributes('disabled')).toBeUndefined();
    });
  });

  describe('file button', () => {
    it('is disabled when no peers', () => {
      const transport = makeTransport({ peers: ref<PeerIdentity[]>([]) });
      const wrapper = mountChat(transport);
      const fileBtn = wrapper.find('[aria-label="Send file"]');
      expect(fileBtn.attributes('disabled')).toBeDefined();
    });

    it('is disabled when no username', () => {
      sessionMock.username = '';
      const transport = makeTransport({ peers: ref<PeerIdentity[]>([{ peerId: 'p1', username: 'bob', tiers: [Tier.Adult], publicKey: 'pk-bob' }]) });
      const wrapper = mountChat(transport);
      const fileBtn = wrapper.find('[aria-label="Send file"]');
      expect(fileBtn.attributes('disabled')).toBeDefined();
    });

    it('is enabled when peers exist and username set', () => {
      const transport = makeTransport({ peers: ref<PeerIdentity[]>([{ peerId: 'p1', username: 'bob', tiers: [Tier.Adult], publicKey: 'pk-bob' }]) });
      const wrapper = mountChat(transport);
      const fileBtn = wrapper.find('[aria-label="Send file"]');
      expect(fileBtn.attributes('disabled')).toBeUndefined();
    });
  });

  describe('onSubmit', () => {
    it('sends message and sets delivered status when peers delivered', async () => {
      chatMock.draft.value = 'hello';
      const msg = makeMessage('1', 'alice', 'hello');
      chatMock.sendMessage.mockReturnValue(msg);
      const transport = makeTransport({
        sendMessage: vi.fn().mockResolvedValue(['peer1']) as UseRoomTransportReturn['sendMessage']
      });
      const wrapper = mountChat(transport);
      await wrapper.find('form').trigger('submit.prevent');
      await vi.waitFor(() => { expect(chatMock.setMessageStatus).toHaveBeenCalledWith('1', SendStatus.Delivered); });
      expect(chatMock.sendMessage).toHaveBeenCalledWith('alice', 'hello');
      expect(transport.sendMessage).toHaveBeenCalledWith(msg);
    });

    it('sets delivered in relay mode even with 0 deliveries', async () => {
      chatMock.draft.value = 'hello';
      const msg = makeMessage('1', 'alice', 'hello');
      chatMock.sendMessage.mockReturnValue(msg);
      const transport = makeTransport({
        sendMessage: vi.fn().mockResolvedValue([]) as UseRoomTransportReturn['sendMessage'],
        mode: ref<UiTransportMode>(UiTransportMode.Relay)
      });
      const wrapper = mountChat(transport);
      await wrapper.find('form').trigger('submit.prevent');
      await vi.waitFor(() => { expect(chatMock.setMessageStatus).toHaveBeenCalledWith('1', SendStatus.Delivered); });
    });

    it('does not set delivered when 0 deliveries and not relay', async () => {
      chatMock.draft.value = 'hello';
      const msg = makeMessage('1', 'alice', 'hello');
      chatMock.sendMessage.mockReturnValue(msg);
      const transport = makeTransport({
        sendMessage: vi.fn().mockResolvedValue([]) as UseRoomTransportReturn['sendMessage'],
        mode: ref<UiTransportMode>(UiTransportMode.Mesh)
      });
      const wrapper = mountChat(transport);
      await wrapper.find('form').trigger('submit.prevent');
      // Give the promise a chance to resolve
      await vi.waitFor(() => { expect(chatMock.setMessageStatus).not.toHaveBeenCalled(); });
    });
  });

  describe('file transfer handlers', () => {
    it('calls setFileTransferHandlers on mount', () => {
      const transport = makeTransport();
      mountChat(transport);
      expect(transport.setFileTransferHandlers).toHaveBeenCalled();
    });
  });

  describe('formatFileSize', () => {
    it('formats bytes', () => {
      fileTransferMock.transfers.value = [{
        id: 't1',
        peerId: 'peer1',
        meta: { id: 't1', name: 'f.txt', size: 512, mimeType: '' },
        direction: 'outgoing',
        progress: 1,
        status: 'complete'
      }];
      const wrapper = mountChat();
      expect(wrapper.text()).toContain('512 B');
    });

    it('formats KB', () => {
      fileTransferMock.transfers.value = [{
        id: 't1',
        peerId: 'peer1',
        meta: { id: 't1', name: 'f.txt', size: 2048, mimeType: '' },
        direction: 'outgoing',
        progress: 1,
        status: 'complete'
      }];
      const wrapper = mountChat();
      expect(wrapper.text()).toContain('2.0 KB');
    });

    it('formats MB', () => {
      fileTransferMock.transfers.value = [{
        id: 't1',
        peerId: 'peer1',
        meta: { id: 't1', name: 'f.txt', size: 1024 * 1024, mimeType: '' },
        direction: 'outgoing',
        progress: 1,
        status: 'complete'
      }];
      const wrapper = mountChat();
      expect(wrapper.text()).toContain('1.0 MB');
    });
  });
});
