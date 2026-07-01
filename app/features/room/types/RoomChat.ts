import type { ChatMessage } from '#shared/types/ChatMessage';

export enum SendStatus {
  Pending = 'pending',
  Delivered = 'delivered',
  Failed = 'failed'
}

export interface RoomChatState {
  messages: ChatMessage[];
  participants: string[];
  messageStatus: Record<string, SendStatus>;
}
