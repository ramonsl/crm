/**
 * AuthService - Authentication Service
 * Handles user authentication, registration, and session management
 * 
 * Follows SOLID principles with clear separation of concerns
 * Uses Neon PostgreSQL async database operations
 */

import bcrypt from 'bcryptjs';
import { UserRepository } from '@/lib/repositories/UserRepository';
import { SessionRepository } from '@/lib/repositories/SessionRepository';
import type { UserRow } from '@/lib/types';
import type {
    IAuthService,
    RegisterResult,
    LoginResult,
    SessionValidationResult
} from './interfaces';
import { authLogger } from '@/lib/logger';

const SALT_ROUNDS = 10;
const SESSION_DURATION_DAYS = 30;

// Re-export types for backwards compatibility
export type { RegisterResult, LoginResult, SessionValidationResult };

export class AuthService implements IAuthService {
    private userRepo: UserRepository;
    private sessionRepo: SessionRepository;

    constructor() {
        this.userRepo = new UserRepository();
        this.sessionRepo = new SessionRepository();
    }

    /**
     * Register a new user
     */
    async register(email: string, password: string, name: string): Promise<RegisterResult> {
        try {
            // Validate input
            if (!email || !password || !name) {
                return { success: false, error: 'Email, senha e nome são obrigatórios' };
            }

            // Check if email already exists
            const existingUser = await this.userRepo.findByEmail(email);
            if (existingUser) {
                return { success: false, error: 'Email já cadastrado' };
            }

            // Hash password
            const password_hash = await bcrypt.hash(password, SALT_ROUNDS);

            // Create user
            const user = await this.userRepo.create({
                email,
                password_hash,
                name,
                role: 'user'
            });

            // Remove password_hash from response
            const { password_hash: _, ...userWithoutPassword } = user;

            return {
                success: true,
                user: userWithoutPassword
            };
        } catch (error) {
            authLogger.error('Registration error:', error);
            return {
                success: false,
                error: 'Erro ao registrar usuário'
            };
        }
    }

    /**
     * Login user and create session
     */
    async login(email: string, password: string): Promise<LoginResult> {
        try {
            // Validate input
            if (!email || !password) {
                return { success: false, error: 'Email e senha são obrigatórios' };
            }

            // Find user
            const user = await this.userRepo.findByEmail(email);
            if (!user) {
                return { success: false, error: 'Email ou senha inválidos' };
            }

            // Check if user is active
            if (!user.active) {
                return { success: false, error: 'Usuário desativado' };
            }

            // Verify password
            const passwordMatch = await bcrypt.compare(password, user.password_hash);
            if (!passwordMatch) {
                return { success: false, error: 'Email ou senha inválidos' };
            }

            // Create session
            const expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + SESSION_DURATION_DAYS);
            const session = await this.sessionRepo.create(user.id, expiresAt.toISOString());

            // Remove password_hash from response
            const { password_hash: _, ...userWithoutPassword } = user;

            return {
                success: true,
                sessionId: session.id,
                user: userWithoutPassword
            };
        } catch (error) {
            authLogger.error('Login error:', error);
            return {
                success: false,
                error: 'Erro ao fazer login'
            };
        }
    }

    /**
     * Logout user (invalidate session)
     */
    async logout(sessionId: string): Promise<void> {
        try {
            await this.sessionRepo.delete(sessionId);
        } catch (error) {
            authLogger.error('Logout error:', error);
        }
    }

    /**
     * Validate session and return user
     */
    async validateSession(sessionId: string): Promise<SessionValidationResult> {
        try {
            if (!sessionId) {
                return { valid: false, error: 'Session ID não fornecido' };
            }

            // Find session
            const session = await this.sessionRepo.findById(sessionId);
            if (!session) {
                return { valid: false, error: 'Sessão não encontrada' };
            }

            // Check if session is expired
            const now = new Date();
            const expiresAt = new Date(session.expires_at);
            if (now > expiresAt) {
                // Clean up expired session
                await this.sessionRepo.delete(sessionId);
                return { valid: false, error: 'Sessão expirada' };
            }

            // Find user
            const user = await this.userRepo.findById(session.user_id);
            if (!user) {
                return { valid: false, error: 'Usuário não encontrado' };
            }

            // Check if user is active
            if (!user.active) {
                return { valid: false, error: 'Usuário desativado' };
            }

            // Remove password_hash from response
            const { password_hash: _, ...userWithoutPassword } = user;

            return {
                valid: true,
                user: userWithoutPassword
            };
        } catch (error) {
            authLogger.error('Session validation error:', error);
            return {
                valid: false,
                error: 'Erro ao validar sessão'
            };
        }
    }

    /**
     * Get user from session
     */
    async getUserFromSession(sessionId: string): Promise<Omit<UserRow, 'password_hash'> | null> {
        const result = await this.validateSession(sessionId);
        return result.valid ? result.user! : null;
    }

    /**
     * Clean up expired sessions
     */
    async cleanupExpiredSessions(): Promise<void> {
        try {
            await this.sessionRepo.deleteExpired();
        } catch (error) {
            authLogger.error('Cleanup error:', error);
        }
    }

    /**
     * Change user password
     */
    async changePassword(userId: number, newPassword: string): Promise<void> {
        const hashedPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);
        await this.userRepo.update(userId, { password_hash: hashedPassword });
    }
}
