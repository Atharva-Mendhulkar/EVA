import { NextRequest, NextResponse } from 'next/server';
import { workflowStore } from '@/lib/engine/state-machine';
import { DEMO_VAULT_DOCUMENTS } from '@/lib/engine/fixtures';
import { DocumentMetadata } from '@/lib/engine/types';
import { requireSession } from '@/lib/session/store';

// POST /api/v1/workflows/:id/documents — Registers uploaded document ciphertext metadata (PRD Section 13)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!requireSession(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const workflow = workflowStore.getWorkflow(id);
    if (!workflow) {
      return NextResponse.json({ error: `Workflow ${id} not found` }, { status: 404 });
    }

    const body = await req.json().catch(() => ({}));
    const {
      name,
      documentId = `doc_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      sizeBytes = 0,
      mimeType,
      type = mimeType || 'application/pdf',
      sensitivity = 'standard',
      description = 'Registered document ciphertext metadata',
      checksum
    } = body;

    if (!name) {
      return NextResponse.json({ error: 'Document name is required' }, { status: 400 });
    }

    const docMeta: DocumentMetadata = {
      documentId,
      name,
      sizeBytes: Number(sizeBytes),
      updatedAt: new Date().toISOString(),
      type,
      sensitivity: sensitivity as 'standard' | 'financial' | 'identity',
      description: checksum ? `${description} (SHA-256: ${checksum.slice(0, 12)}...)` : description
    };

    const existingIdx = DEMO_VAULT_DOCUMENTS.findIndex((d) => d.documentId === docMeta.documentId);
    if (existingIdx >= 0) {
      DEMO_VAULT_DOCUMENTS[existingIdx] = docMeta;
    } else {
      DEMO_VAULT_DOCUMENTS.push(docMeta);
    }

    return NextResponse.json(
      {
        success: true,
        workflowRunId: id,
        document: docMeta
      },
      { status: 201 }
    );
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
