import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { proxy } from './proxy';

function makeRequest(pathname: string, cookieHeader?: string): NextRequest {
  const url = `http://localhost${pathname}`;
  const init: RequestInit & { headers?: Record<string, string> } = {};
  if (cookieHeader) {
    init.headers = { cookie: cookieHeader };
  }
  return new NextRequest(url, init);
}

describe('proxy middleware', () => {
  // ── Public routes ───────────────────────────────────────────────────────

  it('allows / through without a session cookie', () => {
    const res = proxy(makeRequest('/'));
    expect(res.status).toBe(200);
  });

  it('allows /login through without a session cookie', () => {
    const res = proxy(makeRequest('/login'));
    expect(res.status).toBe(200);
  });

  it('allows /login/reset through without a session cookie', () => {
    const res = proxy(makeRequest('/login/reset'));
    expect(res.status).toBe(200);
  });

  // ── Authenticated routes without a session ──────────────────────────────

  it('redirects /dashboard to /login when no session cookie', () => {
    const res = proxy(makeRequest('/dashboard'));
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('/login');
  });

  it('includes the original path in the redirect "from" param', () => {
    const res = proxy(makeRequest('/shifts'));
    const location = res.headers.get('location') ?? '';
    expect(location).toContain('from=%2Fshifts');
  });

  it('redirects /settings to /login when no session cookie', () => {
    const res = proxy(makeRequest('/settings'));
    expect(res.status).toBe(307);
  });

  // ── Authenticated routes with a valid session ───────────────────────────

  it('allows /dashboard through when auth_session cookie is present', () => {
    const res = proxy(makeRequest('/dashboard', 'auth_session=1'));
    expect(res.status).toBe(200);
  });

  it('allows /shifts through when auth_session cookie is present', () => {
    const res = proxy(makeRequest('/shifts', 'auth_session=abc'));
    expect(res.status).toBe(200);
  });

  it('allows deeply nested paths through with a valid session', () => {
    const res = proxy(makeRequest('/admin/reports/2024', 'auth_session=tok'));
    expect(res.status).toBe(200);
  });
});
