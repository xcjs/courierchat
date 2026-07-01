// @vitest-environment nuxt
import { describe, it, expect, beforeEach } from 'vitest';
import { SendStatus } from '../types/RoomChat';
import { useRoomChat } from './useRoomChat';
import type { ChatMessage } from '#shared/types/ChatMessage';

describe('useRoomChat', () => {
  let chat: ReturnType<typeof useRoomChat>;

  beforeEach(() => {
    chat = useRoomChat('test-room');
    chat.clear();
  });

  it('starts with empty messages and draft', () => {
    expect(chat.messages.value).toEqual([]);
    expect(chat.draft.value).toBe('');
    expect(chat.participants.value).toEqual([]);
    expect(chat.typingUsers.value).toEqual([]);
    expect(chat.messageStatus.value).toEqual({});
  });

  it('sendMessage creates a message with id, author, and trimmed content', () => {
    const msg = chat.sendMessage('alice', '  hello  ');
    expect(msg.author).toBe('alice');
    expect(msg.content).toBe('hello');
    expect(msg.id).toBeTruthy();
    expect(msg.timestamp).toBeGreaterThan(0);
    expect(chat.messages.value).toHaveLength(1);
    expect(chat.messages.value[0]).toEqual(msg);
  });

  it('sendMessage resets draft to empty', () => {
    chat.setDraft('typing something');
    chat.sendMessage('alice', 'typing something');
    expect(chat.draft.value).toBe('');
  });

  it('sendMessage throws on empty content', () => {
    expect(() => chat.sendMessage('alice', '')).toThrow('Cannot send an empty message');
    expect(() => chat.sendMessage('alice', '   ')).toThrow('Cannot send an empty message');
  });

  it('sendMessage sets status to pending', () => {
    const msg = chat.sendMessage('alice', 'hello');
    expect(chat.messageStatus.value[msg.id]).toBe(SendStatus.Pending);
  });

  it('pushRemote adds a message without duplicates', () => {
    const msg: ChatMessage = { id: 'remote-1', author: 'bob', content: 'hi', timestamp: 1000 };
    chat.pushRemote(msg);
    expect(chat.messages.value).toHaveLength(1);
    chat.pushRemote(msg);
    expect(chat.messages.value).toHaveLength(1);
  });

  it('setDraft updates the draft value', () => {
    chat.setDraft('new draft');
    expect(chat.draft.value).toBe('new draft');
  });

  it('setTyping adds user to typing list', () => {
    chat.setTyping('alice', true);
    expect(chat.typingUsers.value).toEqual(['alice']);
  });

  it('setTyping does not duplicate existing user', () => {
    chat.setTyping('alice', true);
    chat.setTyping('alice', true);
    expect(chat.typingUsers.value).toEqual(['alice']);
  });

  it('setTyping removes user from typing list', () => {
    chat.setTyping('alice', true);
    chat.setTyping('bob', true);
    chat.setTyping('alice', false);
    expect(chat.typingUsers.value).toEqual(['bob']);
  });

  it('setTyping false is a no-op when user not in list', () => {
    chat.setTyping('alice', false);
    expect(chat.typingUsers.value).toEqual([]);
  });

  it('setMessageStatus updates status for a message', () => {
    const msg = chat.sendMessage('alice', 'hello');
    chat.setMessageStatus(msg.id, SendStatus.Delivered);
    expect(chat.messageStatus.value[msg.id]).toBe(SendStatus.Delivered);
  });

  it('clear resets all state', () => {
    chat.sendMessage('alice', 'hello');
    chat.setDraft('draft');
    chat.setTyping('alice', true);
    chat.pushRemote({ id: 'r1', author: 'bob', content: 'remote', timestamp: 1000 });
    chat.clear();
    expect(chat.messages.value).toEqual([]);
    expect(chat.draft.value).toBe('');
    expect(chat.typingUsers.value).toEqual([]);
    expect(chat.messageStatus.value).toEqual({});
  });
});
