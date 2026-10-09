// Contract tests for role ranking (mirrors backend ROLE_RANK).
import { describe, expect, it } from 'vitest';
import { ROLE_RANK, roleAtLeast } from './types';

describe('roleAtLeast', () => {
  it('orders viewer < analyst < approver < admin', () => {
    expect(ROLE_RANK.viewer).toBeLessThan(ROLE_RANK.analyst);
    expect(ROLE_RANK.analyst).toBeLessThan(ROLE_RANK.approver);
    expect(ROLE_RANK.approver).toBeLessThan(ROLE_RANK.admin);
  });

  it('gates analyst-only actions from viewers', () => {
    expect(roleAtLeast('viewer', 'analyst')).toBe(false);
    expect(roleAtLeast('analyst', 'analyst')).toBe(true);
  });

  it('gates approver-only actions (approve/deny, kill switch)', () => {
    expect(roleAtLeast('analyst', 'approver')).toBe(false);
    expect(roleAtLeast('approver', 'approver')).toBe(true);
    expect(roleAtLeast('admin', 'approver')).toBe(true);
  });

  it('gates admin-only mode changes', () => {
    expect(roleAtLeast('approver', 'admin')).toBe(false);
    expect(roleAtLeast('admin', 'admin')).toBe(true);
  });

  it('denies undefined roles', () => {
    expect(roleAtLeast(undefined, 'viewer')).toBe(false);
  });
});
