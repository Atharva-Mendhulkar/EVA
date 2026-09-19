'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Check,
  FileText,
  Info,
  Loader2,
  Lock,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  Edit3,
  Eye,
  Terminal,
  Layers,
  Sparkles
} from 'lucide-react';
import { FormField } from '@/lib/engine/types';

interface MockFormExecutionProps {
  fields: FormField[];
  onInspectEvidence: (evidenceId: string) => void;
  isSubmitting?: boolean;
  isHumanApproved?: boolean;
  targetSystem?: string;
  title?: string;
}

export function MockFormExecution({
  fields,
  onInspectEvidence,
  isSubmitting,
  isHumanApproved,
  targetSystem = 'Acme Cloud Systems · HR Onboarding Endpoint',
  title = 'Enterprise Operations Execution Form'
}: MockFormExecutionProps) {
  const [filledIndices, setFilledIndices] = useState<number[]>([]);
  // Default to live browser preview for immediate visual impact
  const [activeTab, setActiveTab] = useState<'browserPreview' | 'fields'>('browserPreview');
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null);
  const [editedValues, setEditedValues] = useState<Record<string, string>>({});

  const fieldsSignature = fields.map((f) => `${f.fieldId}:${f.value}`).join('|');
  const hasAnimatedRef = React.useRef<string | null>(null);

  // Smooth form filling animation: reveals fields sequentially with agent typing simulation
  // STOPS permanently once complete and does NOT continuously loop on background re-polling
  useEffect(() => {
    if (fields.length === 0) return;
    if (hasAnimatedRef.current === fieldsSignature) {
      setFilledIndices(fields.map((_, i) => i));
      return;
    }

    hasAnimatedRef.current = fieldsSignature;
    setFilledIndices([]);

    const timers: NodeJS.Timeout[] = [];
    fields.forEach((_, idx) => {
      const timer = setTimeout(() => {
        setFilledIndices((prev) => (prev.includes(idx) ? prev : [...prev, idx]));
      }, (idx + 1) * 110);
      timers.push(timer);
    });

    return () => timers.forEach(clearTimeout);
  }, [fieldsSignature, fields.length]);

  const isComplete = filledIndices.length === fields.length;

  const isGoogleForm =
    targetSystem.toLowerCase().includes('google') ||
    title.toLowerCase().includes('google');

  const handleValueChange = (fieldId: string, val: string) => {
    setEditedValues((prev) => ({ ...prev, [fieldId]: val }));
  };

  return (
    <div className="form-card-minimal">
      {/* Form Header with Prominent Mode Switcher */}
      <div className="form-card-header flex items-center justify-between gap-4 flex-wrap pb-3 border-b border-white/10">
        <div>
          <div className="flex items-center gap-2">
            <span className="badge-minimal bg-white/10 text-white font-mono text-[10px] px-2 py-0.5 rounded border border-white/20">
              AGENT SANDBOX TARGET
            </span>
            <span className="text-zinc-400 font-mono text-[11px] truncate max-w-[280px]">
              {targetSystem}
            </span>
          </div>
          <h3 className="text-base font-medium text-zinc-100 mt-1 flex items-center gap-2">
            <span>{title}</span>
            {isComplete && (
              <span className="text-[11px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full font-mono flex items-center gap-1">
                <Check className="w-3 h-3" />
                <span>Populated &amp; Verified</span>
              </span>
            )}
          </h3>
        </div>

        <div className="flex items-center gap-3">
          {/* View Mode Switcher */}
          <div className="flex items-center p-0.5 rounded-lg bg-black/40 border border-white/15 text-xs font-mono">
            <button
              onClick={() => setActiveTab('browserPreview')}
              className={`px-3 py-1.5 rounded-md transition flex items-center gap-1.5 ${
                activeTab === 'browserPreview'
                  ? 'bg-white text-black font-semibold shadow-sm'
                  : 'text-white/60 hover:text-white'
              }`}
              type="button"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Live Browser Sandbox</span>
            </button>
            <button
              onClick={() => setActiveTab('fields')}
              className={`px-3 py-1.5 rounded-md transition flex items-center gap-1.5 ${
                activeTab === 'fields'
                  ? 'bg-white text-black font-semibold shadow-sm'
                  : 'text-white/60 hover:text-white'
              }`}
              type="button"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Citations Grid</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            {!isComplete ? (
              <div className="flex items-center gap-1.5 text-xs text-amber-400 font-mono bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-md">
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>Typing {filledIndices.length}/{fields.length}...</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-xs text-zinc-300 font-mono bg-white/5 border border-white/10 px-2.5 py-1 rounded-md">
                <ShieldCheck className="w-3.5 h-3.5 text-white/80" />
                <span>{fields.length}/{fields.length} Grounded</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {activeTab === 'browserPreview' ? (
        /* Realistic Headless Browser Sandbox Viewport */
        <div className="rounded-xl border border-white/15 bg-[#0b0b0e] overflow-hidden shadow-2xl mt-4">
          {/* Browser Chrome Header */}
          <div className="px-4 py-2.5 bg-[#141418] border-b border-white/10 flex items-center justify-between gap-4">
            {/* macOS Traffic Lights */}
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#ff5f56] inline-block shadow-sm" />
              <span className="w-2.5 h-2.5 rounded-full bg-[#ffbd2e] inline-block shadow-sm" />
              <span className="w-2.5 h-2.5 rounded-full bg-[#27c93f] inline-block shadow-sm" />
            </div>

            {/* URL Address Bar with SSL Lock */}
            <div className="flex-1 max-w-xl mx-auto flex items-center gap-2 px-3 py-1 rounded-md bg-[#09090b] border border-white/10 text-xs font-mono text-zinc-300">
              <Lock className="w-3 h-3 text-emerald-400 flex-none" />
              <span className="text-zinc-500 select-none">https://</span>
              <span className="text-zinc-200 truncate">
                {targetSystem.includes('http')
                  ? targetSystem.replace(/^.*https?:\/\//i, '').replace(/\).*$/, '')
                  : isGoogleForm
                  ? 'docs.google.com/forms/d/e/live-form/viewform'
                  : `portal.internal.corp/${targetSystem.toLowerCase().replace(/[^a-z0-9]+/g, '-')}/form`}
              </span>
              <span className="ml-auto text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">
                TLS 1.3
              </span>
            </div>

            {/* Agent Playwright Status */}
            <div className="flex items-center gap-1.5 text-[11px] font-mono text-white/70 bg-white/5 border border-white/10 px-2 py-0.5 rounded">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse inline-block" />
              <span>{isGoogleForm ? 'Google Forms Automation Driver' : 'Playwright Driver Active'}</span>
            </div>
          </div>

          {/* Web Document Body */}
          <div className="p-6 space-y-4 bg-gradient-to-b from-[#0f0f13] to-[#0a0a0c]">
            {isGoogleForm && (
              <div className="h-2 -mt-6 -mx-6 bg-[#673ab7] rounded-t-sm shadow-sm" />
            )}
            <div className="pb-3 border-b border-white/10 flex items-center justify-between">
              <div>
                <h4 className="text-sm font-semibold text-white tracking-wide flex items-center gap-2">
                  <span>{title}</span>
                  {isGoogleForm && (
                    <span className="text-[10px] font-mono bg-[#673ab7]/30 text-[#d1c4e9] border border-[#673ab7]/50 px-2 py-0.5 rounded">
                      Google Forms
                    </span>
                  )}
                </h4>
                <p className="text-[11px] text-zinc-400 font-mono mt-0.5">
                  {isGoogleForm
                    ? 'Automated Google Forms Schema Mapping & Evidence Population'
                    : 'Sandboxed Enterprise Execution Endpoint'}
                </p>
              </div>
              <span className="text-[11px] font-mono text-zinc-500 bg-white/5 px-2 py-1 rounded border border-white/5">
                Session Scope: Protected
              </span>
            </div>

            {/* Form Fields Injected by Agent */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
              {fields.map((field, idx) => {
                const isFilled = filledIndices.includes(idx);
                const isCurrentTyping = filledIndices.length === idx + 1 && !isComplete;
                const displayVal = editedValues[field.fieldId] !== undefined ? editedValues[field.fieldId] : field.value;

                return (
                  <motion.div
                    key={field.fieldId}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: isFilled ? 1 : 0.35, y: isFilled ? 0 : 2 }}
                    transition={{ duration: 0.2 }}
                    className={`p-3 rounded-lg border transition-all ${
                      isCurrentTyping
                        ? 'border-white/40 bg-white/[0.04] ring-1 ring-white/20'
                        : isFilled
                        ? 'border-white/10 bg-[#121216]'
                        : 'border-white/5 bg-[#0e0e11]'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-medium text-zinc-300">
                        {field.label}
                      </label>
                      <span className="text-[10px] font-mono text-zinc-500 bg-black/40 px-1.5 py-0.5 rounded border border-white/5">
                        {field.entryName ? field.entryName : `#${field.fieldId}`}
                      </span>
                    </div>

                    <div className="relative flex items-center">
                      {field.type === 'textarea' ? (
                        <textarea
                          readOnly
                          rows={2}
                          value={isFilled ? displayVal : ''}
                          placeholder={isFilled ? '' : 'Autonomous agent typing...'}
                          className={`w-full bg-[#18181f] border rounded px-3 py-2 text-xs font-mono text-white placeholder-zinc-600 focus:outline-none transition resize-none ${
                            isCurrentTyping ? 'border-white/40' : 'border-white/10'
                          }`}
                        />
                      ) : (
                        <input
                          type="text"
                          readOnly
                          value={isFilled ? displayVal : ''}
                          placeholder={isFilled ? '' : 'Autonomous agent typing...'}
                          className={`w-full bg-[#18181f] border rounded px-3 py-2 text-xs font-mono text-white placeholder-zinc-600 focus:outline-none transition ${
                            isCurrentTyping ? 'border-white/40' : 'border-white/10'
                          }`}
                        />
                      )}
                      {isCurrentTyping && (
                        <span className="absolute right-3 w-1.5 h-3.5 bg-white animate-pulse inline-block" />
                      )}
                    </div>

                    {/* Field Provenance Citation Pill inside Web Preview */}
                    {isFilled && (
                      <div className="mt-2 flex items-center justify-between text-[11px] pt-1.5 border-t border-white/5">
                        <button
                          type="button"
                          onClick={() => onInspectEvidence(field.evidenceId)}
                          className="text-zinc-400 hover:text-white transition flex items-center gap-1 font-mono group"
                          title="Inspect source document citation"
                        >
                          <FileText className="w-3 h-3 text-zinc-500 group-hover:text-white" />
                          <span className="truncate max-w-[170px] underline decoration-zinc-600 underline-offset-2">
                            {field.sourceDocument}
                          </span>
                        </button>
                        <span className="text-emerald-400 font-mono text-[10px] bg-emerald-500/10 px-1.5 py-0.2 rounded border border-emerald-500/20">
                          {Math.round(field.confidence * 100)}% match
                        </span>
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </div>

            {/* Sandbox Actions Footer */}
            <div className="pt-4 border-t border-white/10 flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-2 text-[11px] font-mono text-zinc-400">
                <Terminal className="w-3.5 h-3.5 text-zinc-500" />
                <span>
                  {isGoogleForm ? 'Google Form DOM Selectors:' : 'Playwright LOCATORS:'} {fields.length} DOM targets mapped cleanly
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled
                  className="px-3.5 py-1.5 rounded-lg border border-white/10 bg-white/5 text-zinc-500 text-xs font-mono cursor-not-allowed"
                >
                  Reset Form
                </button>
                {isHumanApproved ? (
                  <div className="px-4 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 text-xs font-mono border border-emerald-500/20 flex items-center gap-2">
                    <Check className="w-3 h-3 text-emerald-400" />
                    <span>Submitted &amp; Signed into Audit Chain</span>
                  </div>
                ) : (
                  <div className="px-4 py-1.5 rounded-lg bg-white/10 text-white/80 text-xs font-mono border border-white/15 flex items-center gap-2">
                    <Lock className="w-3 h-3 text-amber-400" />
                    <span>Awaiting Cryptographic Approval Challenge</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Grounding & Provenance Grid View */
        <div className="form-fields-list mt-4 space-y-2.5">
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
                    <span className="field-label-minimal font-medium text-xs text-zinc-300">
                      {field.label}
                    </span>
                    {field.userConfirmed && (
                      <span className="badge-minimal text-[10px] bg-white/10 text-white px-2 py-0.5 rounded border border-white/20">
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
                        className="bg-[#141418] border border-white/20 rounded px-2.5 py-1 text-xs text-white font-mono w-full focus:outline-none focus:border-white"
                        autoFocus
                      />
                      <button
                        onClick={() => setEditingFieldId(null)}
                        className="px-2.5 py-1 rounded bg-white text-black text-xs font-mono font-medium"
                        type="button"
                      >
                        Save
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between group">
                      <span className="field-value-minimal font-mono text-sm text-white">
                        {isFilled ? currentValue : '—'}
                      </span>
                      {isFilled && (
                        <button
                          onClick={() => setEditingFieldId(field.fieldId)}
                          className="opacity-0 group-hover:opacity-100 p-1 text-white/40 hover:text-white transition"
                          title="Edit value manually"
                          type="button"
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
                    className="provenance-pill-minimal hover:border-white/30 transition"
                    title="Inspect source document excerpt"
                  >
                    <FileText className="w-3 h-3 text-zinc-400" />
                    <span className="truncate max-w-[140px] text-zinc-300 font-mono text-xs">
                      {field.sourceDocument}
                    </span>
                    <span className="text-emerald-400 font-mono text-[10px]">
                      {Math.round(field.confidence * 100)}%
                    </span>
                  </button>
                )}
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Footer disclaimer */}
      <div className="form-card-footer mt-4 pt-3 border-t border-white/10 flex items-center gap-2 text-xs text-zinc-400 font-mono">
        <Info className="w-3.5 h-3.5 text-zinc-500 flex-none" />
        <span>
          Deterministic browser automation sandbox. External form dispatch strictly gated behind declarative Cedar PDP and cryptographic human signature.
        </span>
      </div>
    </div>
  );
}
