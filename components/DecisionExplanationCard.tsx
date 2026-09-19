'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { DecisionExplanation } from '@/lib/engine/types';

interface DecisionExplanationCardProps {
  explanation?: DecisionExplanation;
  onViewEvidence?: (evidenceId: string) => void;
}

export function DecisionExplanationCard({
  explanation,
  onViewEvidence
}: DecisionExplanationCardProps) {
  const [expanded, setExpanded] = useState(false);

  if (!explanation) return null;

  return (
    <div className="explanation-card-minimal">
      <div className="flex items-center justify-between pb-2 border-b border-zinc-800/80">
        <div className="flex items-center gap-2">
          <span className="badge-minimal">DECISION EXPLANATION</span>
          <span className="text-zinc-500 font-mono text-[11px]">{explanation.action}</span>
        </div>
        <span className="status-tag-minimal">{explanation.outcome}</span>
      </div>

      <p className="text-xs text-zinc-300 mt-2.5 leading-relaxed font-mono">
        {explanation.whyStopped || explanation.summary}
      </p>

      {/* What Would Change */}
      {explanation.whatWouldChange && (
        <div className="what-would-change-minimal mt-3">
          <span className="text-[10px] uppercase font-mono tracking-wider text-zinc-400 block mb-1">
            WHAT WOULD CHANGE THIS DECISION?
          </span>
          <p className="text-xs text-zinc-300 leading-normal font-mono">
            {explanation.whatWouldChange}
          </p>
        </div>
      )}

      {/* Conditions */}
      {explanation.conditions && explanation.conditions.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {explanation.conditions.map((cond, idx) => (
            <span key={idx} className="badge-minimal text-[10px]">
              {cond.name}: {cond.actual} ({cond.result})
            </span>
          ))}
        </div>
      )}

      {/* Inspect Technical Traceability */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="text-zinc-500 hover:text-zinc-300 transition text-[11px] font-mono mt-3 flex items-center gap-1.5"
        type="button"
      >
        <span>{expanded ? 'Hide Trace' : 'Inspect Audit Provenance & Conditions'}</span>
        {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      </button>

      {expanded && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="trace-box-minimal mt-2"
        >
          <div className="text-[11px] font-mono text-zinc-400 flex items-center gap-3">
            <span>Actor: {explanation.actor}</span>
            <span>•</span>
            <span>Next: {explanation.nextAction}</span>
          </div>
          {explanation.evidenceRefs && explanation.evidenceRefs.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {explanation.evidenceRefs.map((ref) => (
                <button
                  key={ref}
                  onClick={() => onViewEvidence && onViewEvidence(ref)}
                  className="badge-minimal hover:border-zinc-500 cursor-pointer"
                  type="button"
                >
                  {ref}
                </button>
              ))}
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}
