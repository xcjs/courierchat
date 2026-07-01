import type { ChatMessage } from '#shared/types/ChatMessage';

export type SendStatus = 'pending' | 'delivered' | 'failed';

export interface RoomChatState {
  messages: ChatMessage[];
  participants: string[];
  messageStatus: Record<string, SendStatus>;
}
