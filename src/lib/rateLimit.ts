/**
 * Rate Limiting Utility
 * 
 * In-memory rate limiter for protecting API routes from abuse.
 * Suitable for single-instance deployments (current Railway setup).
 * 
 * For multi-instance environments, migrate to Redis-based solution.
 */

interface RateLimitRecord {
    count: number;
    resetTime: number;
}

const rateLimitMap = new Map<string, RateLimitRecord>();

// Cleanup expired records every 5 minutes to prevent memory leaks
setInterval(() => {
    const now = Date.now();
    for (const [key, record] of rateLimitMap.entries()) {
        if (now > record.resetTime) {
            rateLimitMap.delete(key);
        }
    }
}, 5 * 60 * 1000);

export interface RateLimitResult {
    success: boolean;
    remaining: number;
    resetTime?: number;
}

/**
 * Rate limit a request based on identifier
 * 
 * @param identifier - Unique identifier (e.g., IP, user ID, email)
 * @param limit - Maximum requests allowed in the window
 * @param windowMs - Time window in milliseconds (default: 60000 = 1 minute)
 * @returns Result indicating if request is allowed
 * 
 * @example
 * ```typescript
 * const result = rateLimit('user:123', 10, 60000);
 * if (!result.success) {
 *   return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
 * }
 * ```
 */
export function rateLimit(
    identifier: string,
    limit: number = 10,
    windowMs: number = 60000
): RateLimitResult {
    const now = Date.now();
    const record = rateLimitMap.get(identifier);

    // No record or window expired - allow and create new record
    if (!record || now > record.resetTime) {
        const resetTime = now + windowMs;
        rateLimitMap.set(identifier, { count: 1, resetTime });
        return { success: true, remaining: limit - 1, resetTime };
    }

    // Limit exceeded
    if (record.count >= limit) {
        return { success: false, remaining: 0, resetTime: record.resetTime };
    }

    // Increment count and allow
    record.count++;
    return { success: true, remaining: limit - record.count, resetTime: record.resetTime };
}

/**
 * Helper to get client identifier from request
 * Uses authenticated user ID if available, otherwise falls back to IP address
 * 
 * @param req - Next.js request object
 * @param user - Optional authenticated user object
 * @returns Unique identifier string
 */
export function getClientIdentifier(req: any, user?: { id: number }): string {
    // Prefer user ID if authenticated
    if (user?.id) {
        return `user:${user.id}`;
    }

    // Fallback to IP address
    const forwarded = req.headers.get('x-forwarded-for');
    const ip = forwarded ? forwarded.split(',')[0].trim() : req.headers.get('x-real-ip') || 'unknown';
    return `ip:${ip}`;
}
