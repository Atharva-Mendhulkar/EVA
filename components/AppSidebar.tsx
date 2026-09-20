'use client';

import React from 'react';
import {
  Plus,
  PanelLeftClose,
  Trash2
} from 'lucide-react';
import { WorkflowRun } from '@/lib/engine/types';

interface AppSidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  workflows: WorkflowRun[];
  activeWorkflowId?: string;
  onSelectWorkflow: (runId: string) => void;
  onNewOperation: () => void;
  onDeleteWorkflow?: (runId: string) => void;
}

export function AppSidebar({
  isOpen,
  onToggle,
  workflows,
  activeWorkflowId,
  onSelectWorkflow,
  onNewOperation,
  onDeleteWorkflow
}: AppSidebarProps) {
  const getStatusBadge = (wf: WorkflowRun) => {
    if (wf.status === 'COMPLETED') {
      return {
        label: 'Approved',
        className: 'text-zinc-100 bg-white/10 border-white/20'
      };
    }
    if (wf.status === 'AWAITING_HUMAN_APPROVAL') {
      return {
        label: 'Approval',
        className: 'text-zinc-300 bg-white/5 border-white/15'
      };
    }
    if (wf.status === 'AWAITING_USER_RESOLUTION') {
      return {
        label: 'Conflict',
        className: 'text-zinc-200 bg-white/5 border-white/15'
      };
    }
    return {
      label: 'Active',
      className: 'text-zinc-400 bg-white/[0.03] border-white/10'
    };
  };

  const formatRelativeTime = (isoString?: string) => {
    if (!isoString) return '';
    try {
      const diffMs = Date.now() - new Date(isoString).getTime();
      const mins = Math.floor(diffMs / 60000);
      if (mins < 1) return 'just now';
      if (mins < 60) return `${mins}m ago`;
      const hours = Math.floor(mins / 60);
      if (hours < 24) return `${hours}h ago`;
      return `${Math.floor(hours / 24)}d ago`;
    } catch {
      return '';
    }
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={onToggle}
          aria-hidden="true"
        />
      )}

      {/* Sidebar Container - Strict Obsidian Monochrome */}
      <aside
        className={`fixed top-0 left-0 bottom-0 z-40 bg-[#111114] border-r border-[#242428] flex flex-col transition-all duration-300 ease-in-out lg:relative lg:translate-x-0 ${
          isOpen
            ? 'w-[280px] translate-x-0 lg:w-[280px] lg:opacity-100 shadow-2xl lg:shadow-none'
            : '-translate-x-full lg:w-0 lg:opacity-0 lg:overflow-hidden lg:border-r-0'
        }`}
      >
        {/* Top Header */}
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-[#242428] bg-[#141418]">
          <div className="flex items-center gap-2.5">
            <img
              src="/logo.svg"
              alt="EVA"
              className="w-7 h-7 rounded-lg object-contain bg-black border border-white/10 p-0.5"
            />
            <div>
              <span className="text-sm font-semibold text-white tracking-wider">EVA</span>
              <span className="ml-1.5 text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/10 text-white/70">
                v2.5
              </span>
            </div>
          </div>
          <button
            onClick={onToggle}
            className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/5 transition"
            title="Collapse sidebar"
            aria-label="Collapse sidebar"
          >
            <PanelLeftClose className="w-4 h-4" />
          </button>
        </div>

        {/* Action: + New Operation */}
        <div className="p-3 border-b border-[#242428]">
          <button
            onClick={onNewOperation}
            className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl bg-white text-black font-medium text-xs hover:bg-white/90 active:scale-[0.99] transition shadow-sm"
          >
            <div className="flex items-center gap-2">
              <Plus className="w-4 h-4 text-black stroke-[2.5]" />
              <span>New Operation</span>
            </div>
            <kbd className="text-[10px] font-mono text-black/60 bg-black/10 px-1.5 py-0.5 rounded">
              Ctrl+N
            </kbd>
          </button>
        </div>

        {/* Scrollable Center Section: Chats */}
        <div className="flex-1 overflow-y-auto p-3 space-y-4 custom-scrollbar">
          <div>
            <div className="flex items-center justify-between px-1 mb-2">
              <span className="text-[11px] font-mono uppercase tracking-wider text-white/40">
                Chats
              </span>
              <span className="text-[10px] text-white/40 font-mono">
                {workflows.length} chats
              </span>
            </div>

            <div className="space-y-1">
              {workflows.length === 0 ? (
                <div className="px-2 py-8 text-center text-xs text-white/40 font-mono leading-relaxed">
                  No chats yet. Press Ctrl+N to start.
                </div>
              ) : (
                workflows.map((wf) => {
                  const isSelected = wf.workflowRunId === activeWorkflowId;
                  const badge = getStatusBadge(wf);
                  const relTime = formatRelativeTime(wf.createdAt);

                  return (
                    <div
                      key={wf.workflowRunId}
                      className={`group flex items-center justify-between p-2.5 rounded-xl transition border cursor-pointer ${
                        isSelected
                          ? 'bg-white/10 text-white border-white/20'
                          : 'text-white/70 hover:text-white hover:bg-white/5 border-transparent'
                      }`}
                      onClick={() => onSelectWorkflow(wf.workflowRunId)}
                    >
                      <div className="min-w-0 flex-1 pr-2">
                        <div className="flex items-center justify-between gap-1.5 mb-1">
                          <span className="text-xs font-medium truncate text-white">
                            {wf.title || wf.intent || 'Operation'}
                          </span>
                          {relTime && (
                            <span className="text-[10px] font-mono text-white/30 shrink-0">
                              {relTime}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center justify-between gap-2 mt-1">
                          <p className="text-[11px] text-white/50 truncate max-w-[150px]">
                            {wf.intent}
                          </p>
                          <span
                            className={`text-[9px] font-mono uppercase px-1.5 py-0.5 rounded border shrink-0 ${badge.className}`}
                          >
                            {badge.label}
                          </span>
                        </div>
                      </div>

                      {onDeleteWorkflow && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteWorkflow(wf.workflowRunId);
                          }}
                          className="opacity-0 group-hover:opacity-100 p-1.5 rounded text-white/30 hover:text-white/80 hover:bg-white/10 transition shrink-0"
                          title="Delete operation"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
