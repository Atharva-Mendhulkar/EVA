import { NextRequest, NextResponse } from 'next/server';
import { searchInternet } from '@/lib/engine/search';
import { requireSession } from '@/lib/session/store';

export async function POST(req: NextRequest) {
  if (!requireSession(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const query = body.query || body.q || '';
    if (!query) {
      return NextResponse.json({ error: 'Query parameter required' }, { status: 400 });
    }

    const searchResponse = await searchInternet(query);
    return NextResponse.json(searchResponse);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Search failed' }, { status: 500 });
  }
}
