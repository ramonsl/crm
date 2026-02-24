
import * as dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

import { GET } from '../src/app/api/activities/route';
import { NextRequest } from 'next/server';

// Mock NextRequest
function createRequest(url: string) {
    return {
        url: `http://localhost:3000${url}`,
        nextUrl: new URL(`http://localhost:3000${url}`),
    } as unknown as NextRequest;
}

async function testApi() {
    const cpf = '03316055037'; // Selso
    console.log(`Testing API for CPF: ${cpf}`);

    // 1. request with includeMessages (implicit)
    const req1 = createRequest(`/api/activities?cpf=${cpf}`);
    const res1 = await GET(req1);
    console.log(`Status 1: ${res1.status}`);
    if (!res1.ok) {
        console.log('Error 1:', await res1.text());
        return;
    }
    const data1 = await res1.json();
    console.log('--- Response (Implicit includeMessages) ---');
    console.log(`Status: ${res1.status}`);
    console.log(`Count: ${data1.data?.length}`);
    if (data1.data?.length === 0) console.log('⚠️  Empty result!');

    // 2. request EXPLICIT includeMessages=true
    const req2 = createRequest(`/api/activities?cpf=${cpf}&includeMessages=true`);
    const res2 = await GET(req2);
    const data2 = await res2.json();
    console.log('\n--- Response (Explicit includeMessages=true) ---');
    console.log(`Count: ${data2.data?.length}`);

    // Check if data structure is correct
    if (data2.data?.length > 0) {
        console.log('Sample item:', data2.data[0]);
    }
}

testApi();
