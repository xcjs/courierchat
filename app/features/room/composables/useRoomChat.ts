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
  sendMessage: (author: string, content: string) => void;
  setDraft: (value: string) => void;
  clear: () => void;
}

export function useRoomChat (roomName: string): RoomChat {
  const messages = useState<ChatMessage[]>(`room:${roomName}:messages`, () => []);
  const draft = useState<string>(`room:${roomName}:draft`, () => '');
  const participants = useState<string[]>(`room:${roomName}:participants`, () => []);

  function sendMessage (author: string, content: string): void {
    const trimmed = content.trim();
    if (trimmed === '') { return; }
    messages.value = [
      ...messages.value,
      { id: genId(), author, content: trimmed, timestamp: Date.now() }
    ];
    draft.value = '';
  }

  function setDraft (value: string): void {
    draft.value = value;
  }

  function clear (): void {
    messages.value = [];
    draft.value = '';
    participants.value = [];
  }

  return { messages, draft, participants, sendMessage, setDraft, clear };
}
