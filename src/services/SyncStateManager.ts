/**
 * SyncStateManager
 *
 * Responsibility: Manage in-memory synchronization state for the job automation flow.
 * Isolated so it can be easily mocked in unit tests.
 */

export interface SyncState {
    isSyncing: boolean;
    logs: string[];
    lastRunAt: string | null;
}

export class SyncStateManager {
    private _isSyncing = false;
    private _logs: string[] = [];
    private _lastRunAt: string | null = null;

    private static readonly MAX_LOGS = 50;

    get isSyncing(): boolean {
        return this._isSyncing;
    }

    get logs(): string[] {
        return [...this._logs];
    }

    get lastRunAt(): string | null {
        return this._lastRunAt;
    }

    start(): void {
        this._isSyncing = true;
        this._logs = [];
    }

    finish(): void {
        this._isSyncing = false;
        this._lastRunAt = new Date().toISOString();
    }

    addLog(message: string): void {
        this._logs.push(`[${new Date().toISOString()}] ${message}`);
        if (this._logs.length > SyncStateManager.MAX_LOGS) {
            this._logs.shift();
        }
    }

    getState(): SyncState {
        return {
            isSyncing: this._isSyncing,
            logs: this.logs,
            lastRunAt: this._lastRunAt,
        };
    }
}
