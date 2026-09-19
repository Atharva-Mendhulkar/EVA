'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { FileText, X } from 'lucide-react';
import { Evidence } from '@/lib/engine/types';

interface EvidenceDrawerProps {
  evidence: Evidence | null;
  onClose: () => void;
}

export function EvidenceDrawer({ evidence, onClose }: EvidenceDrawerProps) {
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    if (evidence) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [evidence, onClose]);

  if (!evidence) return null;

  return (
    <div
      className="drawer-overlay"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <motion.div
        className="drawer-panel-minimal"
        onClick={(e) => e.stopPropagation()}
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 250 }}
      >
        <div className="flex items-center justify-between pb-3 border-b border-zinc-800/80 mb-4">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-zinc-400" />
            <span className="text-sm font-medium text-zinc-100">Evidence Citation</span>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-200" aria-label="Close drawer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex flex-col gap-3">
          <div>
            <span className="text-[10px] font-mono uppercase text-zinc-500">Document</span>
            <div className="text-sm font-medium text-zinc-200 mt-0.5">{evidence.sourceDocumentName}</div>
          </div>

          <div>
            <span className="text-[10px] font-mono uppercase text-zinc-500">Canonical Field</span>
            <div className="text-xs font-mono text-zinc-300 mt-0.5">{evidence.field}</div>
          </div>

          <div>
            <span className="text-[10px] font-mono uppercase text-zinc-500">Extracted Value</span>
            <div className="text-base font-mono font-medium text-zinc-100 mt-0.5">{evidence.value}</div>
          </div>

          <div>
            <span className="text-[10px] font-mono uppercase text-zinc-500">Verbatim Excerpt</span>
            <div className="conflict-excerpt mt-1">
              &ldquo;{evidence.sourceExcerpt}&rdquo;
            </div>
          </div>

          <div className="mt-2 pt-3 border-t border-zinc-800/80 text-[11px] font-mono text-zinc-500 flex flex-col gap-1">
            <div>Location: {evidence.sourceLocation}</div>
            <div>Confidence: {Math.round(evidence.confidence * 100)}%</div>
            <div>Evidence ULID: {evidence.evidenceId}</div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
