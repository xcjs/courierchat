import { describe, it, expect } from 'vitest';
import { decideAuth } from '../../app/middleware/decideAuth';

describe('decideAuth', () => {
  it('allows /login without authentication', () => {
    expect(decideAuth({ path: '/login', username: null, tiers: [] })).toEqual({ action: 'allow' });
  });

  it('allows /about without authentication', () => {
    expect(decideAuth({ path: '/about', username: null, tiers: [] })).toEqual({ action: 'allow' });
  });

  it('redirects to /login when unauthenticated on a protected route', () => {
    expect(decideAuth({ path: '/rooms', username: null, tiers: [] })).toEqual({
      action: 'redirect',
      destination: '/login'
    });
  });

  it('redirects to /login when username is set but tiers is empty', () => {
    expect(decideAuth({ path: '/rooms', username: 'alice', tiers: [] })).toEqual({
      action: 'redirect',
      destination: '/login'
    });
  });

  it('redirects to /login when tiers is set but username is null', () => {
    expect(decideAuth({ path: '/rooms', username: null, tiers: ['adult'] })).toEqual({
      action: 'redirect',
      destination: '/login'
    });
  });

  it('allows a protected route when authenticated with username and tiers', () => {
    expect(decideAuth({ path: '/rooms', username: 'alice', tiers: ['adult'] })).toEqual({
      action: 'allow'
    });
  });

  it('allows a deep room route when authenticated', () => {
    expect(decideAuth({ path: '/rooms/general', username: 'bob', tiers: ['minor'] })).toEqual({
      action: 'allow'
    });
  });

  it('allows /settings when authenticated', () => {
    expect(decideAuth({ path: '/settings', username: 'carol', tiers: ['adult'] })).toEqual({
      action: 'allow'
    });
  });

  it('redirects on unknown routes when unauthenticated', () => {
    expect(decideAuth({ path: '/unknown', username: null, tiers: [] })).toEqual({
      action: 'redirect',
      destination: '/login'
    });
  });
});
