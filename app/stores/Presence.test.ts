import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { usePresenceStore } from './Presence';
import { PresenceStatus } from '#shared/types/Signaling';

describe('PresenceStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('starts empty with zero online count', () => {
    const presence = usePresenceStore();
    expect(presence.onlineUsernames).toEqual([]);
    expect(presence.onlineCount).toBe(0);
  });

  it('setOnlineUsernames replaces the list', () => {
    const presence = usePresenceStore();
    presence.setOnlineUsernames(['alice', 'bob']);
    expect(presence.onlineUsernames).toEqual(['alice', 'bob']);
    expect(presence.onlineCount).toBe(2);
  });

  it('setOnlineUsernames creates a copy (no mutation aliasing)', () => {
    const presence = usePresenceStore();
    const input = ['alice', 'bob'];
    presence.setOnlineUsernames(input);
    input.push('carol');
    expect(presence.onlineUsernames).toEqual(['alice', 'bob']);
  });

  it('updatePresence online adds new username', () => {
    const presence = usePresenceStore();
    presence.setOnlineUsernames(['alice']);
    presence.updatePresence('bob', PresenceStatus.Online);
    expect(presence.onlineUsernames).toEqual(['alice', 'bob']);
    expect(presence.onlineCount).toBe(2);
  });

  it('updatePresence online is no-op for existing username', () => {
    const presence = usePresenceStore();
    presence.setOnlineUsernames(['alice', 'bob']);
    presence.updatePresence('alice', PresenceStatus.Online);
    expect(presence.onlineUsernames).toEqual(['alice', 'bob']);
    expect(presence.onlineCount).toBe(2);
  });

  it('updatePresence offline removes username', () => {
    const presence = usePresenceStore();
    presence.setOnlineUsernames(['alice', 'bob']);
    presence.updatePresence('bob', PresenceStatus.Offline);
    expect(presence.onlineUsernames).toEqual(['alice']);
    expect(presence.onlineCount).toBe(1);
  });

  it('updatePresence offline is no-op for missing username', () => {
    const presence = usePresenceStore();
    presence.setOnlineUsernames(['alice']);
    presence.updatePresence('bob', PresenceStatus.Offline);
    expect(presence.onlineUsernames).toEqual(['alice']);
  });

  it('isOnline returns true for online user', () => {
    const presence = usePresenceStore();
    presence.setOnlineUsernames(['alice', 'bob']);
    expect(presence.isOnline('alice')).toBe(true);
  });

  it('isOnline returns false for offline user', () => {
    const presence = usePresenceStore();
    presence.setOnlineUsernames(['alice']);
    expect(presence.isOnline('bob')).toBe(false);
  });

  it('reset clears the list', () => {
    const presence = usePresenceStore();
    presence.setOnlineUsernames(['alice', 'bob']);
    presence.reset();
    expect(presence.onlineUsernames).toEqual([]);
    expect(presence.onlineCount).toBe(0);
  });
});
