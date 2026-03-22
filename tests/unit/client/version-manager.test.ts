import { describe, it, expect } from 'vitest';
import { ApiVersionManager } from '../../../src/client/version-manager.js';

describe('ApiVersionManager', () => {
  it('should use provided version', () => {
    const vm = new ApiVersionManager('202603');
    expect(vm.getVersion()).toBe('202603');
  });

  it('should auto-detect version from current date when not provided', () => {
    const vm = new ApiVersionManager();
    const version = vm.getVersion();
    expect(version).toMatch(/^\d{6}$/);
  });

  it('should return correct headers', () => {
    const vm = new ApiVersionManager('202603');
    const headers = vm.getHeaders();

    expect(headers['LinkedIn-Version']).toBe('202603');
    expect(headers['X-Restli-Protocol-Version']).toBe('2.0.0');
  });

  it('should update version', () => {
    const vm = new ApiVersionManager('202601');
    vm.setVersion('202603');
    expect(vm.getVersion()).toBe('202603');
  });

  it('should reject invalid version format', () => {
    const vm = new ApiVersionManager('202603');
    expect(() => vm.setVersion('invalid')).toThrow('Invalid API version format');
    expect(() => vm.setVersion('2026')).toThrow('Invalid API version format');
    expect(() => vm.setVersion('20260301')).toThrow('Invalid API version format');
  });
});
