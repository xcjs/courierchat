import type { ChatMessage } from '#shared/types/ChatMessage';

export interface RoomChatState {
  messages: ChatMessage[];
  pending: ChatMessage[];
  participants: string[];
}

export type SendStatus = 'pending' | 'delivered' | 'failed';
