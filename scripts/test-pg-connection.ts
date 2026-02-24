
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function testConnection() {
    const connectionString = process.env.DATABASE_URL;
    console.log('Testing connection to:', connectionString ? connectionString.split('@')[1] : 'MISSING');

    if (!connectionString) {
        console.error('DATABASE_URL is missing');
        process.exit(1);
    }

    const pool = new Pool({
        connectionString,
        connectionTimeoutMillis: 5000
    });

    try {
        console.log('Connecting...');
        const res = await pool.query('SELECT 1 as connected');
        console.log('Result:', res.rows[0]);
        console.log('✅ Connection successful!');
    } catch (err) {
        console.error('❌ Connection failed:', err);
    } finally {
        await pool.end();
    }
}

testConnection();
