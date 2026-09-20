'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FileText,
  Globe,
  Loader2,
  Search,
  ShieldCheck,
  Sparkles
} from 'lucide-react';
import { WorkflowStatus, WorkflowStep, Evidence, Conflict } from '@/lib/engine/types';

interface AgentProgressProps {
  status: WorkflowStatus;
  hasOpenConflict: boolean;
  isHumanApproved: boolean;
  fieldsCount: number;
  isExecuting?: boolean;
  plan?: WorkflowStep[];
  stepIndex?: number;
  evidence?: Evidence[];
  conflicts?: Conflict[];
  template?: string;
  targetSystem?: string;
}

const DEFAULT_8_PHASES: { stepId: number; name: string; actor: string; defaultDetail: string }[] = [
  { stepId: 1, name: 'Intent Classification', actor: 'Strands + Bedrock', defaultDetail: 'Classified intent & matched operational domain' },
  { stepId: 2, name: 'Vault Document Search', actor: 'S3 KMS + DynamoDB', defaultDetail: 'Retrieved encrypted documents from vault' },
  { stepId: 3, name: 'Bedrock Evidence Extraction', actor: 'Claude 3.5 Sonnet', defaultDetail: 'Extracted canonical fields with cryptographic citations' },
  { stepId: 4, name: 'Deterministic Reconciliation', actor: 'Comparator', defaultDetail: 'Deterministic comparator & reconciliation' },
  { stepId: 5, name: 'Cedar Authorization (Populate)', actor: 'Cedar Engine', defaultDetail: 'Action::populate_form policy evaluation' },
  { stepId: 6, name: 'Sandboxed Form Population', actor: 'Sandbox Engine', defaultDetail: 'Populated canonical fields with provenance tags' },
  { stepId: 7, name: 'Cedar Authorization (Submit)', actor: 'Step Functions', defaultDetail: 'Action::submit_form human approval gate' },
  { stepId: 8, name: 'Consequential External Submission', actor: 'Target Endpoint', defaultDetail: 'Dispatched to operational target & recorded in audit trail' }
];

export function AgentProgress({
  status,
  hasOpenConflict,
  isHumanApproved,
  fieldsCount,
  isExecuting,
  plan,
  stepIndex,
  evidence,
  conflicts,
  template,
  targetSystem
}: AgentProgressProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'phases' | 'trace'>('phases');

  const isCompleted = status === 'COMPLETED';
  const isAwaitingApproval = status === 'AWAITING_HUMAN_APPROVAL';
  const isConflict = hasOpenConflict || status === 'AWAITING_USER_RESOLUTION';

  const activeConflict = conflicts?.find((c) => c.status === 'open');

  // Group evidence by document for dynamic trace
  const evidenceDocs = React.useMemo(() => {
    if (!evidence || evidence.length === 0) return [];
    const map = new Map<string, string[]>();
    for (const ev of evidence) {
      const docName = ev.sourceDocumentName || 'Document';
      const list = map.get(docName) || [];
      if (!list.includes(ev.field)) {
        list.push(ev.field);
      }
      map.set(docName, list);
    }
    return Array.from(map.entries());
  }, [evidence]);

  // Determine current active phase number (1 to 8)
  const currentPhaseNumber = isCompleted
    ? 8
    : isAwaitingApproval
    ? 7
    : fieldsCount > 0
    ? 6
    : isConflict
    ? 4
    : status === 'EXTRACTING'
    ? 3
    : status === 'PLANNING'
    ? 1
    : stepIndex || 4;

  const currentPhaseTitle = DEFAULT_8_PHASES[currentPhaseNumber - 1]?.name || 'Deterministic Reconciliation';

  return (
    <div className="agent-thinking-wrapper mb-6">
      {/* Expandable Capsule Header (Matches Image 2 & PRD Section 16) */}
      <div className={`thinking-toggle-bar flex items-center justify-between p-3.5 ${isOpen ? 'border-b border-zinc-800/80' : ''}`}>
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2.5 bg-transparent border-0 text-left cursor-pointer p-0 flex-1"
          aria-expanded={isOpen}
        >
          {isCompleted ? (
            <CheckCircle2 className="w-4 h-4 text-zinc-100 flex-none" />
          ) : isConflict ? (
            <span className="w-2.5 h-2.5 rounded-full bg-zinc-400 flex-none animate-pulse" />
          ) : isExecuting ? (
            <Loader2 className="w-4 h-4 text-zinc-200 animate-spin flex-none" />
          ) : (
            <Sparkles className="w-4 h-4 text-zinc-300 flex-none" />
          )}

            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="badge-minimal text-[10px]">
                  {isCompleted ? 'ALL 8 PHASES COMPLETE' : `PHASE ${currentPhaseNumber} OF 8`}
                </span>
                <span className="thinking-title text-sm font-medium text-zinc-100">
                  {isCompleted ? 'All 8 Phases Complete & Verified' : currentPhaseTitle}
                </span>
              </div>
              <span className="text-[11px] text-zinc-500 font-mono mt-0.5">
                {isCompleted
                  ? 'All 8 phases completed · Append-only audit trail verified'
                  : isConflict
                  ? 'Execution paused at Step Functions token (.waitForTaskToken)'
                  : isAwaitingApproval
                  ? 'Consequential submission gate · Awaiting explicit human consent'
                  : 'AWS Serverless State Machine Executing...'}
              </span>
            </div>
        </button>

        {/* View Mode Toggle Pill & Expand Chevron */}
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-lg p-0.5 text-[11px] font-mono">
            <button
              type="button"
              onClick={() => setViewMode('phases')}
              className={`px-2 py-0.5 rounded ${viewMode === 'phases' ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
              8 Phases
            </button>
            <button
              type="button"
              onClick={() => setViewMode('trace')}
              className={`px-2 py-0.5 rounded ${viewMode === 'trace' ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
              Live Trace
            </button>
          </div>

          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="text-zinc-500 hover:text-zinc-300 bg-transparent border-0 cursor-pointer p-1"
            aria-label="Toggle drawer"
          >
            {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Expanded Content */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="thinking-content p-4"
          >
            {viewMode === 'phases' ? (
              /* 8-Phase Vertical Pipeline Graph (PRD Section 8 & Section 16) */
              <div className="phases-stepper-grid flex flex-col gap-2">
                {DEFAULT_8_PHASES.map((phaseDef, idx) => {
                  const planStep = plan?.find((p) => p.stepId === phaseDef.stepId);
                  
                  // Compute dynamic status based on workflow state
                  let stepStatus: 'COMPLETED' | 'IN_PROGRESS' | 'ATTENTION' | 'PENDING' = 'PENDING';
                  if (isCompleted || planStep?.status === 'COMPLETED') {
                    stepStatus = 'COMPLETED';
                  } else if (phaseDef.stepId < currentPhaseNumber) {
                    stepStatus = 'COMPLETED';
                  } else if (phaseDef.stepId === currentPhaseNumber) {
                    stepStatus = isConflict || isAwaitingApproval ? 'ATTENTION' : 'IN_PROGRESS';
                  } else {
                    stepStatus = 'PENDING';
                  }

                  let detailText = planStep?.detail || phaseDef.defaultDetail;
                  if (!planStep?.detail) {
                    if (phaseDef.stepId === 1 && template) {
                      detailText = `Matched template: ${template}`;
                    } else if (phaseDef.stepId === 2 && evidence) {
                      const docCount = evidenceDocs.length;
                      detailText = docCount > 0 ? `Retrieved ${docCount} encrypted documents from vault` : 'Direct dispatch (no documents required)';
                    } else if (phaseDef.stepId === 3 && evidence) {
                      detailText = evidence.length > 0 ? `Extracted ${evidence.length} canonical fields with citations` : 'Direct administrative dispatch';
                    } else if (phaseDef.stepId === 4) {
                      detailText = activeConflict
                        ? `Contradiction detected: ${activeConflict.field.replace(/_/g, ' ')} (${activeConflict.candidateEvidence[0]?.value || ''} vs ${activeConflict.candidateEvidence[1]?.value || ''})`
                        : 'All evidence reconciled deterministically';
                    } else if (phaseDef.stepId === 6 && fieldsCount) {
                      detailText = `Populated ${fieldsCount} fields with provenance tags`;
                    } else if (phaseDef.stepId === 8 && targetSystem) {
                      detailText = `Dispatched to ${targetSystem} & recorded in audit trail`;
                    }
                  }

                  return (
                    <div
                      key={phaseDef.stepId}
                      className={`phase-row-minimal flex items-start gap-3 p-2.5 rounded-lg border transition ${
                        stepStatus === 'COMPLETED'
                          ? 'border-zinc-800/80 bg-zinc-900/40 text-zinc-300'
                          : stepStatus === 'ATTENTION'
                          ? 'border-zinc-700 bg-zinc-900/80 text-zinc-100'
                          : stepStatus === 'IN_PROGRESS'
                          ? 'border-zinc-700 bg-zinc-900/60 text-zinc-200'
                          : 'border-transparent text-zinc-600'
                      }`}
                    >
                      {/* Step Status Icon */}
                      <div className="flex-none mt-0.5">
                        {stepStatus === 'COMPLETED' ? (
                          <div className="w-5 h-5 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-[10px] text-zinc-200">
                            ✓
                          </div>
                        ) : stepStatus === 'ATTENTION' ? (
                          <div className="w-5 h-5 rounded-full bg-zinc-800 border border-zinc-600 flex items-center justify-center text-[10px] text-zinc-100 font-bold">
                            !
                          </div>
                        ) : stepStatus === 'IN_PROGRESS' ? (
                          <div className="w-5 h-5 rounded-full bg-zinc-800 border border-zinc-500 flex items-center justify-center text-[10px] text-white">
                            <Loader2 className="w-3 h-3 animate-spin" />
                          </div>
                        ) : (
                          <div className="w-5 h-5 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-[10px] text-zinc-600 font-mono">
                            {phaseDef.stepId}
                          </div>
                        )}
                      </div>

                      {/* Phase Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-medium text-zinc-200 font-mono">
                            {phaseDef.stepId}. {phaseDef.name}
                          </span>
                          <span className="text-[10px] font-mono text-zinc-500">
                            {phaseDef.actor}
                          </span>
                        </div>
                        <p className="text-[11px] text-zinc-400 mt-0.5 truncate font-mono">
                          {detailText}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* Live Evidence Trace Mode (Vault Search + Comparator + Cedar Evaluation) */
              <div className="flex flex-col gap-3">
                {/* 1. Searching Vault */}
                <div className="thinking-group">
                  <div className="thinking-group-header flex items-center gap-2 text-xs text-zinc-400 mb-2">
                    <Globe className="w-3.5 h-3.5 text-zinc-400" />
                    <span>Searching Encrypted Document Vault (S3 KMS)</span>
                  </div>
                  {evidenceDocs.length > 0 ? (
                    <ul className="thinking-sublist flex flex-col gap-1.5">
                      {evidenceDocs.map(([docName, docFields]) => (
                        <li key={docName} className="thinking-subitem flex items-center gap-2 p-2 rounded bg-zinc-900/60 border border-zinc-800 text-xs">
                          <FileText className="w-3.5 h-3.5 text-zinc-500 flex-none" />
                          <span className="font-mono text-zinc-300 truncate">{docName}</span>
                          <span className="text-zinc-500 text-[11px] ml-auto truncate max-w-[200px]">
                            {docFields.slice(0, 3).map((f) => f.replace(/_/g, ' ')).join(', ')}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="p-2.5 rounded bg-zinc-900/60 border border-zinc-800 text-xs font-mono text-zinc-500">
                      Direct administrative operation: no external vault documents indexed.
                    </div>
                  )}
                </div>

                {/* 2. Deterministic Comparator */}
                <div className="thinking-group">
                  <div className="thinking-group-header flex items-center gap-2 text-xs text-zinc-400 mb-1.5">
                    <Search className="w-3.5 h-3.5 text-zinc-400" />
                    <span>Deterministic Evidence Reconciliation</span>
                  </div>
                  <div className="thinking-detail-box p-2.5 rounded bg-zinc-900/60 border border-zinc-800 text-xs font-mono">
                    {activeConflict ? (
                      <div className="flex items-center gap-2 text-zinc-300">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-none" />
                        <span>
                          Conflict detected: {activeConflict.field.replace(/_/g, ' ')} differs across documents ({activeConflict.candidateEvidence[0]?.value} vs {activeConflict.candidateEvidence[1]?.value})
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-zinc-300">
                        <CheckCircle2 className="w-3.5 h-3.5 text-zinc-200 flex-none" />
                        <span>
                          {conflicts && conflicts.some(c => c.status === 'resolved')
                            ? 'Contradiction resolved by user. Synonym comparator verified.'
                            : 'All evidence reconciled deterministically. Zero contradictions detected.'}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* 3. Cedar Policy Authorization */}
                <div className="thinking-group">
                  <div className="thinking-group-header flex items-center gap-2 text-xs text-zinc-400 mb-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-zinc-400" />
                    <span>Cedar Policy Decision Point (PDP)</span>
                  </div>
                  <div className="thinking-detail-box p-2.5 rounded bg-zinc-900/60 border border-zinc-800 text-xs font-mono">
                    <div className="flex items-center justify-between">
                      <span className="text-zinc-400">Action::populate_form</span>
                      <span className={hasOpenConflict ? 'text-zinc-500' : 'text-zinc-200 font-semibold'}>
                        {hasOpenConflict ? 'DENIED (conflict)' : 'ALLOWED (verified)'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-zinc-400">Action::submit_form</span>
                      <span className={isCompleted ? 'text-zinc-200 font-semibold' : isAwaitingApproval ? 'text-zinc-400 font-semibold' : 'text-zinc-500'}>
                        {isCompleted
                          ? 'ALLOWED (human consent recorded)'
                          : isAwaitingApproval
                          ? 'DENIED (approval required)'
                          : 'PENDING'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
