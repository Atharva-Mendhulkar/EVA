'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  FileText,
  Loader2,
  X
} from 'lucide-react';
import { Conflict } from '@/lib/engine/types';

interface ConflictModalProps {
  conflict: Conflict;
  onResolve: (evidenceId: string, overrideValue?: string) => Promise<void>;
  onClose?: () => void;
}

export function ConflictModal({ conflict, onResolve, onClose }: ConflictModalProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showOverride, setShowOverride] = useState(false);
  const [overrideText, setOverrideText] = useState('');

  const candidateA = conflict.candidateEvidence[0];
  const candidateB = conflict.candidateEvidence[1];

  const handleSelect = async (evidenceId: string, overrideVal?: string) => {
    try {
      setSelectedId(evidenceId);
      setIsSubmitting(true);
      await onResolve(evidenceId, overrideVal);
    } finally {
      setIsSubmitting(false);
    }
  };

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && onClose) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const formatFieldLabel = (field: string) => {
    switch (field) {
      case 'work_location':
        return 'Work Location';
      case 'ram_spec':
        return 'RAM Specification';
      case 'admission_date':
        return 'Hospital Admission Date';
      case 'ifsc_code':
        return 'Bank Branch IFSC Code';
      default:
        return field.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
    }
  };

  return (
    <div
      className="conflict-modal-overlay"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <motion.div
        className="conflict-modal-card"
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.98, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.2 }}
      >
        {onClose && (
          <button className="conflict-close-btn" onClick={onClose} aria-label="Close dialog">
            <X className="w-4 h-4" />
          </button>
        )}

        {/* Header */}
        <div className="flex items-center gap-2 mb-2">
          <span className="badge-minimal">RECONCILIATION REQUIRED</span>
          <span className="text-zinc-500 font-mono text-xs">Deterministic Comparator</span>
        </div>

        <h2 className="text-lg font-medium text-zinc-100">
          {formatFieldLabel(conflict.field)} has conflicting evidence
        </h2>
        <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
          EVA never silently breaks ties between conflicting documents. Review the extracted evidence and choose the authoritative value.
        </p>

        {/* 2 Options Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
          {/* Source A */}
          <div className="conflict-option-card min-w-0 overflow-hidden">
            <div className="flex items-center justify-between text-[11px] text-zinc-500 font-mono gap-1">
              <span className="flex items-center gap-1.5 truncate max-w-[170px]">
                <FileText className="w-3 h-3 text-zinc-400 shrink-0" />
                <span className="truncate" title={candidateA?.sourceDocumentName}>{candidateA?.sourceDocumentName || 'Source A'}</span>
              </span>
              <span className="shrink-0">Conf {Math.round((candidateA?.confidence || 0.95) * 100)}%</span>
            </div>

            <div className="my-2 min-w-0">
              <span className="text-[10px] text-zinc-500 font-mono uppercase">Value</span>
              <strong className="text-base sm:text-lg font-medium text-zinc-100 block font-mono break-words break-all leading-snug line-clamp-2" title={candidateA?.value}>
                {candidateA?.value}
              </strong>
            </div>

            <p className="conflict-excerpt break-words break-all line-clamp-3 text-xs leading-relaxed" title={candidateA?.sourceExcerpt}>
              &ldquo;{candidateA?.sourceExcerpt}&rdquo;
            </p>

            <span className="text-[11px] text-zinc-500 font-mono mt-2 block truncate">
              {candidateA?.documentUpdatedAt ? new Date(candidateA.documentUpdatedAt).toLocaleDateString() : 'Verified'} · {candidateA?.sourceLocation}
            </span>

            <button
              onClick={() => candidateA && handleSelect(candidateA.evidenceId)}
              disabled={isSubmitting || !candidateA}
              className="conflict-select-btn mt-3 max-w-full truncate px-2.5"
              type="button"
              title={`Use ${candidateA?.value}`}
            >
              {isSubmitting && selectedId === candidateA?.evidenceId ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
              ) : (
                <span className="truncate">
                  Use {candidateA?.value && candidateA.value.length > 22 ? `${candidateA.value.slice(0, 20)}...` : candidateA?.value}
                </span>
              )}
            </button>
          </div>

          {/* Source B */}
          <div className="conflict-option-card option-card-preferred min-w-0 overflow-hidden">
            <div className="flex items-center justify-between text-[11px] text-zinc-400 font-mono gap-1">
              <span className="flex items-center gap-1.5 text-zinc-200 truncate max-w-[170px]">
                <FileText className="w-3 h-3 text-zinc-300 shrink-0" />
                <span className="truncate" title={candidateB?.sourceDocumentName}>{candidateB?.sourceDocumentName || 'Source B'}</span>
              </span>
              <span className="text-zinc-300 shrink-0">Conf {Math.round((candidateB?.confidence || 0.98) * 100)}%</span>
            </div>

            <div className="my-2 min-w-0">
              <span className="text-[10px] text-zinc-500 font-mono uppercase">Value</span>
              <strong className="text-base sm:text-lg font-medium text-zinc-100 block font-mono break-words break-all leading-snug line-clamp-2" title={candidateB?.value}>
                {candidateB?.value}
              </strong>
            </div>

            <p className="conflict-excerpt break-words break-all line-clamp-3 text-xs leading-relaxed" title={candidateB?.sourceExcerpt}>
              &ldquo;{candidateB?.sourceExcerpt}&rdquo;
            </p>

            <span className="text-[11px] text-zinc-400 font-mono mt-2 block truncate">
              {candidateB?.documentUpdatedAt ? new Date(candidateB.documentUpdatedAt).toLocaleDateString() : 'Verified'} · {candidateB?.sourceLocation}
            </span>

            <button
              onClick={() => candidateB && handleSelect(candidateB.evidenceId)}
              disabled={isSubmitting || !candidateB}
              className="conflict-select-btn mt-3 max-w-full truncate px-2.5"
              type="button"
              title={`Use ${candidateB?.value}`}
            >
              {isSubmitting && selectedId === candidateB?.evidenceId ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
              ) : (
                <span className="truncate flex items-center gap-1">
                  <span>Use {candidateB?.value && candidateB.value.length > 22 ? `${candidateB.value.slice(0, 20)}...` : candidateB?.value}</span>
                  <ArrowRight className="w-3.5 h-3.5 shrink-0" />
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Comparator breakdown */}
        <div className="comparator-box-minimal mt-4 min-w-0 overflow-hidden">
          <div className="flex items-center justify-between text-[11px] font-mono text-zinc-500 mb-1">
            <span>DETERMINISTIC COMPARATOR TRACE</span>
            <span className="text-zinc-300">STATUS: HALTED</span>
          </div>
          <div className="text-[11px] font-mono text-zinc-400 break-words break-all leading-relaxed">
            Field: {formatFieldLabel(conflict.field)} · Source A (&apos;{candidateA?.value || 'null'}&apos;) ≠ Source B (&apos;{candidateB?.value || 'null'}&apos;)
          </div>
        </div>

        {/* Manual Override Option */}
        <div className="mt-3 pt-3 border-t border-zinc-800/80 flex items-center justify-between text-xs">
          {!showOverride ? (
            <button
              onClick={() => setShowOverride(true)}
              className="text-zinc-500 hover:text-zinc-300 transition text-[11px] font-mono"
              type="button"
            >
              + Enter custom {formatFieldLabel(conflict.field).toLowerCase()} value
            </button>
          ) : (
            <div className="flex items-center gap-2 w-full">
              <input
                type="text"
                placeholder={`Enter custom ${formatFieldLabel(conflict.field).toLowerCase()}...`}
                value={overrideText}
                onChange={(e) => setOverrideText(e.target.value)}
                className="input-minimal flex-1"
              />
              <button
                onClick={() => handleSelect(candidateB.evidenceId, overrideText)}
                disabled={!overrideText.trim() || isSubmitting}
                className="conflict-select-btn px-3"
                type="button"
              >
                Apply
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
