'use client';

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowUp,
  CheckCircle2,
  History,
  Loader2,
  PanelLeft,
  Pin,
  Paperclip,
  Globe,
  ClipboardList,
  Cpu,
  Wrench,
  RotateCcw,
  X
} from 'lucide-react';
import { AgentProgress } from '@/components/AgentProgress';
import { MockFormExecution } from '@/components/MockFormExecution';
import { CedarInspector } from '@/components/CedarInspector';
import { ApprovalGate } from '@/components/ApprovalGate';
import { ConflictModal } from '@/components/ConflictModal';
import { DecisionExplanationCard } from '@/components/DecisionExplanationCard';
import { VaultView } from '@/components/VaultView';
import { AuditTimelineView } from '@/components/AuditTimelineView';
import { EvidenceDrawer } from '@/components/EvidenceDrawer';
import { AppSidebar } from '@/components/AppSidebar';
import { FeaturesModal } from '@/components/FeaturesModal';
import { DocumentUploadModal } from '@/components/DocumentUploadModal';
import { Evidence, WorkflowRun } from '@/lib/engine/types';
import { TEMPLATES } from '@/lib/engine/fixtures';

function StarrySky() {
  return (
    <div className="starry-background" aria-hidden="true">
      <div className="starry-field starry-field-twinkle" />
      <div className="starry-field-ambient" />
      {Array.from({ length: 16 }, (_, i) => (
        <div key={i} className={`shooting-star shooting-star-${i + 1}`} />
      ))}
    </div>
  );
}

export default function Page() {
  const [sessionRunIds, setSessionRunIds] = useState<string[]>([]);
  const [started, setStarted] = useState(false);
  const [promptText, setPromptText] = useState('');
  const [activeTab, setActiveTab] = useState<'Answer' | 'Vault' | 'Audit'>('Answer');
  const [workflow, setWorkflow] = useState<WorkflowRun | null>(null);
  const [allWorkflows, setAllWorkflows] = useState<WorkflowRun[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [featuresModalOpen, setFeaturesModalOpen] = useState(false);
  const [selectedFeature, setSelectedFeature] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [showConflictModal, setShowConflictModal] = useState(false);
  const [selectedEvidence, setSelectedEvidence] = useState<Evidence | null>(null);
  const [followUpText, setFollowUpText] = useState('');

  // Chatbox In-Memory File Attachment & OCR states
  const [uploadedFiles, setUploadedFiles] = useState<{ id: string; name: string; size: number; fingerprint: string; extractedCount: number }[]>([]);
  const [isUploadingInChat, setIsUploadingInChat] = useState(false);

  // Chatbox Search, Form Filling, MCP, Tools capability toggles
  const [enableSearch, setEnableSearch] = useState(true);
  const [enableFormFill, setEnableFormFill] = useState(true);
  const [enableMcp, setEnableMcp] = useState(true);
  const [enableTools, setEnableTools] = useState(true);

  const landingFileInputRef = React.useRef<HTMLInputElement>(null);
  const followUpFileInputRef = React.useRef<HTMLInputElement>(null);

  // Restore session-scoped workflow runs from sessionStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = sessionStorage.getItem('eva_session_runs');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) {
            setSessionRunIds(parsed);
          }
        }
      } catch (err) {
        console.error('Failed to parse session runs:', err);
      }
    }
  }, []);

  const handleChatFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setIsUploadingInChat(true);
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const formData = new FormData();
        formData.append('file', file);
        const res = await fetch('/api/v1/vault/upload', {
          method: 'POST',
          body: formData
        });
        if (res.ok) {
          const data = await res.json();
          setUploadedFiles((prev) => [
            ...prev,
            {
              id: data.document.id,
              name: file.name,
              size: file.size,
              fingerprint: data.document.sha256Fingerprint?.slice(0, 8) || '',
              extractedCount: data.extractedEvidence?.length || 0
            }
          ]);
          fetchWorkflow();
        }
      }
    } catch (err) {
      console.error('In-chat upload error:', err);
    } finally {
      setIsUploadingInChat(false);
      if (e.target) e.target.value = '';
    }
  };

  const handleRemoveAttachedFile = (fileId: string) => {
    setUploadedFiles((prev) => prev.filter((f) => f.id !== fileId));
  };

  // Fetch workflow state on mount and hydrate
  const fetchWorkflow = async () => {
    try {
      // 1. Fetch active workflow
      const res = await fetch('/api/v1/workflows');
      if (res.ok) {
        const data: WorkflowRun = await res.json();
        setWorkflow(data);
        if (data.intent && !promptText && typeof window !== 'undefined' && (sessionStorage.getItem('eva_started') === 'true' || sessionStorage.getItem('nexus_started') === 'true')) {
          setPromptText(data.intent);
        }
        if (typeof window !== 'undefined' && (sessionStorage.getItem('eva_started') === 'true' || sessionStorage.getItem('nexus_started') === 'true')) {
          setStarted(true);
        }
      }

      // 2. Fetch list of all workflows for sidebar
      const listRes = await fetch('/api/v1/workflows?all=true');
      if (listRes.ok) {
        const listData = await listRes.json();
        if (Array.isArray(listData.workflows)) {
          setAllWorkflows(listData.workflows);
        }
      }
    } catch (err) {
      console.error('Failed to fetch workflow state:', err);
    }
  };

  useEffect(() => {
    fetchWorkflow();
    const interval = setInterval(fetchWorkflow, 3500);
    return () => clearInterval(interval);
  }, []);

  const handleStartWorkflow = async (prompt: string, templateId?: string) => {
    try {
      setIsLoading(true);
      setPromptText(prompt);
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('eva_started', 'true');
      }
      setStarted(true);
      setShowConflictModal(false);

      const res = await fetch('/api/v1/workflows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          intent: prompt,
          template: templateId,
          userId: 'usr_eva_admin',
          enableSearch,
          enableFormFill,
          enableMcp,
          enableTools,
          attachedDocumentIds: uploadedFiles.map((f) => f.id)
        })
      });

      if (res.ok) {
        const data: WorkflowRun = await res.json();
        setWorkflow(data);

        // Record into this session's workflow runs
        if (data.workflowRunId) {
          setSessionRunIds((prev) => {
            const updated = prev.includes(data.workflowRunId) ? prev : [data.workflowRunId, ...prev];
            if (typeof window !== 'undefined') {
              sessionStorage.setItem('eva_session_runs', JSON.stringify(updated));
            }
            return updated;
          });
        }

        fetchWorkflow();
        // Cinematic demo pause (750ms) before opening conflict card
        if (data.conflicts && data.conflicts.length > 0 && data.status === 'AWAITING_USER_RESOLUTION') {
          setTimeout(() => {
            setShowConflictModal(true);
          }, 750);
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectWorkflow = async (runId: string) => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/v1/workflows/active', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ runId })
      });

      if (res.ok) {
        const active: WorkflowRun = await res.json();
        setWorkflow(active);
        setPromptText(active.intent);
        setStarted(true);
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('nexus_started', 'true');
        }
        setShowConflictModal(false);
        if (active.conflicts && active.conflicts.some((c) => c.status === 'open') && active.status === 'AWAITING_USER_RESOLUTION') {
          setTimeout(() => {
            setShowConflictModal(true);
          }, 400);
        }
        fetchWorkflow();
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectTemplate = (templateId: string) => {
    const tpl = TEMPLATES[templateId];
    if (tpl) {
      handleStartWorkflow(tpl.defaultPrompt, templateId);
    }
  };

  const handleNewOperation = () => {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('eva_started');
      sessionStorage.removeItem('nexus_started');
    }
    setStarted(false);
    setPromptText('');
    setShowConflictModal(false);
    setActiveTab('Answer');
  };

  const handleDeleteWorkflow = (runId: string) => {
    setSessionRunIds((prev) => {
      const updated = prev.filter((id) => id !== runId);
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('eva_session_runs', JSON.stringify(updated));
      }
      return updated;
    });
    if (workflow?.workflowRunId === runId) {
      handleNewOperation();
    }
  };

  const sessionWorkflows = allWorkflows.filter((w) => sessionRunIds.includes(w.workflowRunId));

  const handleOpenFeatures = (featureId?: string) => {
    setSelectedFeature(featureId || null);
    setFeaturesModalOpen(true);
  };

  const handleResolveConflict = async (evidenceId: string, overrideVal?: string) => {
    if (!workflow) return;
    const conflict = workflow.conflicts.find((c) => c.status === 'open') || workflow.conflicts[0];
    if (!conflict) return;

    try {
      setIsLoading(true);
      const res = await fetch(`/api/v1/workflows/${workflow.workflowRunId}/conflicts/${conflict.conflictId}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conflictId: conflict.conflictId,
          selectedEvidenceId: evidenceId,
          overrideValue: overrideVal
        })
      });

      if (res.ok) {
        const updated = await res.json();
        setWorkflow(updated);
        setShowConflictModal(false);
        fetchWorkflow();
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleApproveSubmission = async () => {
    if (!workflow) return;

    try {
      setIsLoading(true);
      const res = await fetch(`/api/v1/workflows/${workflow.workflowRunId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision: 'APPROVE', notes: 'Verified via evidence drawer & human sign-off' })
      });

      if (res.ok) {
        const updated = await res.json();
        setWorkflow(updated);
        fetchWorkflow();
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetDemo = async () => {
    try {
      setIsResetting(true);
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('nexus_started');
      }
      const res = await fetch(`/api/v1/workflows/${workflow?.workflowRunId || 'run_demo_01'}/reset`, { method: 'POST' });
      if (res.ok) {
        const fresh = await res.json();
        setWorkflow(fresh);
        setShowConflictModal(false);
        setStarted(false);
        setActiveTab('Answer');
        fetchWorkflow();
      }
    } finally {
      setIsResetting(false);
    }
  };

  const handleInspectEvidence = (evidenceId: string) => {
    if (!workflow) return;
    const ev = workflow.evidence.find((e) => e.evidenceId === evidenceId);
    if (ev) {
      setSelectedEvidence(ev);
    }
  };

  const openConflict = workflow?.conflicts.find((c) => c.status === 'open');
  const latestCedar = workflow?.cedarDecisions?.[workflow.cedarDecisions.length - 1];

  return (
    <div className="nexus-app-container">
      <StarrySky />

      <div className="app-shell">
        {/* Past Chats Button fixed on the Left Side End (Landing View only) */}
        {!sidebarOpen && !started && (
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="fixed top-4 left-4 z-40 flex items-center gap-2 px-3 py-2 rounded-xl bg-[#141418] border border-white/15 hover:bg-white/10 text-white/80 hover:text-white transition shadow-2xl text-xs font-mono group"
            title="Open past chats sidebar"
            aria-label="Open past chats sidebar"
          >
            <PanelLeft className="w-4 h-4 text-white/70 group-hover:text-white" />
            <span>Past Chats</span>
          </button>
        )}

        {/* ChatGPT-style Collapsible Sidebar - Session Scoped */}
        <AppSidebar
          isOpen={sidebarOpen}
          onToggle={() => setSidebarOpen(!sidebarOpen)}
          workflows={sessionWorkflows}
          activeWorkflowId={workflow?.workflowRunId}
          onSelectWorkflow={handleSelectWorkflow}
          onNewOperation={handleNewOperation}
          onDeleteWorkflow={handleDeleteWorkflow}
        />

        {/* Main Content Area */}
        <div className="main-content-area">
          {!started ? (
            /* Landing View: Minimalist Perplexity-style input with ChatGPT-style sidebar */
            <main className="landing-view-minimal">
              <div className="flex flex-col items-center justify-center mb-5">
                <span className="landing-label font-mono tracking-wider">EVA · EVIDENCE-AWARE ADMINISTRATIVE AGENT</span>
                <h1 className="landing-title">What do you want to get done?</h1>
              </div>

              {/* Centered Capsule Input */}
              <div className="composer-capsule">
                {/* Attached in-chat documents preview */}
                {uploadedFiles.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 mb-2.5 pb-2 border-b border-white/10">
                    {uploadedFiles.map((f) => (
                      <span
                        key={f.id}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/10 border border-white/15 text-[11px] font-mono text-white"
                      >
                        <Paperclip className="w-3 h-3 text-white/70" />
                        <span className="truncate max-w-[150px]">{f.name}</span>
                        <span className="text-[9px] text-white/40">({f.extractedCount} fields)</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveAttachedFile(f.id)}
                          className="hover:text-white text-white/50 transition ml-0.5"
                          title="Remove attachment"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                    {isUploadingInChat && (
                      <span className="inline-flex items-center gap-1 text-[11px] text-white/60 font-mono">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        <span>Parsing OCR...</span>
                      </span>
                    )}
                  </div>
                )}

                <textarea
                  className="composer-textarea"
                  rows={2}
                  value={promptText}
                  onChange={(e) => setPromptText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey && promptText.trim() && !isLoading) {
                      e.preventDefault();
                      handleStartWorkflow(promptText);
                    }
                  }}
                  placeholder="Ask EVA anything or describe your operational goal..."
                  aria-label="Workflow prompt input"
                />

                <input
                  ref={landingFileInputRef}
                  type="file"
                  multiple
                  accept=".pdf,.txt,.md,.json,.png,.jpg,.jpeg"
                  className="hidden"
                  onChange={handleChatFileUpload}
                />

                <div className="composer-capsule-footer">
                  <div className="capsule-pills-left flex flex-wrap items-center gap-1.5">
                    {/* Attach (Pin) */}
                    <button
                      type="button"
                      onClick={() => landingFileInputRef.current?.click()}
                      disabled={isUploadingInChat}
                      className="capsule-pill transition flex items-center gap-1.5 text-white/70 hover:text-white hover:bg-white/10 border-white/10"
                      title="Upload & Attach Document (In-Memory OCR)"
                      aria-label="Attach document"
                    >
                      <Pin className="w-3.5 h-3.5" />
                      <span className="text-xs">Attach</span>
                    </button>

                    {/* Search (Globe) */}
                    <button
                      type="button"
                      onClick={() => setEnableSearch(!enableSearch)}
                      className={`capsule-pill transition flex items-center gap-1.5 ${
                        enableSearch
                          ? 'bg-white text-black font-medium border-white shadow-sm'
                          : 'text-white/50 hover:text-white/80 hover:bg-white/5 border-white/10'
                      }`}
                      title="Toggle Grounded Vector Search"
                      aria-label="Toggle grounded search"
                    >
                      <Globe className="w-3.5 h-3.5" />
                      <span className="text-xs">Search</span>
                    </button>

                    {/* Form Fill (Form icon) */}
                    <button
                      type="button"
                      onClick={() => setEnableFormFill(!enableFormFill)}
                      className={`capsule-pill transition flex items-center gap-1.5 ${
                        enableFormFill
                          ? 'bg-white text-black font-medium border-white shadow-sm'
                          : 'text-white/50 hover:text-white/80 hover:bg-white/5 border-white/10'
                      }`}
                      title="Toggle Autonomous Form Filling"
                      aria-label="Toggle autonomous form filling"
                    >
                      <ClipboardList className="w-3.5 h-3.5" />
                      <span className="text-xs">Form Fill</span>
                    </button>

                    {/* MCP (MCP icon) */}
                    <button
                      type="button"
                      onClick={() => setEnableMcp(!enableMcp)}
                      className={`capsule-pill transition flex items-center gap-1.5 ${
                        enableMcp
                          ? 'bg-white text-black font-medium border-white shadow-sm'
                          : 'text-white/50 hover:text-white/80 hover:bg-white/5 border-white/10'
                      }`}
                      title="Toggle Model Context Protocol (MCP)"
                      aria-label="Toggle MCP"
                    >
                      <Cpu className="w-3.5 h-3.5" />
                      <span className="text-xs">MCP</span>
                    </button>

                    {/* Tools (Tools icon) */}
                    <button
                      type="button"
                      onClick={() => setEnableTools(!enableTools)}
                      className={`capsule-pill transition flex items-center gap-1.5 ${
                        enableTools
                          ? 'bg-white text-black font-medium border-white shadow-sm'
                          : 'text-white/50 hover:text-white/80 hover:bg-white/5 border-white/10'
                      }`}
                      title="Toggle Agent Tools"
                      aria-label="Toggle tools"
                    >
                      <Wrench className="w-3.5 h-3.5" />
                      <span className="text-xs">Tools</span>
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleStartWorkflow(promptText)}
                    disabled={!promptText.trim() || isLoading}
                    className="action-circle-btn"
                    aria-label="Submit prompt"
                  >
                    {isLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin text-black" />
                    ) : (
                      <ArrowUp className="w-4 h-4 text-black" />
                    )}
                  </button>
                </div>
              </div>

              <p className="text-[11px] text-zinc-500 mt-8 font-mono">
                Evidence before action · Real Cedar Policy Enforcement · AWS Serverless · 16 Shooting Stars Active
              </p>
            </main>
          ) : (
            /* Active Conversation & Execution Stream */
            <div className="flex-1 flex flex-col min-w-0">
              {/* Top Bar with Clean Minimalist Tabs & Aligned Sidebar Toggle */}
              <header className="minimal-topbar">
                <div className="topbar-tabs flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setSidebarOpen(!sidebarOpen)}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-white/80 hover:text-white transition text-xs font-mono"
                    title={sidebarOpen ? 'Collapse sidebar' : 'Open past operations sidebar'}
                    aria-label={sidebarOpen ? 'Collapse sidebar' : 'Open past operations sidebar'}
                  >
                    <PanelLeft className="w-3.5 h-3.5 text-white/70" />
                    <span>Past Chats</span>
                  </button>

                  <div className="h-4 w-px bg-white/10 mx-0.5" />

                  <button
                    type="button"
                    onClick={() => setActiveTab('Answer')}
                    className={`nav-tab-minimal ${activeTab === 'Answer' ? 'tab-active' : ''}`}
                  >
                    Answer
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('Vault')}
                    className={`nav-tab-minimal ${activeTab === 'Vault' ? 'tab-active' : ''}`}
                  >
                    Vault Documents ({workflow?.evidence?.length ?? 0})
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('Audit')}
                    className={`nav-tab-minimal ${activeTab === 'Audit' ? 'tab-active' : ''}`}
                  >
                    Audit Trail ({workflow?.auditTrail?.length ?? 0})
                  </button>
                </div>

                <div className="flex items-center gap-3">
                  <div className="status-indicator-pill">
                    <span className="pulse-dot" />
                    <span>{workflow?.status || 'RUNNING'}</span>
                  </div>

                  <button
                    type="button"
                    onClick={handleResetDemo}
                    disabled={isResetting}
                    className="capsule-pill"
                    title="Reset to initial state"
                  >
                    {isResetting ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <RotateCcw className="w-3 h-3" />
                    )}
                    <span>Reset</span>
                  </button>
                </div>
              </header>

              {/* Main Body */}
              <main className="stream-container">
                {activeTab === 'Vault' ? (
                  <VaultView />
                ) : activeTab === 'Audit' ? (
                  <AuditTimelineView
                    events={workflow?.auditTrail || []}
                    onInspectEvidence={handleInspectEvidence}
                  />
                ) : (
                  <>
                    {/* Operation Title / Target Header */}
                    {workflow && (
                      <div className="mb-4 flex items-center justify-between pb-3 border-b border-white/5">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono text-white/40 uppercase tracking-wider">
                            Case Domain:
                          </span>
                          <span className="text-xs font-medium text-white px-2 py-0.5 rounded bg-white/5 border border-white/10">
                            {workflow.title || workflow.template}
                          </span>
                        </div>
                        <span className="text-[11px] font-mono text-white/40">
                          {workflow.targetSystem}
                        </span>
                      </div>
                    )}

                    {/* User Prompt Bubble on right */}
                    <div className="user-query-bubble">
                      {promptText || workflow?.intent || 'Administrative Operation'}
                    </div>

                    {/* Agent Thinking Progress Disclosure with 8-Phase Stepper */}
                    <AgentProgress
                      status={workflow?.status || 'PLANNING'}
                      hasOpenConflict={Boolean(openConflict)}
                      isHumanApproved={workflow?.status === 'COMPLETED'}
                      fieldsCount={workflow?.formFields.length || 0}
                      isExecuting={isLoading}
                      plan={workflow?.plan}
                      stepIndex={workflow?.stepIndex}
                    />

                    {/* Conflict Notice if modal is closed */}
                    {openConflict && !showConflictModal && (
                      <div className="p-3.5 rounded-xl border border-white/20 bg-white/5 mb-4 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                          <span className="text-white/90 font-mono">
                            {openConflict.field.replace(/_/g, ' ')} conflict pending:{' '}
                            {openConflict.candidateEvidence.map((e) => e.value).join(' vs. ')}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowConflictModal(true)}
                          className="conflict-select-btn px-3 py-1 text-xs"
                        >
                          Resolve Conflict
                        </button>
                      </div>
                    )}

                    {/* Form Populating / Executing Card */}
                    {workflow && workflow.formFields.length > 0 && (
                      <MockFormExecution
                        fields={workflow.formFields}
                        onInspectEvidence={handleInspectEvidence}
                        isSubmitting={isLoading}
                        targetSystem={workflow.targetSystem}
                        title={workflow.title ? `${workflow.title} Form` : undefined}
                      />
                    )}

                    {/* Live Cedar Inspector Card */}
                    {latestCedar && <CedarInspector decision={latestCedar} />}

                    {/* Causal Explainability */}
                    {workflow?.latestExplanation && (
                      <DecisionExplanationCard
                        explanation={workflow.latestExplanation}
                        onViewEvidence={handleInspectEvidence}
                      />
                    )}

                    {/* Approval Gate */}
                    {workflow?.status === 'AWAITING_HUMAN_APPROVAL' && (
                      <ApprovalGate
                        onApprove={handleApproveSubmission}
                        isSubmitting={isLoading}
                      />
                    )}

                    {/* Workflow Complete Banner */}
                    {workflow?.status === 'COMPLETED' && (
                      <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="p-4 rounded-xl border border-white/20 bg-white/5 mb-6"
                      >
                        <div className="flex items-center gap-2 text-white font-medium text-sm">
                          <CheckCircle2 className="w-4 h-4 text-white" />
                          <span>{workflow.title || 'Operation'} Completed · HTTP 200 OK</span>
                        </div>
                        <p className="text-xs text-zinc-400 mt-1.5 leading-relaxed font-mono">
                          Evidence verified from vault · Discrepancy resolved by human · Cedar Policy evaluated · Submitted to sandbox {workflow.targetSystem || 'Target System'}.
                        </p>
                        <button
                          type="button"
                          onClick={() => setActiveTab('Audit')}
                          className="conflict-select-btn mt-3 text-xs"
                        >
                          <History className="w-3.5 h-3.5 mr-1.5" />
                          <span>Inspect Append-Only Audit Trail</span>
                        </button>
                      </motion.div>
                    )}
                  </>
                )}
              </main>

              {/* Bottom Docked Follow-Up Input with In-Chat File Attachment & Agent Tools */}
              <div className="bottom-docked-wrapper">
                <div className="bottom-docked-capsule">
                  {/* Attached file chips preview */}
                  {uploadedFiles.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 pb-2 border-b border-white/10 w-full">
                      {uploadedFiles.map((f) => (
                        <span
                          key={f.id}
                          className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-white/10 border border-white/15 text-[11px] font-mono text-white"
                        >
                          <Paperclip className="w-3 h-3 text-white/70" />
                          <span className="truncate max-w-[130px]">{f.name}</span>
                          <span className="text-[9px] text-white/40">({f.extractedCount} fields)</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveAttachedFile(f.id)}
                            className="hover:text-white text-white/50 transition ml-0.5"
                            title="Remove attachment"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                      {isUploadingInChat && (
                        <span className="inline-flex items-center gap-1 text-[11px] text-white/60 font-mono">
                          <Loader2 className="w-3 h-3 animate-spin" />
                          <span>Parsing OCR...</span>
                        </span>
                      )}
                    </div>
                  )}

                  <input
                    ref={followUpFileInputRef}
                    type="file"
                    multiple
                    accept=".pdf,.txt,.md,.json,.png,.jpg,.jpeg"
                    className="hidden"
                    onChange={handleChatFileUpload}
                  />

                  <div className="bottom-docked-input-row">
                    {/* Pin Upload Button */}
                    <button
                      type="button"
                      onClick={() => followUpFileInputRef.current?.click()}
                      disabled={isUploadingInChat}
                      className="p-1.5 rounded-lg hover:bg-white/10 text-white/70 hover:text-white transition flex items-center justify-center shrink-0 border border-white/10"
                      title="Upload & Attach Document (In-Memory OCR)"
                      aria-label="Attach document"
                    >
                      <Pin className="w-4 h-4 text-white/80" />
                    </button>

                    {/* Search Globe Toggle - Highlighted when active */}
                    <button
                      type="button"
                      onClick={() => setEnableSearch(!enableSearch)}
                      className={`p-1.5 rounded-lg transition flex items-center justify-center shrink-0 border ${
                        enableSearch
                          ? 'bg-white text-black font-medium border-white shadow-sm'
                          : 'hover:bg-white/10 text-white/50 hover:text-white/80 border-white/10'
                      }`}
                      title="Toggle Grounded Vector Search"
                      aria-label="Search"
                    >
                      <Globe className="w-4 h-4" />
                    </button>

                    {/* Form Fill Toggle - Highlighted when active */}
                    <button
                      type="button"
                      onClick={() => setEnableFormFill(!enableFormFill)}
                      className={`p-1.5 rounded-lg transition flex items-center justify-center shrink-0 border ${
                        enableFormFill
                          ? 'bg-white text-black font-medium border-white shadow-sm'
                          : 'hover:bg-white/10 text-white/50 hover:text-white/80 border-white/10'
                      }`}
                      title="Toggle Autonomous Form Filling"
                      aria-label="Form Fill"
                    >
                      <ClipboardList className="w-4 h-4" />
                    </button>

                    {/* MCP Toggle - Highlighted when active */}
                    <button
                      type="button"
                      onClick={() => setEnableMcp(!enableMcp)}
                      className={`p-1.5 rounded-lg transition flex items-center justify-center shrink-0 border ${
                        enableMcp
                          ? 'bg-white text-black font-medium border-white shadow-sm'
                          : 'hover:bg-white/10 text-white/50 hover:text-white/80 border-white/10'
                      }`}
                      title="Toggle Model Context Protocol (MCP)"
                      aria-label="MCP"
                    >
                      <Cpu className="w-4 h-4" />
                    </button>

                    {/* Tools Toggle - Highlighted when active */}
                    <button
                      type="button"
                      onClick={() => setEnableTools(!enableTools)}
                      className={`p-1.5 rounded-lg transition flex items-center justify-center shrink-0 border ${
                        enableTools
                          ? 'bg-white text-black font-medium border-white shadow-sm'
                          : 'hover:bg-white/10 text-white/50 hover:text-white/80 border-white/10'
                      }`}
                      title="Toggle Agent Tools"
                      aria-label="Tools"
                    >
                      <Wrench className="w-4 h-4" />
                    </button>

                    <input
                      type="text"
                      value={followUpText}
                      onChange={(e) => setFollowUpText(e.target.value)}
                      placeholder="Ask a follow-up or enter override instructions..."
                      className="bottom-input"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && followUpText.trim()) {
                          handleStartWorkflow(followUpText);
                          setFollowUpText('');
                        }
                      }}
                    />

                    <button
                      type="button"
                      onClick={() => {
                        if (followUpText.trim()) {
                          handleStartWorkflow(followUpText);
                          setFollowUpText('');
                        }
                      }}
                      disabled={!followUpText.trim() || isLoading}
                      className="action-circle-btn shrink-0"
                      aria-label="Send follow-up"
                    >
                      <ArrowUp className="w-4 h-4 text-black" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Conflict Modal */}
      {started && openConflict && showConflictModal && (
        <ConflictModal
          conflict={openConflict}
          onResolve={handleResolveConflict}
          onClose={() => setShowConflictModal(false)}
        />
      )}

      {/* Evidence Citation Drawer */}
      <EvidenceDrawer
        evidence={selectedEvidence}
        onClose={() => setSelectedEvidence(null)}
      />

      {/* Features & Guardrails Modal */}
      <FeaturesModal
        isOpen={featuresModalOpen}
        onClose={() => setFeaturesModalOpen(false)}
        selectedFeature={selectedFeature}
      />

      {/* Encrypted Document Ingestion & OCR Modal */}
      <DocumentUploadModal
        isOpen={uploadModalOpen}
        onClose={() => setUploadModalOpen(false)}
        onUploadSuccess={() => fetchWorkflow()}
      />
    </div>
  );
}
