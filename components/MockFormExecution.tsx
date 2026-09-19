'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Check,
  FileText,
  Info,
  Loader2,
  ExternalLink,
  ShieldCheck,
  Edit3,
  Eye,
  Terminal
} from 'lucide-react';
import { FormField } from '@/lib/engine/types';

interface MockFormExecutionProps {
  fields: FormField[];
  onInspectEvidence: (evidenceId: string) => void;
  isSubmitting?: boolean;
  targetSystem?: string;
  title?: string;
}

export function MockFormExecution({
  fields,
  onInspectEvidence,
  isSubmitting,
  targetSystem = 'Acme Cloud Systems · HR Onboarding Endpoint',
  title = 'Enterprise Operations Execution Form'
}: MockFormExecutionProps) {
  const [filledIndices, setFilledIndices] = useState<number[]>([]);
  const [activeTab, setActiveTab] = useState<'fields' | 'browserPreview'>('fields');
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null);
  const [editedValues, setEditedValues] = useState<Record<string, string>>({});

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

  const handleValueChange = (fieldId: string, val: string) => {
    setEditedValues((prev) => ({ ...prev, [fieldId]: val }));
  };

  return (
    <div className="form-card-minimal">
      {/* Form Header with Mode Switcher */}
      <div className="form-card-header">
        <div>
          <div className="flex items-center gap-2">
            <span className="badge-minimal">AGENT SANDBOX TARGET</span>
            <span className="text-zinc-500 font-mono text-[11px]">
              {targetSystem}
            </span>
          </div>
          <h3 className="text-base font-medium text-zinc-100 mt-1">
            {title}
          </h3>
        </div>

        <div className="flex items-center gap-3">
          {/* Tab Switcher */}
          <div className="flex items-center p-0.5 rounded-lg bg-white/5 border border-white/10 text-xs">
            <button
              onClick={() => setActiveTab('fields')}
              className={`px-2.5 py-1 rounded-md transition ${
                activeTab === 'fields'
                  ? 'bg-white text-black font-medium'
                  : 'text-white/60 hover:text-white'
              }`}
            >
              Fields Grid
            </button>
            <button
              onClick={() => setActiveTab('browserPreview')}
              className={`px-2.5 py-1 rounded-md transition flex items-center gap-1 ${
                activeTab === 'browserPreview'
                  ? 'bg-white text-black font-medium'
                  : 'text-white/60 hover:text-white'
              }`}
            >
              <Eye className="w-3 h-3" />
              <span>Live Web Preview</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            {!isComplete ? (
              <div className="flex items-center gap-1.5 text-xs text-zinc-400 font-mono">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-zinc-400" />
                <span>Filling...</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-xs text-zinc-300 font-mono">
                <Check className="w-3.5 h-3.5 text-zinc-200" />
                <span>{fields.length}/{fields.length} Ready</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {activeTab === 'fields' ? (
        /* Fields List with Typewriter / Sequential Animation */
        <div className="form-fields-list">
          {fields.map((field, idx) => {
            const isFilled = filledIndices.includes(idx);
            const currentValue = editedValues[field.fieldId] !== undefined ? editedValues[field.fieldId] : field.value;
            const isEditing = editingFieldId === field.fieldId;

            return (
              <motion.div
                key={field.fieldId}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: isFilled ? 1 : 0.4, y: isFilled ? 0 : 4 }}
                transition={{ duration: 0.2 }}
                className={`form-field-row-minimal ${isFilled ? 'field-active' : 'field-pending'}`}
              >
                <div className="field-content flex-1 mr-4">
                  <div className="flex items-center justify-between mb-1">
                    <span className="field-label-minimal">{field.label}</span>
                    {field.userConfirmed && (
                      <span className="badge-minimal text-[10px]">
                        User Confirmed
                      </span>
                    )}
                  </div>

                  {isEditing ? (
                    <div className="flex items-center gap-2 mt-1">
                      <input
                        type="text"
                        value={currentValue}
                        onChange={(e) => handleValueChange(field.fieldId, e.target.value)}
                        className="bg-[#141418] border border-white/20 rounded px-2 py-1 text-xs text-white font-mono w-full focus:outline-none focus:border-white"
                        autoFocus
                      />
                      <button
                        onClick={() => setEditingFieldId(null)}
                        className="px-2 py-1 rounded bg-white text-black text-xs font-mono"
                      >
                        Save
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between group">
                      <span className="field-value-minimal font-mono">
                        {isFilled ? currentValue : '—'}
                      </span>
                      {isFilled && (
                        <button
                          onClick={() => setEditingFieldId(field.fieldId)}
                          className="opacity-0 group-hover:opacity-100 p-1 text-white/40 hover:text-white transition"
                          title="Edit value"
                        >
                          <Edit3 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  )}
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
      ) : (
        /* Live Web Form Rendering (What the autonomous agent sees in the headless browser) */
        <div className="p-4 bg-[#0d0d10] border border-white/5 rounded-xl space-y-4">
          <div className="flex items-center justify-between border-b border-white/10 pb-2">
            <div className="flex items-center gap-2 text-xs font-mono text-white/50">
              <span className="w-2.5 h-2.5 rounded-full bg-white/20 inline-block" />
              <span className="w-2.5 h-2.5 rounded-full bg-white/20 inline-block" />
              <span className="w-2.5 h-2.5 rounded-full bg-white/20 inline-block" />
              <span className="ml-2 text-white/40">https://internal.ops.corp/forms/{targetSystem.toLowerCase().replace(/\s+/g, '-')}</span>
            </div>
            <div className="flex items-center gap-1.5 text-[10px] font-mono text-white/40">
              <Terminal className="w-3 h-3" />
              <span>DOM Injected</span>
            </div>
          </div>

          <div className="space-y-3 pt-2">
            {fields.map((field) => (
              <div key={field.fieldId} className="space-y-1">
                <label className="text-xs font-medium text-white/80 block">
                  {field.label}
                </label>
                <div className="relative">
                  <input
                    type="text"
                    readOnly
                    value={editedValues[field.fieldId] !== undefined ? editedValues[field.fieldId] : field.value}
                    className="w-full bg-[#16161c] border border-white/10 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none"
                  />
                  <span className="absolute right-2.5 top-2 text-[10px] font-mono text-white/30">
                    selector: #{field.fieldId}
                  </span>
                </div>
              </div>
            ))}

            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                disabled
                className="px-3 py-1.5 rounded-lg border border-white/10 text-white/40 text-xs font-mono cursor-not-allowed"
              >
                Reset
              </button>
              <button
                type="button"
                disabled
                className="px-4 py-1.5 rounded-lg bg-white/10 text-white/60 text-xs font-mono cursor-not-allowed"
              >
                Awaiting Task Token...
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer disclaimer */}
      <div className="form-card-footer">
        <Info className="w-3.5 h-3.5 text-zinc-500 flex-none" />
        <span className="text-zinc-500 text-[11px]">
          Target system is sandboxed. Policy authorization boundary and human consent checks are real.
        </span>
      </div>
    </div>
  );
}
