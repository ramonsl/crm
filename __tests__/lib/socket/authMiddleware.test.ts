import { socketAuthMiddleware } from '@/lib/socket/authMiddleware';
import { Socket } from 'socket.io';


// Since we can't easily change the mock factory within the `it` blocks for top-level imports in Jest (without isolateModules),
// We will use a mutable mock implementation.

const mockAuthServiceValidate = jest.fn();

jest.mock('@/services/AuthService', () => {
    return {
        AuthService: jest.fn().mockImplementation(() => ({
            validateSession: mockAuthServiceValidate
        }))
    };
});

describe('Socket Auth Middleware (Security #81) - Implementation', () => {
    let mockSocket: any;
    let next: jest.Mock;

    beforeEach(() => {
        jest.clearAllMocks();
        mockSocket = {
            handshake: {
                headers: {}
            },
            data: {}
        };
        next = jest.fn();
    });

    it('should call next with error if no cookies provided', async () => {
        mockSocket.handshake.headers.cookie = undefined;
        await socketAuthMiddleware(mockSocket, next);
        expect(next).toHaveBeenCalledWith(expect.any(Error));
        expect(next.mock.calls[0][0].message).toBe('Authentication required');
    });

    it('should call next with error if no session_id in cookie', async () => {
        mockSocket.handshake.headers.cookie = 'foo=bar; baz=qux';
        await socketAuthMiddleware(mockSocket, next);
        expect(next).toHaveBeenCalledWith(expect.any(Error));
        expect(next.mock.calls[0][0].message).toBe('Session required');
    });

    it('should call next with error if session is invalid', async () => {
        mockSocket.handshake.headers.cookie = 'session_id=invalid-session';
        mockAuthServiceValidate.mockResolvedValue({ valid: false, error: 'Expired' });

        await socketAuthMiddleware(mockSocket, next);

        expect(mockAuthServiceValidate).toHaveBeenCalledWith('invalid-session');
        expect(next).toHaveBeenCalledWith(expect.any(Error));
        expect(next.mock.calls[0][0].message).toBe('Invalid or expired session');
    });

    it('should call next() and populate socket.data if session is valid', async () => {
        mockSocket.handshake.headers.cookie = 'other=thing; session_id=valid-123';
        mockAuthServiceValidate.mockResolvedValue({
            valid: true,
            user: { id: 99, email: 'test@test.com', role: 'admin' }
        });

        await socketAuthMiddleware(mockSocket, next);

        expect(mockAuthServiceValidate).toHaveBeenCalledWith('valid-123');
        expect(next).toHaveBeenCalledWith(); // Called with no args
        expect(mockSocket.data.sessionId).toBe('valid-123');
        expect(mockSocket.data.userId).toBe(99);
        expect(mockSocket.data.userRole).toBe('admin');
    });
});
