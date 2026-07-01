import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useSessionStore } from './Session';
import { Tier } from '#shared/types/Tier';

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
    session.setSession('alice', [Tier.Adult]);
    expect(session.username).toBe('alice');
    expect(session.tiers).toEqual([Tier.Adult]);
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
    session.setSession('charlie', [Tier.Minor]);
    session.clear();
    expect(session.username).toBeNull();
    expect(session.tiers).toEqual([]);
    expect(session.isAuthenticated).toBe(false);
  });

  it('clear resets username and tiers', () => {
    const session = useSessionStore();
    session.setSession('dana', [Tier.Adult, Tier.Minor]);
    session.clear();
    expect(session.username).toBeNull();
    expect(session.tiers).toEqual([]);
    expect(session.isAuthenticated).toBe(false);
  });

  it('supports multiple tiers for future partitioning', () => {
    const session = useSessionStore();
    session.setSession('eve', [Tier.Adult, Tier.Minor]);
    expect(session.tiers).toEqual([Tier.Adult, Tier.Minor]);
    expect(session.isAuthenticated).toBe(true);
  });
});
