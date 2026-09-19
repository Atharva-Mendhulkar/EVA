'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { AuditEvent } from '@/lib/engine/types';

interface AuditTimelineViewProps {
  events: AuditEvent[];
  onInspectEvidence?: (evidenceId: string) => void;
}

export function AuditTimelineView({
  events,
  onInspectEvidence
}: AuditTimelineViewProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  return (
    <div className="audit-view-minimal">
      <div className="flex items-center justify-between pb-3 border-b border-zinc-800/80 mb-4">
        <div>
          <span className="badge-minimal">AUDIT TRAIL</span>
          <h2 className="text-base font-medium text-zinc-100 mt-1">Append-Only Event Ledger</h2>
        </div>
        <span className="text-xs text-zinc-500 font-mono">
          {events.length} Events Recorded
        </span>
      </div>

      <div className="flex flex-col gap-2">
        {events.map((evt) => {
          const isExpanded = expandedId === evt.eventId;

          return (
            <div
              key={evt.eventId}
              onClick={() => toggleExpand(evt.eventId)}
              className="audit-row-minimal"
              role="button"
              tabIndex={0}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono text-zinc-500">
                    {new Date(evt.timestamp).toLocaleTimeString()}
                  </span>
                  <span className="text-xs text-zinc-200 font-mono font-medium">
                    {evt.action}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="badge-minimal text-[10px]">{evt.decision}</span>
                  {isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-zinc-500" /> : <ChevronDown className="w-3.5 h-3.5 text-zinc-500" />}
                </div>
              </div>

              <p className="text-xs text-zinc-400 mt-1 font-mono">
                {evt.reason}
              </p>

              {isExpanded && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="trace-box-minimal mt-2"
                >
                  <div className="text-[11px] font-mono text-zinc-400 flex flex-col gap-1.5">
                    <div>Actor: {evt.actor}</div>
                    <div>Resource: {evt.resource || 'Form::"internship_onboarding"'}</div>
                    <div>SHA-256: <span className="text-zinc-500">{evt.cryptographicHash || `sha256:${evt.eventId.replace(/[^a-zA-Z0-9]/g, '').padEnd(64, '0').slice(0, 64)}`}</span></div>
                    {evt.evidenceRefs && evt.evidenceRefs.length > 0 && (
                      <div className="flex items-center gap-1.5 flex-wrap mt-1">
                        <span className="text-zinc-500">Evidence Citations:</span>
                        {evt.evidenceRefs.map((refId) => (
                          <button
                            key={refId}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onInspectEvidence?.(refId);
                            }}
                            className="badge-minimal text-[10px] hover:border-zinc-500 cursor-pointer"
                            title="Inspect evidence excerpt"
                          >
                            {refId}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
