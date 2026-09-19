import { NextResponse } from 'next/server';
import { DEMO_VAULT_DOCUMENTS } from '@/lib/engine/fixtures';

export async function GET() {
  return NextResponse.json({
    documents: DEMO_VAULT_DOCUMENTS
  });
}
