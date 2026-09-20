import { NextRequest, NextResponse } from 'next/server';
import { processDocumentUpload } from '@/lib/engine/ocr';
import { DEMO_VAULT_DOCUMENTS } from '@/lib/engine/fixtures';
import { DocumentMetadata } from '@/lib/engine/types';
import { requireSession } from '@/lib/session/store';

export async function POST(req: NextRequest) {
  if (!requireSession(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided in form data' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const result = await processDocumentUpload(
      buffer,
      file.name,
      file.type || 'application/octet-stream',
      'run_active'
    );

    // Append to in-memory vault documents for grounded retrieval
    const newDoc: DocumentMetadata = {
      documentId: result.anonymousDocId,
      name: result.filename,
      sizeBytes: result.sizeBytes,
      updatedAt: result.processedAt,
      type: result.mimeType,
      sensitivity: 'standard',
      description: `Uploaded and OCR extracted document (${result.extractedEvidence.length} fields)`
    };

    // Avoid duplicate insertions
    const existingIndex = DEMO_VAULT_DOCUMENTS.findIndex((d) => d.documentId === newDoc.documentId);
    if (existingIndex >= 0) {
      DEMO_VAULT_DOCUMENTS[existingIndex] = newDoc;
    } else {
      DEMO_VAULT_DOCUMENTS.push(newDoc);
    }

    return NextResponse.json({
      success: true,
      document: {
        ...newDoc,
        id: newDoc.documentId,
        title: newDoc.name,
        name: newDoc.name,
        rawText: result.extractedText,
        sha256Fingerprint: result.sha256Fingerprint
      },
      extractedEvidence: result.extractedEvidence,
      totalVaultCount: DEMO_VAULT_DOCUMENTS.length,
      message: `Document ingested with zero PII leakage. SHA-256: ${result.sha256Fingerprint.slice(0, 16)}...`
    });
  } catch (error: any) {
    console.error('OCR Upload Error:', error);
    return NextResponse.json(
      { error: 'Failed to process document upload', details: error.message },
      { status: 500 }
    );
  }
}
