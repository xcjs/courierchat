import type { Ref } from 'vue';
import { useState } from '#imports';
import type { ChatMessage } from '#shared/types/ChatMessage';

function genId (): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export interface RoomChat {
  messages: Ref<ChatMessage[]>;
  draft: Ref<string>;
  participants: Ref<string[]>;
  typingUsers: Ref<string[]>;
  sendMessage: (author: string, content: string) => ChatMessage;
  pushRemote: (message: ChatMessage) => void;
  setDraft: (value: string) => void;
  setTyping: (username: string, isTyping: boolean) => void;
  clear: () => void;
}

export function useRoomChat (roomName: string): RoomChat {
  const messages = useState<ChatMessage[]>(`room:${roomName}:messages`, () => []);
  const draft = useState<string>(`room:${roomName}:draft`, () => '');
  const participants = useState<string[]>(`room:${roomName}:participants`, () => []);
  const typingUsers = useState<string[]>(`room:${roomName}:typing`, () => []);

  function sendMessage (author: string, content: string): ChatMessage {
    const trimmed = content.trim();
    if (trimmed === '') {
      throw new Error('Cannot send an empty message');
    }
    const message: ChatMessage = { id: genId(), author, content: trimmed, timestamp: Date.now() };
    messages.value = [...messages.value, message];
    draft.value = '';
    return message;
  }

  function pushRemote (message: ChatMessage): void {
    if (messages.value.some(m => m.id === message.id)) { return; }
    messages.value = [...messages.value, message];
  }

  function setDraft (value: string): void {
    draft.value = value;
  }

  function setTyping (username: string, isTyping: boolean): void {
    if (isTyping) {
      if (!typingUsers.value.includes(username)) {
        typingUsers.value = [...typingUsers.value, username];
      }
    } else {
      typingUsers.value = typingUsers.value.filter(u => u !== username);
    }
  }

  function clear (): void {
    messages.value = [];
    draft.value = '';
    participants.value = [];
    typingUsers.value = [];
  }

  return { messages, draft, participants, typingUsers, sendMessage, pushRemote, setDraft, setTyping, clear };
}
