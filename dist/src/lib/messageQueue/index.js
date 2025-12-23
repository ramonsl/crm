"use strict";
/**
 * MessageQueue Module - Public API
 *
 * This is the main entry point for the message queue.
 * Provides backwards-compatible API while using the refactored modular architecture.
 *
 * Following Facade Pattern: Single entry point to complex subsystem.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.messageQueue = exports.SettingsProvider = exports.MessageHistoryRecorder = exports.AIMessageGenerator = exports.QueueManager = void 0;
const QueueManager_1 = require("./QueueManager");
const AIMessageGenerator_1 = require("./AIMessageGenerator");
const MessageHistoryRecorder_1 = require("./MessageHistoryRecorder");
const SettingsProvider_1 = require("./SettingsProvider");
// Export classes for testing/extension
var QueueManager_2 = require("./QueueManager");
Object.defineProperty(exports, "QueueManager", { enumerable: true, get: function () { return QueueManager_2.QueueManager; } });
var AIMessageGenerator_2 = require("./AIMessageGenerator");
Object.defineProperty(exports, "AIMessageGenerator", { enumerable: true, get: function () { return AIMessageGenerator_2.AIMessageGenerator; } });
var MessageHistoryRecorder_2 = require("./MessageHistoryRecorder");
Object.defineProperty(exports, "MessageHistoryRecorder", { enumerable: true, get: function () { return MessageHistoryRecorder_2.MessageHistoryRecorder; } });
var SettingsProvider_2 = require("./SettingsProvider");
Object.defineProperty(exports, "SettingsProvider", { enumerable: true, get: function () { return SettingsProvider_2.SettingsProvider; } });
// Create singleton instances
const settingsProvider = new SettingsProvider_1.SettingsProvider();
const aiGenerator = new AIMessageGenerator_1.AIMessageGenerator(settingsProvider);
const historyRecorder = new MessageHistoryRecorder_1.MessageHistoryRecorder();
// Get or create singleton queue manager
if (!global.messageQueueModuleInstance) {
    global.messageQueueModuleInstance = new QueueManager_1.QueueManager(aiGenerator, historyRecorder, settingsProvider);
}
/**
 * The singleton message queue instance
 *
 * @example
 * import { messageQueue } from '../../lib/messageQueue';
 *
 * messageQueue.enqueue([{ phone: '5551999999999', message: 'Hello!' }]);
 * const state = messageQueue.getState();
 */
exports.messageQueue = global.messageQueueModuleInstance;
