/**
 * SyncStateManager unit tests
 */

import { SyncStateManager } from '@/services/SyncStateManager';

describe('SyncStateManager', () => {
    let manager: SyncStateManager;

    beforeEach(() => {
        manager = new SyncStateManager();
    });

    it('starts not syncing', () => {
        expect(manager.isSyncing).toBe(false);
    });

    it('sets isSyncing to true on start()', () => {
        manager.start();
        expect(manager.isSyncing).toBe(true);
    });

    it('sets isSyncing to false and records lastRunAt on finish()', () => {
        manager.start();
        manager.finish();
        expect(manager.isSyncing).toBe(false);
        expect(manager.lastRunAt).not.toBeNull();
    });

    it('clears logs on start()', () => {
        manager.addLog('previous log');
        manager.start();
        expect(manager.logs).toHaveLength(0);
    });

    it('adds timestamped logs via addLog()', () => {
        manager.addLog('test message');
        expect(manager.logs).toHaveLength(1);
        expect(manager.logs[0]).toContain('test message');
    });

    it('caps logs at 50 entries', () => {
        manager.start();
        for (let i = 0; i < 60; i++) {
            manager.addLog(`log ${i}`);
        }
        expect(manager.logs.length).toBeLessThanOrEqual(50);
    });

    it('getState() returns a snapshot', () => {
        manager.start();
        manager.addLog('hello');
        const state = manager.getState();
        expect(state.isSyncing).toBe(true);
        expect(state.logs).toHaveLength(1);
        expect(state.lastRunAt).toBeNull();
    });

    it('logs array returned by getter is a copy (immutable)', () => {
        manager.addLog('entry');
        const logs = manager.logs;
        logs.push('injected');
        expect(manager.logs).toHaveLength(1);
    });
});
