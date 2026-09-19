'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  Check,
  Code2,
  X
} from 'lucide-react';
import { CedarEvaluationResult } from '@/lib/engine/types';

interface CedarInspectorProps {
  decision: CedarEvaluationResult;
}

export function CedarInspector({ decision }: CedarInspectorProps) {
  const [showCode, setShowCode] = useState(false);
  const isAllow = decision.decision === 'ALLOW';

  return (
    <div className="cedar-card-minimal">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-zinc-800/80">
        <div className="flex items-center gap-2">
          <span className="badge-minimal">CEDAR POLICY EVALUATION</span>
          <span className="text-zinc-400 font-mono text-xs">
            {decision.action.replace('Action::"', '').replace('"', '')}
          </span>
        </div>

        <div className={`status-tag-minimal ${isAllow ? 'tag-allow' : 'tag-deny'}`}>
          {isAllow ? <Check className="w-3 h-3 mr-1 inline" /> : <X className="w-3 h-3 mr-1 inline" />}
          {decision.decision}
        </div>
      </div>

      {/* Reason */}
      <p className="text-xs text-zinc-300 mt-2.5 leading-relaxed font-mono">
        {decision.reason}
      </p>

      {/* Conditions Breakdown */}
      {decision.conditions && decision.conditions.length > 0 && (
        <div className="mt-3 flex flex-col gap-1.5">
          {decision.conditions.map((cond, idx) => (
            <div key={idx} className="condition-row-minimal">
              <span className="font-mono text-[11px] text-zinc-300">{cond.name}</span>
              <span className="ml-auto font-mono text-[11px] text-zinc-400">
                {cond.result === 'PASS' ? '✓ PASS' : '✕ FAIL'} ({cond.actual})
              </span>
            </div>
          ))}
        </div>
      )}

      {/* What Would Change Section */}
      {decision.whatWouldChange && (
        <div className="what-would-change-minimal mt-3">
          <span className="text-[10px] uppercase font-mono tracking-wider text-zinc-400 block mb-1">
            WHAT WOULD CHANGE THIS DECISION?
          </span>
          <div className="flex items-center gap-2 text-xs font-mono text-zinc-300">
            <span>{decision.whatWouldChange.condition} = {decision.whatWouldChange.from}</span>
            <ArrowRight className="w-3 h-3 text-zinc-500" />
            <span className="text-zinc-100 font-semibold">{decision.whatWouldChange.condition} = {decision.whatWouldChange.to}</span>
            <span className="ml-auto text-[10px] text-zinc-400">
              Yields: {decision.whatWouldChange.outcomeWouldBecome}
            </span>
          </div>
        </div>
      )}

      {/* Code Toggle */}
      <div className="mt-3 pt-2 flex items-center justify-between text-xs">
        <button
          onClick={() => setShowCode(!showCode)}
          className="text-zinc-400 hover:text-zinc-200 transition font-mono flex items-center gap-1.5"
          type="button"
        >
          <Code2 className="w-3.5 h-3.5" />
          <span>{showCode ? 'Hide Cedar Policy' : 'View Declarative Cedar Code'}</span>
        </button>
      </div>

      {showCode && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="cedar-code-block-minimal mt-2"
        >
          <pre>
            <code>{decision.policySnippet}</code>
          </pre>
        </motion.div>
      )}
    </div>
  );
}
