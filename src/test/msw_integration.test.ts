import { describe, it, expect } from 'vitest';

describe('MSW API Mock Integration', () => {
  it('intercepts /api/auth/me request', async () => {
    const response = await fetch('/api/auth/me');
    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data.authenticated).toBe(true);
    expect(data.user.email).toBe('admin@kemit.com');
  });

  it('intercepts /api/transactions request', async () => {
    const response = await fetch('/api/transactions');
    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(Array.isArray(data.transactions)).toBe(true);
  });
});
