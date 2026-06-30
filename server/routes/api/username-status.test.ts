import { describe, it, expect } from 'vitest';
import { evaluateUsername } from '../../services/UsernameEvaluation';

describe('evaluateUsername', () => {
  it('returns available for a non-empty username', () => {
    expect(evaluateUsername('alice')).toEqual({ available: true });
  });

  it('returns invalid for an empty string', () => {
    expect(evaluateUsername('')).toEqual({ available: false, reason: 'invalid' });
  });

  it('returns invalid for a whitespace-only string', () => {
    expect(evaluateUsername('   ')).toEqual({ available: false, reason: 'invalid' });
  });

  it('returns invalid for undefined', () => {
    expect(evaluateUsername(undefined)).toEqual({ available: false, reason: 'invalid' });
  });

  it('returns invalid for an array (multi-value query)', () => {
    expect(evaluateUsername(['alice', 'bob'])).toEqual({ available: false, reason: 'invalid' });
  });

  it('returns invalid for null', () => {
    expect(evaluateUsername(null)).toEqual({ available: false, reason: 'invalid' });
  });

  it('trims before checking emptiness', () => {
    expect(evaluateUsername('  alice  ')).toEqual({ available: true });
  });
});
