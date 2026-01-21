
import { Socket } from 'socket.io';
import { AuthService } from '@/services/AuthService';

export interface AuthenticatedSocket extends Socket {
    data: {
        sessionId?: string;
        userId?: number;
        userRole?: string;
        [key: string]: any;
    }
}

/**
 * Socket.io authentication middleware
 * Validates session_id cookie using AuthService
 */
export const socketAuthMiddleware = async (socket: Socket, next: (err?: any) => void) => {
    try {
        // Extract session from handshake (cookies are automatically sent)
        const cookies = socket.handshake.headers.cookie;

        if (!cookies) {
            console.warn('[Socket] No cookies in handshake');
            return next(new Error('Authentication required'));
        }

        // Helper to parse cookies
        const parseCookies = (cookieStr: string): Record<string, string> => {
            return cookieStr.split(';').reduce((acc, cookie) => {
                const [key, value] = cookie.trim().split('=');
                if (key && value) acc[key] = value;
                return acc;
            }, {} as Record<string, string>);
        };

        const parsedCookies = parseCookies(cookies);
        const sessionId = parsedCookies['session_id'];

        if (!sessionId) {
            console.warn('[Socket] No session_id cookie found');
            return next(new Error('Session required'));
        }

        // Validate session using AuthService
        // We instantiate AuthService here to ensure it uses the latest DB connection/config
        const authService = new AuthService();
        const result = await authService.validateSession(sessionId);

        if (!result.valid || !result.user) {
            console.warn('[Socket] Invalid session:', result.error);
            return next(new Error('Invalid or expired session'));
        }

        // Store validated user data on socket
        socket.data.sessionId = sessionId;
        socket.data.userId = result.user.id;
        socket.data.userRole = result.user.role;

        console.log(`[Socket] Client authenticated: ${socket.id} (user: ${result.user.email})`);
        next();
    } catch (error) {
        console.error('[Socket] Authentication error:', error);
        next(new Error('Authentication failed'));
    }
};
