'use client';

import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, FileText, CheckCircle2, AlertCircle, X, Shield, Lock, Loader2, Sparkles } from 'lucide-react';
import { Evidence } from '@/lib/engine/types';
import { apiFetch } from '@/lib/session/client';

interface DocumentUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadSuccess?: () => void;
}

export function DocumentUploadModal({ isOpen, onClose, onUploadSuccess }: DocumentUploadModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [ocrResult, setOcrResult] = useState<{
    docId: string;
    filename: string;
    sha256: string;
    extractedText: string;
    evidence: Evidence[];
    message: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setError(null);
      setOcrResult(null);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
      setError(null);
      setOcrResult(null);
    }
  };

  const handleUploadAndOCR = async () => {
    if (!file) return;

    try {
      setIsUploading(true);
      setError(null);

      const formData = new FormData();
      formData.append('file', file);

      const res = await apiFetch('/api/v1/vault/upload', {
        method: 'POST',
        body: formData
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.details || errData.error || 'Upload failed');
      }

      const data = await res.json();
      setOcrResult({
        docId: data.document.id,
        filename: data.document.name || data.document.title || 'Document',
        sha256: data.document.sha256Fingerprint,
        extractedText: data.document.rawText || '',
        evidence: data.extractedEvidence || [],
        message: data.message
      });

      if (onUploadSuccess) {
        onUploadSuccess();
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to process OCR upload');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.2 }}
          className="relative w-full max-w-2xl overflow-hidden rounded-2xl bg-[#111114] border border-white/10 shadow-2xl flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-[#15151a]">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center">
                <Upload className="w-4 h-4 text-white" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-white tracking-wide">
                  Upload Vault Document · Zero-PII OCR
                </h2>
                <p className="text-[11px] font-mono text-white/50">
                  Client-side SHA-256 fingerprinting · Nitro Enclave isolation
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/5 transition"
              aria-label="Close modal"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body */}
          <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto custom-scrollbar">
            {!ocrResult ? (
              <>
                {/* Drag and Drop Box */}
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition flex flex-col items-center justify-center gap-3 ${
                    file
                      ? 'border-white/40 bg-white/[0.04]'
                      : 'border-white/15 bg-white/[0.02] hover:border-white/30 hover:bg-white/[0.03]'
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    accept="image/*,application/pdf,.pdf,.doc,.docx,.odt,.rtf,.pages,.ppt,.pptx,.odp,.key,.xls,.xlsx,.csv,.tsv,.txt,.md,.json,.xml,.yaml,.yml,.html,.htm,.log"
                    onChange={handleFileChange}
                  />

                  <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
                    <FileText className="w-6 h-6 text-white/80" />
                  </div>

                  {file ? (
                    <div>
                      <p className="text-sm font-medium text-white">{file.name}</p>
                      <p className="text-xs text-white/40 mt-1 font-mono">
                        {(file.size / 1024).toFixed(1)} KB · Ready for OCR
                      </p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-xs font-medium text-white/90">
                        Drag & drop a document, or <span className="underline">browse</span>
                      </p>
                      <p className="text-[11px] text-white/40 mt-1 font-mono">
                        PDF, Images (JPG, PNG, WebP), Docs (DOCX, PPTX, XLSX), or Plain Text
                      </p>
                    </div>
                  )}
                </div>

                {/* Privacy Badge */}
                <div className="flex items-center gap-2 p-3 rounded-xl bg-white/[0.03] border border-white/5 text-xs text-white/60">
                  <Lock className="w-4 h-4 text-white/80 shrink-0" />
                  <span className="font-mono text-[11px]">
                    Zero plaintext data is stored on remote disk. Raw tokens are parsed in transient memory.
                  </span>
                </div>

                {error && (
                  <div className="p-3 rounded-xl bg-white/5 border border-white/20 text-xs text-white flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-white/80" />
                    <span>{error}</span>
                  </div>
                )}
              </>
            ) : (
              /* Ingestion & OCR Inspection Card */
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-white/[0.04] border border-white/15">
                  <div className="flex items-center gap-2 text-xs font-semibold text-white mb-2">
                    <CheckCircle2 className="w-4 h-4 text-white" />
                    <span>OCR Ingestion & Fingerprinting Complete</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px] font-mono text-white/70">
                    <div>
                      <span className="text-white/40">Anonymous ID: </span>
                      <span>{ocrResult.docId}</span>
                    </div>
                    <div className="truncate">
                      <span className="text-white/40">SHA-256: </span>
                      <span className="truncate">{ocrResult.sha256.slice(0, 18)}...</span>
                    </div>
                  </div>
                </div>

                {/* Extracted Evidence Tags */}
                <div>
                  <h4 className="text-xs font-mono uppercase tracking-wider text-white/50 mb-2">
                    Extracted Canonical Entities ({ocrResult.evidence.length})
                  </h4>
                  {ocrResult.evidence.length === 0 ? (
                    <p className="text-xs text-white/40 italic">
                      No recognized canonical fields (work_location, ram_spec, claim_amount, ifsc_code) found. Document saved as general context.
                    </p>
                  ) : (
                    <div className="space-y-1.5">
                      {ocrResult.evidence.map((ev, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between p-2.5 rounded-lg bg-white/5 border border-white/10 text-xs"
                        >
                          <div>
                            <span className="font-mono text-white/50">{ev.field}: </span>
                            <span className="font-medium text-white">{ev.value}</span>
                          </div>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/10 text-white/80">
                            {(ev.confidence * 100).toFixed(0)}% Match
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Extracted Text Snippet */}
                <div>
                  <h4 className="text-xs font-mono uppercase tracking-wider text-white/50 mb-2">
                    Parsed Text Stream Excerpt
                  </h4>
                  <div className="p-3 rounded-lg bg-[#0d0d10] border border-white/5 max-h-40 overflow-y-auto custom-scrollbar">
                    <pre className="text-[11px] font-mono text-white/70 whitespace-pre-wrap leading-relaxed">
                      {ocrResult.extractedText || 'No readable textual streams discovered.'}
                    </pre>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-6 py-3.5 border-t border-white/10 bg-[#15151a]">
            <span className="text-[11px] font-mono text-white/40">
              EVA Verified Cryptographic Vault
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={onClose}
                className="px-3.5 py-1.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-white text-xs transition"
              >
                {ocrResult ? 'Done' : 'Cancel'}
              </button>

              {!ocrResult && (
                <button
                  onClick={handleUploadAndOCR}
                  disabled={!file || isUploading}
                  className="px-4 py-1.5 rounded-xl bg-white text-black text-xs font-medium hover:bg-white/90 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center gap-1.5"
                >
                  {isUploading && <Loader2 className="w-3.5 h-3.5 animate-spin text-black" />}
                  <span>{isUploading ? 'Extracting OCR...' : 'Process Document'}</span>
                </button>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
