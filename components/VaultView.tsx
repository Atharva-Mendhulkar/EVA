'use client';

import React, { useEffect, useState } from 'react';
import { FileText, Loader2 } from 'lucide-react';
import { DEMO_VAULT_DOCUMENTS } from '@/lib/engine/fixtures';
import { DocumentMetadata } from '@/lib/engine/types';
import { apiFetch } from '@/lib/session/client';

export function VaultView() {
  const [documents, setDocuments] = useState<DocumentMetadata[]>(DEMO_VAULT_DOCUMENTS);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<DocumentMetadata | null>(null);

  useEffect(() => {
    async function loadVaultDocs() {
      try {
        setIsLoading(true);
        const res = await apiFetch('/api/v1/vault/documents');
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.documents) && data.documents.length > 0) {
            setDocuments(data.documents);
          }
        }
      } catch (err) {
        console.error('Failed to load vault documents:', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadVaultDocs();
  }, []);

  return (
    <div className="vault-view-minimal">
      <div className="flex items-center justify-between pb-3 border-b border-zinc-800/80 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="badge-minimal">S3 KMS VAULT</span>
            <span className="text-[11px] font-mono text-zinc-500">sse-kms:aws/s3</span>
          </div>
          <h2 className="text-base font-medium text-zinc-100 mt-1">Encrypted Documents</h2>
        </div>

        <div className="flex items-center gap-2">
          {isLoading && <Loader2 className="w-3.5 h-3.5 animate-spin text-zinc-400" />}
          <span className="text-xs text-zinc-500 font-mono">{documents.length} Files</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {documents.map((doc) => {
          const isSelected = selectedDoc?.documentId === doc.documentId;

          return (
            <div
              key={doc.documentId}
              onClick={() => setSelectedDoc(isSelected ? null : doc)}
              className={`vault-doc-card-minimal cursor-pointer transition ${
                isSelected ? 'border-zinc-500 bg-zinc-900/90' : ''
              }`}
              role="button"
              tabIndex={0}
            >
              <div className="flex items-center justify-between text-zinc-500 mb-2">
                <FileText className="w-4 h-4 text-zinc-400" />
                <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider">
                  {doc.sensitivity}
                </span>
              </div>
              <strong className="text-sm font-medium text-zinc-200 block truncate">
                {doc.name}
              </strong>
              <p className="text-xs text-zinc-500 mt-1 line-clamp-2">
                {doc.description}
              </p>
              <div className="mt-3 pt-2 border-t border-zinc-800/60 flex items-center justify-between text-[10px] font-mono text-zinc-500">
                <span>{Math.round(doc.sizeBytes / 1024)} KB</span>
                <span>{new Date(doc.updatedAt).toLocaleDateString()}</span>
              </div>
            </div>
          );
        })}
      </div>

      {selectedDoc && (
        <div className="mt-4 p-3 rounded-xl border border-zinc-800 bg-zinc-900/60 text-xs font-mono text-zinc-400 flex flex-col gap-1.5 transition-opacity duration-200">
          <div className="flex items-center justify-between text-zinc-300 font-medium">
            <span>S3 Metadata: s3://eva-user-vault/{selectedDoc.name}</span>
            <span className="badge-minimal text-[10px]">ENCRYPTED</span>
          </div>
          <div>MIME Type: {selectedDoc.type} · Size: {selectedDoc.sizeBytes} bytes</div>
          <div>Last Synchronized: {new Date(selectedDoc.updatedAt).toISOString()}</div>
          <div className="text-[11px] text-zinc-500 italic mt-0.5">
            Indexed into Amazon OpenSearch / DynamoDB single-table with Bedrock Vector Embeddings (Titan Text v2).
          </div>
        </div>
      )}
    </div>
  );
}
