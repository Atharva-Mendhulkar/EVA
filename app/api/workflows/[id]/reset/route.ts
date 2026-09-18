import { NextRequest, NextResponse } from 'next/server';
import { workflowStore } from '@/lib/engine/state-machine';

export async function POST() {
  const freshWorkflow = workflowStore.createOrResetDefault();
  return NextResponse.json(freshWorkflow);
}
