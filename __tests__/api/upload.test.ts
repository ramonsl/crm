import { POST } from '@/app/api/chat/upload/route';
import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

// Mock fs/promises
jest.mock('fs/promises', () => ({
    writeFile: jest.fn(),
    mkdir: jest.fn(),
}));

// Mock NextRequest
class MockNextRequest extends Request {
    formData: () => Promise<FormData>;

    constructor(url: string, init?: RequestInit & { formData?: FormData }) {
        super(url, init);
        this.formData = async () => init?.formData || new FormData();
    }
}

describe('Upload API', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should upload a file successfully', async () => {
        const file = new File(['dummy content'], 'test.png', { type: 'image/png' });
        const formData = new FormData();
        formData.append('file', file);

        const req = new MockNextRequest('http://localhost/api/chat/upload', {
            method: 'POST',
            formData: formData
        }) as unknown as NextRequest;

        const res = await POST(req);
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.url).toMatch(/^\/uploads\/.*-test\.png$/);
        expect(data.type).toBe('image/png');

        expect(fs.mkdir).toHaveBeenCalled();
        expect(fs.writeFile).toHaveBeenCalled();
    });

    it('should return 400 if no file is uploaded', async () => {
        const formData = new FormData();
        // No file appended

        const req = new MockNextRequest('http://localhost/api/chat/upload', {
            method: 'POST',
            formData: formData
        }) as unknown as NextRequest;

        const res = await POST(req);
        const data = await res.json();

        expect(res.status).toBe(400);
        expect(data.error).toBe('No file uploaded');
    });
});
