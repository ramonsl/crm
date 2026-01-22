"use strict";
/**
 * WhatsApp Provider Wrapper (Adapter Pattern)
 *
 * Ensures compatibility with existing code that imports from 'provider.ts'
 * while delegating all logic to the singleton WhatsAppProviderFactory.
 */
Object.defineProperty(exports, "__esModule", { value: true });
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
exports.initializeBaileys = initializeBaileys;
exports.getBaileysStatus = getBaileysStatus;
exports.sendBaileysMessage = sendBaileysMessage;
exports.restartBaileys = restartBaileys;
exports.logoutBaileys = logoutBaileys;
exports.clearSession = clearSession;
exports.validateBaileysNumber = validateBaileysNumber;
exports.getBaileysProfilePicture = getBaileysProfilePicture;
exports.sendMessage = sendMessage;
exports.getStatus = getStatus;
exports.initialize = initialize;
exports.isReady = isReady;
const WhatsAppProviderFactory_1 = require("./factory/WhatsAppProviderFactory");
const logger_1 = require("../../lib/logger");
/**
 * Initialize WhatsApp client using factory
 */
async function initializeWhatsApp(providerOverride) {
    const provider = await WhatsAppProviderFactory_1.WhatsAppProviderFactory.getProvider();
    await provider.initialize();
}
/**
 * Get current connection status
 */
async function getWhatsAppStatus() {
    const provider = await WhatsAppProviderFactory_1.WhatsAppProviderFactory.getProvider();
    return provider.getStatus();
}
/**
 * Check if client is ready
 */
async function isWhatsAppReady() {
    const provider = await WhatsAppProviderFactory_1.WhatsAppProviderFactory.getProvider();
    return provider.isReady();
}
/**
 * Send a message
 */
async function sendWhatsAppMessage(phone, message, mediaUrl, mediaType) {
    const provider = await WhatsAppProviderFactory_1.WhatsAppProviderFactory.getProvider();
    const providerName = provider.getProviderName();
    const isReady = await provider.isReady();
    const status = await provider.getStatus();
    logger_1.whatsappLogger.info(`[sendWhatsAppMessage] Provider: ${providerName}, Ready: ${isReady}, Status: ${status.status}`);
    if (!isReady) {
        logger_1.whatsappLogger.warn(`[sendWhatsAppMessage] Provider not ready! Status: ${status.status}`);
        return {
            success: false,
            error: `WhatsApp não está pronto (Status: ${status.status})`
        };
    }
    return provider.sendMessage(phone, message, mediaUrl, mediaType);
}
/**
 * Get profile picture URL
 */
async function getContactProfilePicture(phone) {
    const provider = await WhatsAppProviderFactory_1.WhatsAppProviderFactory.getProvider();
    return provider.getProfilePicture(phone);
}
/**
 * Validate WhatsApp number
 */
async function validateWhatsAppNumber(phone) {
    const provider = await WhatsAppProviderFactory_1.WhatsAppProviderFactory.getProvider();
    return provider.validateNumber(phone);
}
/**
 * Restart client
 */
async function restartWhatsApp() {
    const provider = await WhatsAppProviderFactory_1.WhatsAppProviderFactory.getProvider();
    await provider.restart();
}
/**
 * Logout
 */
async function logoutWhatsApp() {
    const provider = await WhatsAppProviderFactory_1.WhatsAppProviderFactory.getProvider();
    await provider.logout();
}
/**
 * Reset session
 */
async function resetWhatsAppSession(autoReconnect = true) {
    const provider = await WhatsAppProviderFactory_1.WhatsAppProviderFactory.getProvider();
    await provider.clearSession(autoReconnect);
}
/**
 * Register message handler
 */
function onWhatsAppMessage(callback) {
    WhatsAppProviderFactory_1.WhatsAppProviderFactory.getProvider().then(provider => {
        provider.onMessage(callback);
    });
}
/**
 * Get current provider name
 */
function getCurrentProvider() {
    return 'active-provider';
}
// Export specific Baileys functions that might be imported by legacy code (mock them via Factory)
async function initializeBaileys() { return initializeWhatsApp(); }
async function getBaileysStatus() { return getWhatsAppStatus(); }
async function sendBaileysMessage(p, m, u) { return sendWhatsAppMessage(p, m, u); }
async function restartBaileys() { return restartWhatsApp(); }
async function logoutBaileys() { return logoutWhatsApp(); }
async function clearSession() { return resetWhatsAppSession(); }
async function validateBaileysNumber(p) { return validateWhatsAppNumber(p); }
async function getBaileysProfilePicture(p) { return getContactProfilePicture(p); }
// Legacy aliases expected by some tests
async function sendMessage(p, m, u, t) { return sendWhatsAppMessage(p, m, u, t); }
async function getStatus() { return getWhatsAppStatus(); }
async function initialize(o) { return initializeWhatsApp(o); }
async function isReady() { return isWhatsAppReady(); }
