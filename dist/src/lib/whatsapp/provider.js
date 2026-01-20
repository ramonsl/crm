"use strict";
/**
 * WhatsApp Provider Switcher
 *
 * Permite trocar entre whatsapp-web.js e Baileys via variável de ambiente
 *
 * Configuração: WHATSAPP_PROVIDER=baileys | wwebjs (default: baileys)
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.baileysState = exports.getProvider = void 0;
exports.setProvider = setProvider;
exports.initializeWhatsApp = initializeWhatsApp;
exports.getWhatsAppStatus = getWhatsAppStatus;
exports.isWhatsAppReady = isWhatsAppReady;
exports.sendWhatsAppMessage = sendWhatsAppMessage;
exports.getContactProfilePicture = getContactProfilePicture;
exports.validateWhatsAppNumber = validateWhatsAppNumber;
exports.restartWhatsApp = restartWhatsApp;
exports.logoutWhatsApp = logoutWhatsApp;
exports.resetWhatsAppSession = resetWhatsAppSession;
exports.onWhatsAppMessage = onWhatsAppMessage;
exports.getCurrentProvider = getCurrentProvider;
const baileys_1 = require("./baileys");
Object.defineProperty(exports, "baileysState", { enumerable: true, get: function () { return baileys_1.baileysState; } });
const logger_1 = require("../../lib/logger");
// Selected provider (can be overridden by UI)
let selectedProvider = null;
// Get current provider (priority: selectedProvider > env var > default)
const getProvider = () => {
    var _a;
    // If user selected a provider via UI, use it
    if (selectedProvider) {
        return selectedProvider;
    }
    // Otherwise, check environment variable
    const envProvider = (_a = process.env.WHATSAPP_PROVIDER) === null || _a === void 0 ? void 0 : _a.toLowerCase();
    if (envProvider === 'wwebjs') {
        return 'wwebjs';
    }
    return 'baileys'; // Default to Baileys
};
exports.getProvider = getProvider;
/**
 * Set the provider to use (called from UI)
 */
function setProvider(provider) {
    selectedProvider = provider;
    logger_1.whatsappLogger.info(`Provider set to: ${provider}`);
}
// Global state tracking
let currentProvider = null;
/**
 * Initialize WhatsApp client using configured or specified provider
 * @param providerOverride Optional provider to use (overrides current selection)
 */
async function initializeWhatsApp(providerOverride) {
    // If override provided, save it as selected
    if (providerOverride) {
        setProvider(providerOverride);
    }
    const provider = (0, exports.getProvider)();
    currentProvider = provider;
    logger_1.whatsappLogger.info(`Initializing WhatsApp with provider: ${provider}`);
    if (provider === 'baileys') {
        await (0, baileys_1.initializeBaileys)();
    }
    else {
        // Import whatsapp-web.js implementation dynamically to avoid loading when not needed
        const { getClient } = await Promise.resolve().then(() => __importStar(require('./index')));
        getClient();
    }
}
/**
 * Get current connection status
 */
async function getWhatsAppStatus() {
    const provider = (0, exports.getProvider)();
    if (provider === 'baileys') {
        return (0, baileys_1.getBaileysStatus)();
    }
    else {
        const { getStatus } = await Promise.resolve().then(() => __importStar(require('./index')));
        return getStatus();
    }
}
/**
 * Check if client is ready
 */
async function isWhatsAppReady() {
    const provider = (0, exports.getProvider)();
    if (provider === 'baileys') {
        return (0, baileys_1.isBaileysReady)();
    }
    else {
        const { isClientReady } = await Promise.resolve().then(() => __importStar(require('./index')));
        return isClientReady();
    }
}
/**
 * Send a message
 */
async function sendWhatsAppMessage(phone, message, mediaUrl, mediaType) {
    const provider = (0, exports.getProvider)();
    if (provider === 'baileys') {
        return (0, baileys_1.sendBaileysMessage)(phone, message, mediaUrl);
    }
    else {
        const { sendMessage } = await Promise.resolve().then(() => __importStar(require('./index')));
        return sendMessage(phone, message, mediaUrl, mediaType);
    }
}
/**
 * Get profile picture URL
 */
async function getContactProfilePicture(phone) {
    const provider = (0, exports.getProvider)();
    if (provider === 'baileys') {
        return (0, baileys_1.getBaileysProfilePicture)(phone);
    }
    else {
        const { getContactProfilePicture: getPic } = await Promise.resolve().then(() => __importStar(require('./index')));
        return getPic(phone);
    }
}
/**
 * Validate WhatsApp number
 */
async function validateWhatsAppNumber(phone) {
    const provider = (0, exports.getProvider)();
    if (provider === 'baileys') {
        return (0, baileys_1.validateBaileysNumber)(phone);
    }
    else {
        const { validateWhatsAppNumber: validate } = await Promise.resolve().then(() => __importStar(require('./index')));
        return validate(phone);
    }
}
/**
 * Restart client
 */
async function restartWhatsApp() {
    const provider = (0, exports.getProvider)();
    if (provider === 'baileys') {
        await (0, baileys_1.restartBaileys)();
    }
    else {
        const { restartClient } = await Promise.resolve().then(() => __importStar(require('./index')));
        await restartClient();
    }
}
/**
 * Logout
 */
async function logoutWhatsApp() {
    const provider = (0, exports.getProvider)();
    if (provider === 'baileys') {
        await (0, baileys_1.logoutBaileys)();
    }
    else {
        const { logout } = await Promise.resolve().then(() => __importStar(require('./index')));
        await logout();
    }
}
/**
 * Reset session
 */
async function resetWhatsAppSession(autoReconnect = true) {
    const provider = (0, exports.getProvider)();
    if (provider === 'baileys') {
        await (0, baileys_1.clearSession)();
        if (autoReconnect) {
            await (0, baileys_1.initializeBaileys)();
        }
    }
    else {
        const { resetSession } = await Promise.resolve().then(() => __importStar(require('./index')));
        await resetSession(autoReconnect);
    }
}
/**
 * Register message handler
 */
function onWhatsAppMessage(callback) {
    const provider = (0, exports.getProvider)();
    if (provider === 'baileys') {
        (0, baileys_1.onBaileysMessage)(callback);
    }
    else {
        // For wwebjs, messages are handled via event handlers in client.ts
        logger_1.whatsappLogger.warn('Message callback not directly supported for wwebjs provider');
    }
}
/**
 * Get current provider being used
 */
function getCurrentProvider() {
    return currentProvider;
}
