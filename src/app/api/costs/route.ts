/**
 * Costs API Route
 * 
 * GET: Returns costs summary and entries
 * POST: Add or update a cost entry
 * DELETE: Remove a cost entry
 */

import { NextRequest, NextResponse } from 'next/server';
import { costsService } from '@/services/CostsService';

export async function GET() {
    try {
        const [summary, entries] = await Promise.all([
            costsService.getSummary(),
            costsService.getAllEntries()
        ]);

        return NextResponse.json({
            summary,
            entries
        });
    } catch (error) {
        console.error('Error fetching costs:', error);
        return NextResponse.json(
            { error: 'Failed to fetch costs' },
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { service, amount, periodMonth, periodYear, description } = body;

        if (!service || amount === undefined || !periodMonth || !periodYear) {
            return NextResponse.json(
                { error: 'Missing required fields: service, amount, periodMonth, periodYear' },
                { status: 400 }
            );
        }

        const entry = await costsService.upsertEntry({
            service,
            amount: parseFloat(amount),
            periodMonth: parseInt(periodMonth),
            periodYear: parseInt(periodYear),
            source: 'manual',
            description
        });

        return NextResponse.json({ success: true, entry });
    } catch (error) {
        console.error('Error saving cost entry:', error);
        return NextResponse.json(
            { error: 'Failed to save cost entry' },
            { status: 500 }
        );
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json(
                { error: 'Missing id parameter' },
                { status: 400 }
            );
        }

        const success = await costsService.deleteEntry(parseInt(id));

        if (success) {
            return NextResponse.json({ success: true });
        } else {
            return NextResponse.json(
                { error: 'Entry not found' },
                { status: 404 }
            );
        }
    } catch (error) {
        console.error('Error deleting cost entry:', error);
        return NextResponse.json(
            { error: 'Failed to delete cost entry' },
            { status: 500 }
        );
    }
}
