'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Check,
  CheckCircle2,
  ExternalLink,
  FileText,
  Info,
  Loader2,
  Lock,
  ShieldCheck,
  UserCheck
} from 'lucide-react';
import { FormField } from '@/lib/engine/types';

interface MockFormExecutionProps {
  fields: FormField[];
  onInspectEvidence: (evidenceId: string) => void;
  isSubmitting?: boolean;
}

export function MockFormExecution({
  fields,
  onInspectEvidence,
  isSubmitting
}: MockFormExecutionProps) {
  const [filledIndices, setFilledIndices] = useState<number[]>([]);

  // Smooth form filling animation: reveals fields sequentially with typewriter shimmer
  useEffect(() => {
    if (fields.length === 0) return;
    setFilledIndices([]);

    const timers: NodeJS.Timeout[] = [];
    fields.forEach((_, idx) => {
      const timer = setTimeout(() => {
        setFilledIndices((prev) => [...prev, idx]);
      }, (idx + 1) * 120);
      timers.push(timer);
    });

    return () => timers.forEach(clearTimeout);
  }, [fields]);

  const isComplete = filledIndices.length === fields.length;

  return (
    <div className="form-card-minimal">
      {/* Form Header */}
      <div className="form-card-header">
        <div>
          <div className="flex items-center gap-2">
            <span className="badge-minimal">SANDBOX TARGET</span>
            <span className="text-zinc-500 font-mono text-[11px]">
              Acme Cloud Systems · HR Onboarding Endpoint
            </span>
          </div>
          <h3 className="text-base font-medium text-zinc-100 mt-1">
            New Hire Onboarding Form
          </h3>
        </div>

        <div className="flex items-center gap-2">
          {!isComplete ? (
            <div className="flex items-center gap-1.5 text-xs text-zinc-400 font-mono">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-zinc-400" />
              <span>Filling form...</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-xs text-zinc-300 font-mono">
              <Check className="w-3.5 h-3.5 text-zinc-200" />
              <span>{fields.length}/{fields.length} Populated</span>
            </div>
          )}
        </div>
      </div>

      {/* Fields List with Typewriter / Sequential Animation */}
      <div className="form-fields-list">
        {fields.map((field, idx) => {
          const isFilled = filledIndices.includes(idx);

          return (
            <motion.div
              key={field.fieldId}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: isFilled ? 1 : 0.4, y: isFilled ? 0 : 4 }}
              transition={{ duration: 0.2 }}
              className={`form-field-row-minimal ${isFilled ? 'field-active' : 'field-pending'}`}
            >
              <div className="field-content">
                <span className="field-label-minimal">{field.label}</span>
                <div className="flex items-center gap-2">
                  <span className="field-value-minimal font-mono">
                    {isFilled ? field.value : '—'}
                  </span>
                  {field.userConfirmed && (
                    <span className="badge-minimal text-[10px]">
                      User Confirmed
                    </span>
                  )}
                </div>
              </div>

              {/* Provenance Tag */}
              {isFilled && (
                <button
                  type="button"
                  onClick={() => onInspectEvidence(field.evidenceId)}
                  className="provenance-pill-minimal"
                  title="Inspect source document excerpt"
                >
                  <FileText className="w-3 h-3 text-zinc-400" />
                  <span className="truncate max-w-[130px]">{field.sourceDocument}</span>
                  <span className="text-zinc-500 font-mono text-[10px]">
                    {Math.round(field.confidence * 100)}%
                  </span>
                </button>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* Footer disclaimer */}
      <div className="form-card-footer">
        <Info className="w-3.5 h-3.5 text-zinc-500 flex-none" />
        <span className="text-zinc-500 text-[11px]">
          Demo target is sandbox. Policy authorization boundary and human consent checks are real.
        </span>
      </div>
    </div>
  );
}
