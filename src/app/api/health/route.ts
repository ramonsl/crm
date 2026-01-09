/**
 * Health Check Endpoint
 * 
 * Provides system health status for monitoring and alerting.
 * Used by Railway, uptime monitors, and internal health checks.
 */

import { NextResponse } from 'next/server';
import { pool } from '@/lib/neonDb';
import { getStatus } from '@/lib/whatsapp';

/**
 * Check database connection health
 */
async function checkDatabaseConnection(): Promise<boolean> {
    try {
        await pool.query('SELECT 1');
        return true;
    } catch (error) {
        console.error('[Health] Database check failed:', error);
        return false;
    }
}

/**
 * GET /api/health
 * Returns comprehensive health status of the application
 */
export async function GET() {
    try {
        const dbHealthy = await checkDatabaseConnection();
        const whatsappStatus = getStatus();

        const healthStatus = {
            status: dbHealthy ? 'healthy' : 'unhealthy',
            timestamp: new Date().toISOString(),
            services: {
                database: {
                    connected: dbHealthy,
                    pool: {
                        total: pool.totalCount,
                        idle: pool.idleCount,
                        waiting: pool.waitingCount,
                    },
                },
                whatsapp: {
                    status: whatsappStatus.status,
                },
            },
        };

        // Return 503 if database is unhealthy
        const statusCode = dbHealthy ? 200 : 503;

        return NextResponse.json(healthStatus, { status: statusCode });
    } catch (error) {
        console.error('[Health] Health check failed:', error);
        return NextResponse.json(
            {
                status: 'error',
                timestamp: new Date().toISOString(),
                error: error instanceof Error ? error.message : 'Unknown error',
            },
            { status: 500 }
        );
    }
}
