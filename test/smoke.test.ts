import { describe, it, expect } from 'vitest';

describe('smoke test', () => {
  it('verifies Vitest is wired up', () => {
    expect(1 + 1).toBe(2);
  });

  it('verifies TypeScript strict features work', () => {
    const greet = (name: string): string => `Hello, ${name}!`;
    expect(greet('CourierChat')).toBe('Hello, CourierChat!');
  });
});
