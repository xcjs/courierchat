import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useSessionStore } from './Session';

describe('SessionStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('starts unauthenticated with no username and empty tiers', () => {
    const session = useSessionStore();
    expect(session.username).toBeNull();
    expect(session.tiers).toEqual([]);
    expect(session.isAuthenticated).toBe(false);
  });

  it('setSession stores username and tiers; isAuthenticated becomes true', () => {
    const session = useSessionStore();
    session.setSession('alice', ['adult']);
    expect(session.username).toBe('alice');
    expect(session.tiers).toEqual(['adult']);
    expect(session.isAuthenticated).toBe(true);
  });

  it('isAuthenticated is false when tiers array is empty even with a username', () => {
    const session = useSessionStore();
    session.setSession('bob', []);
    expect(session.username).toBe('bob');
    expect(session.tiers).toEqual([]);
    expect(session.isAuthenticated).toBe(false);
  });

  it('isAuthenticated is false when username is null even with tiers', () => {
    const session = useSessionStore();
    session.setSession('charlie', ['minor']);
    session.clear();
    expect(session.username).toBeNull();
    expect(session.tiers).toEqual([]);
    expect(session.isAuthenticated).toBe(false);
  });

  it('clear resets username and tiers', () => {
    const session = useSessionStore();
    session.setSession('dana', ['adult', 'minor']);
    session.clear();
    expect(session.username).toBeNull();
    expect(session.tiers).toEqual([]);
    expect(session.isAuthenticated).toBe(false);
  });

  it('supports multiple tiers for future partitioning', () => {
    const session = useSessionStore();
    session.setSession('eve', ['adult', 'minor']);
    expect(session.tiers).toEqual(['adult', 'minor']);
    expect(session.isAuthenticated).toBe(true);
  });
});
