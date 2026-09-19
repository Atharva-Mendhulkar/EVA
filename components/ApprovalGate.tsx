'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Loader2 } from 'lucide-react';

interface ApprovalGateProps {
  onApprove: () => Promise<void>;
  isSubmitting?: boolean;
}

export function ApprovalGate({ onApprove, isSubmitting }: ApprovalGateProps) {
  const [confirmed, setConfirmed] = useState(false);

  const handleApprove = async () => {
    try {
      setConfirmed(true);
      await onApprove();
    } finally {
      setConfirmed(false);
    }
  };

  const loading = isSubmitting || confirmed;

  return (
    <motion.div
      className="approval-gate-minimal"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="badge-minimal">HUMAN CONSENT REQUIRED</span>
            <span className="text-zinc-500 font-mono text-[11px]">Cedar Policy 02</span>
          </div>
          <h3 className="text-base font-medium text-zinc-100">
            Authorize External Sandbox Submission
          </h3>
          <p className="text-xs text-zinc-400 mt-1 max-w-xl leading-relaxed">
            All 6 onboarding fields have verified citations. Cedar Policy strictly denies external submission without explicit human consent.
          </p>
        </div>

        {/* Action Button with Loading Spinner Animation */}
        <button
          onClick={handleApprove}
          disabled={loading}
          className="approve-btn-minimal"
          type="button"
        >
          {loading ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Submitting to Sandbox...</span>
            </>
          ) : (
            <>
              <span>Approve &amp; Submit</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </>
          )}
        </button>
      </div>

      <div className="approval-metrics-strip mt-3 pt-3 border-t border-zinc-800/80 flex items-center gap-4 text-xs text-zinc-400 font-mono">
        <span>Target: Mock HR Sandbox</span>
        <span>•</span>
        <span>6 Fields Verified</span>
        <span>•</span>
        <span>Zero Unresolved Conflicts</span>
      </div>
    </motion.div>
  );
}
