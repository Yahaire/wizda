import express from 'express';
import { beforeEach, describe, expect, it } from 'vitest';

import { isFirstSearchToday, resetSearchDedupForTests } from './searchDedup';

function requestFrom(ip: string, userAgent = 'vitest'): express.Request {
  return { ip, headers: { 'user-agent': userAgent } } as unknown as express.Request;
}

describe('isFirstSearchToday', () => {
  beforeEach(() => resetSearchDedupForTests());

  it('counts a combo once per visitor', () => {
    const req = requestFrom('203.0.113.7');
    expect(isFirstSearchToday(req, 'combo-a')).toBe(true);
    expect(isFirstSearchToday(req, 'combo-a')).toBe(false);
  });

  it('counts each distinct combo for the same visitor', () => {
    const req = requestFrom('203.0.113.7');
    expect(isFirstSearchToday(req, 'combo-a')).toBe(true);
    expect(isFirstSearchToday(req, 'combo-b')).toBe(true);
  });

  it('counts the same combo for different visitors', () => {
    expect(isFirstSearchToday(requestFrom('203.0.113.7'), 'combo-a')).toBe(true);
    expect(isFirstSearchToday(requestFrom('203.0.113.8'), 'combo-a')).toBe(true);
    expect(isFirstSearchToday(requestFrom('203.0.113.7', 'other-browser'), 'combo-a')).toBe(true);
  });

  it('forgets everyone when the day rolls over', () => {
    const req = requestFrom('203.0.113.7');
    expect(isFirstSearchToday(req, 'combo-a')).toBe(true);
    resetSearchDedupForTests();
    expect(isFirstSearchToday(req, 'combo-a')).toBe(true);
  });
});
