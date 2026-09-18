'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle,
  ArrowRight,
  Check,
  FileText,
  Loader2,
  X
} from 'lucide-react';
import { Conflict, Evidence } from '@/lib/engine/types';

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

  return (
    <div className="conflict-modal-overlay" role="dialog" aria-modal="true">
      <motion.div
        className="conflict-modal-card"
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
          Work Location has conflicting evidence
        </h2>
        <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
          NEXUS never silently breaks ties between conflicting documents. Review the extracted evidence and choose the authoritative value.
        </p>

        {/* 2 Options Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
          {/* Source A: Profile */}
          <div className="conflict-option-card">
            <div className="flex items-center justify-between text-[11px] text-zinc-500 font-mono">
              <span className="flex items-center gap-1.5">
                <FileText className="w-3 h-3 text-zinc-400" />
                Personal Profile
              </span>
              <span>Conf {Math.round(candidateA.confidence * 100)}%</span>
            </div>

            <div className="my-2">
              <span className="text-[10px] text-zinc-500 font-mono uppercase">Value</span>
              <strong className="text-xl font-medium text-zinc-100 block font-mono">
                {candidateA.value}
              </strong>
            </div>

            <p className="conflict-excerpt">
              &ldquo;{candidateA.sourceExcerpt}&rdquo;
            </p>

            <span className="text-[11px] text-zinc-500 font-mono mt-2 block">
              Updated: Jan 2025 · {candidateA.sourceLocation}
            </span>

            <button
              onClick={() => handleSelect(candidateA.evidenceId)}
              disabled={isSubmitting}
              className="conflict-select-btn mt-3"
              type="button"
            >
              {isSubmitting && selectedId === candidateA.evidenceId ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                'Use Mumbai'
              )}
            </button>
          </div>

          {/* Source B: Offer Letter */}
          <div className="conflict-option-card option-card-preferred">
            <div className="flex items-center justify-between text-[11px] text-zinc-400 font-mono">
              <span className="flex items-center gap-1.5 text-zinc-200">
                <FileText className="w-3 h-3 text-zinc-300" />
                Offer Letter (Acme)
              </span>
              <span className="text-zinc-300">Conf {Math.round(candidateB.confidence * 100)}%</span>
            </div>

            <div className="my-2">
              <span className="text-[10px] text-zinc-500 font-mono uppercase">Value</span>
              <strong className="text-xl font-medium text-zinc-100 block font-mono">
                {candidateB.value}
              </strong>
            </div>

            <p className="conflict-excerpt">
              &ldquo;{candidateB.sourceExcerpt}&rdquo;
            </p>

            <span className="text-[11px] text-zinc-400 font-mono mt-2 block">
              Issued: Mar 2026 · {candidateB.sourceLocation}
            </span>
            <span className="text-[10px] text-zinc-500 italic mt-0.5 block">
              Note: This document is newer than the profile.
            </span>

            <button
              onClick={() => handleSelect(candidateB.evidenceId)}
              disabled={isSubmitting}
              className="conflict-select-btn btn-white mt-3"
              type="button"
            >
              {isSubmitting && selectedId === candidateB.evidenceId ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <>
                  <span>Use Bangalore</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </div>
        </div>

        {/* Comparator breakdown */}
        <div className="comparator-box-minimal mt-4">
          <div className="flex items-center justify-between text-[11px] font-mono text-zinc-500 mb-1">
            <span>DETERMINISTIC COMPARATOR TRACE</span>
            <span className="text-zinc-300">STATUS: HALTED</span>
          </div>
          <div className="text-[11px] font-mono text-zinc-400">
            Field: work_location · Source A (&apos;mumbai&apos;) ≠ Source B (&apos;bangalore&apos;)
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
              + Enter custom location value
            </button>
          ) : (
            <div className="flex items-center gap-2 w-full">
              <input
                type="text"
                placeholder="Enter custom location..."
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
