'use client';

import React, { useEffect, useState, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowUp,
  Check,
  CheckCircle2,
  History,
  Loader2,
  PanelLeft,
  Pin,
  Paperclip,
  Globe,
  Search,
  ClipboardList,
  Cpu,
  Wrench,
  RotateCcw,
  Sparkles,
  ExternalLink,
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
import { MarkdownRenderer } from '@/components/MarkdownRenderer';
import { Evidence, WorkflowRun } from '@/lib/engine/types';
import { TEMPLATES } from '@/lib/engine/fixtures';
import { apiFetch } from '@/lib/session/client';

export const AVAILABLE_TOOLS = [
  { id: 'employment_agent', name: 'Employment Domain Agent', desc: 'Offer letters, internships, college NOC & HR onboarding' },
  { id: 'hardware_agent', name: 'Hardware Procurement Agent', desc: 'Workstation specifications, IT equipment & tier approvals' },
  { id: 'healthcare_agent', name: 'Healthcare & Insurance Agent', desc: 'Medical reimbursement claims, hospital bills & diagnosis' },
  { id: 'payout_agent', name: 'Financial & Payout Agent', desc: 'Vendor banking details, IFSC/routing & invoice remittance' },
  { id: 'gov_agent', name: 'Civic & Government Agent', desc: 'Municipal clearances, residency proofs & permit applications' },
  { id: 'academic_agent', name: 'Academic Credential Agent', desc: 'University registrar records, degree certificates & transcripts' },
  { id: 'search_agent', name: 'Web Research & Discovery Agent', desc: 'Real-time internet search & regulatory fact-checking' },
  { id: 'forms_agent', name: 'Google Forms Automation Agent', desc: 'Google Forms schema parsing, field auto-fill & submission' }
];

export const AVAILABLE_MCP = [
  { id: 'vault_mcp', name: 'Personal Vault MCP', desc: 'Encrypted personal credentials & document storage' },
  { id: 'aws_bedrock_mcp', name: 'AWS Bedrock MCP', desc: 'Claude 3.5 Sonnet foundation model provider' },
  { id: 'hr_sandbox_mcp', name: 'Enterprise HR MCP', desc: 'GreytHR & Workday operational test sandbox' },
  { id: 'cedar_policy_mcp', name: 'Cedar Policy MCP', desc: 'Distributed authorization rules and schema store' },
  { id: 'gov_registry_mcp', name: 'Civic Registry MCP', desc: 'Municipal portal & citizen clearance gateway' }
];

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  template?: string;
  sources?: { title: string; url: string; snippet: string; sourceDomain: string }[];
  suggestions?: { title: string; prompt: string; template?: string }[];
}

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
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [featuresModalOpen, setFeaturesModalOpen] = useState(false);
  const [selectedFeature, setSelectedFeature] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [showConflictModal, setShowConflictModal] = useState(false);
  const [selectedEvidence, setSelectedEvidence] = useState<Evidence | null>(null);
  const [followUpText, setFollowUpText] = useState('');

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [messagesByRun, setMessagesByRun] = useState<Record<string, ChatMessage[]>>({});

  // Active run ID ref to completely prevent stale interval closures from redirecting chats
  const activeRunIdRef = useRef<string | null>(null);

  // Chatbox In-Memory File Attachment & OCR states
  const [uploadedFiles, setUploadedFiles] = useState<{ id: string; name: string; size: number; fingerprint: string; extractedCount: number }[]>([]);
  const [isUploadingInChat, setIsUploadingInChat] = useState(false);

  // Chatbox Search & Form Filling toggles
  const [enableSearch, setEnableSearch] = useState(false);
  const [enableFormFill, setEnableFormFill] = useState(false);

  // Tools & MCP state with selection menus - initialized to Domain Agents
  const [selectedTools, setSelectedTools] = useState<string[]>(
    AVAILABLE_TOOLS.map((t) => t.id)
  );
  const [selectedMcp, setSelectedMcp] = useState<string[]>([
    'vault_mcp', 'aws_bedrock_mcp', 'hr_sandbox_mcp'
  ]);
  const [toolsMenuOpen, setToolsMenuOpen] = useState(false);
  const [mcpMenuOpen, setMcpMenuOpen] = useState(false);
  const [searchMenuOpen, setSearchMenuOpen] = useState(false);
  const [formFillMenuOpen, setFormFillMenuOpen] = useState(false);

  const [dockedToolsMenuOpen, setDockedToolsMenuOpen] = useState(false);
  const [dockedMcpMenuOpen, setDockedMcpMenuOpen] = useState(false);
  const [dockedSearchMenuOpen, setDockedSearchMenuOpen] = useState(false);
  const [dockedFormFillMenuOpen, setDockedFormFillMenuOpen] = useState(false);

  const landingFileInputRef = React.useRef<HTMLInputElement>(null);
  const followUpFileInputRef = React.useRef<HTMLInputElement>(null);

  const toggleTool = (toolId: string) => {
    setSelectedTools((prev) =>
      prev.includes(toolId) ? prev.filter((id) => id !== toolId) : [...prev, toolId]
    );
  };

  const toggleAllTools = () => {
    if (selectedTools.length === AVAILABLE_TOOLS.length) {
      setSelectedTools([]);
    } else {
      setSelectedTools(AVAILABLE_TOOLS.map((t) => t.id));
    }
  };

  const toggleMcp = (mcpId: string) => {
    setSelectedMcp((prev) =>
      prev.includes(mcpId) ? prev.filter((id) => id !== mcpId) : [...prev, mcpId]
    );
  };

  const toggleAllMcp = () => {
    if (selectedMcp.length === AVAILABLE_MCP.length) {
      setSelectedMcp([]);
    } else {
      setSelectedMcp(AVAILABLE_MCP.map((m) => m.id));
    }
  };

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
        const savedActiveRun = sessionStorage.getItem('eva_active_run');
        if (savedActiveRun) {
          activeRunIdRef.current = savedActiveRun;
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
        const res = await apiFetch('/api/v1/vault/upload', {
          method: 'POST',
          body: formData
        });
        if (res.ok) {
          const data = await res.json();
          const docId = data.document?.documentId || data.document?.id || `upload_${Date.now()}_${i}_${Math.random().toString(36).substring(2, 6)}`;
          setUploadedFiles((prev) => [
            ...prev,
            {
              id: docId,
              name: file.name,
              size: file.size,
              fingerprint: data.document?.sha256Fingerprint?.slice(0, 8) || docId.slice(0, 8),
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
  const fetchWorkflow = async (explicitRunId?: string) => {
    try {
      // 1. Fetch active workflow scoped to current selection or session
      const targetId = explicitRunId || activeRunIdRef.current || (sessionRunIds.length > 0 ? sessionRunIds[0] : null);

      if (targetId) {
        const res = await apiFetch(`/api/v1/workflows/${targetId}`);
        if (res.ok) {
          const data: WorkflowRun | null = await res.json();
          if (data && data.workflowRunId) {
            setWorkflow(data);
            activeRunIdRef.current = data.workflowRunId;
            if (typeof window !== 'undefined') {
              sessionStorage.setItem('eva_active_run', data.workflowRunId);
            }
            if (data.intent && !promptText && typeof window !== 'undefined' && sessionStorage.getItem('eva_started') === 'true') {
              setPromptText(data.intent);
            }
          } else {
            setWorkflow(null);
          }
        }
      } else {
        if (typeof window !== 'undefined' && sessionStorage.getItem('eva_started') !== 'true') {
          setWorkflow(null);
        }
      }

      // 2. Fetch list of all workflows for sidebar
      const listRes = await apiFetch('/api/v1/workflows?all=true');
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
    fetchWorkflow(activeRunIdRef.current || undefined);
    const interval = setInterval(() => {
      fetchWorkflow(activeRunIdRef.current || undefined);
    }, 3500);
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

      const userMsg: ChatMessage = {
        id: `msg_u_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        role: 'user',
        content: prompt,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setChatMessages((prev) => [...prev, userMsg]);

      // Check if internet search should be triggered
      const lower = prompt.toLowerCase();
      const isSearch =
        enableSearch ||
        templateId === 'web_search_research' ||
        lower.startsWith('search') ||
        lower.includes('search web') ||
        lower.includes('search internet') ||
        lower.includes('search the web') ||
        lower.includes('google search') ||
        lower.includes('look up online');

      let searchSources: any[] | undefined = undefined;
      let searchSummary: string | undefined = undefined;

      if (isSearch) {
        try {
          const sRes = await apiFetch('/api/v1/search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: prompt })
          });
          if (sRes.ok) {
            const sData = await sRes.json();
            searchSources = sData.results;
            searchSummary = sData.summary;
          }
        } catch (sErr) {
          console.warn('Search query failed:', sErr);
        }
      }

      // Check if Google Forms intent
      const isGoogleForms =
        enableFormFill ||
        templateId === 'google_forms_fill' ||
        lower.includes('google form') ||
        lower.includes('forms.gle') ||
        lower.includes('docs.google.com/forms') ||
        lower.includes('fill form') ||
        lower.includes('fill google form');

      const resolvedTemplate =
        templateId || (isGoogleForms ? 'google_forms_fill' : (isSearch ? 'web_search_research' : undefined));

      const res = await apiFetch('/api/v1/workflows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          intent: prompt,
          template: resolvedTemplate,
          userId: 'usr_eva_admin',
          enableSearch: isSearch,
          enableFormFill: isGoogleForms,
          enableMcp: selectedMcp.length > 0,
          enableTools: selectedTools.length > 0,
          selectedTools,
          selectedMcp,
          attachedDocumentIds: uploadedFiles.map((f) => f.id)
        })
      });

      if (res.ok) {
        const data: WorkflowRun = await res.json();
        if (data && data.workflowRunId) {
          setWorkflow(data);

          const assistantMsg: ChatMessage = {
            id: `msg_a_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            role: 'assistant',
            content: searchSummary || data.agentResponse || 'Workflow initialized.',
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            sources: searchSources,
            suggestions: data.suggestions
          };

          setChatMessages((prev) => {
            const updated = [...prev, assistantMsg];
            setMessagesByRun((m) => ({ ...m, [data.workflowRunId]: updated }));
            return updated;
          });

          // Record into this session's workflow runs
          activeRunIdRef.current = data.workflowRunId;
          if (typeof window !== 'undefined') {
            sessionStorage.setItem('eva_active_run', data.workflowRunId);
          }
          setSessionRunIds((prev) => {
            const updated = prev.includes(data.workflowRunId) ? prev : [data.workflowRunId, ...prev];
            if (typeof window !== 'undefined') {
              sessionStorage.setItem('eva_session_runs', JSON.stringify(updated));
            }
            return updated;
          });

          await fetchWorkflow(data.workflowRunId);
          // Cinematic demo pause (750ms) before opening conflict card
          if (data.conflicts && data.conflicts.length > 0 && data.status === 'AWAITING_USER_RESOLUTION') {
            setTimeout(() => {
              setShowConflictModal(true);
            }, 750);
          }
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendFollowUp = async (text: string) => {
    if (!text.trim() || isLoading) return;
    const prompt = text.trim();
    setFollowUpText('');

    const lower = prompt.toLowerCase();
    const isSearchIntent =
      enableSearch ||
      lower.startsWith('search') ||
      lower.includes('search web') ||
      lower.includes('search the web') ||
      lower.includes('search internet') ||
      lower.includes('google search') ||
      lower.includes('look up online') ||
      lower.includes('find online');

    const isGoogleFormsIntent =
      enableFormFill ||
      lower.includes('google form') ||
      lower.includes('forms.gle') ||
      lower.includes('fill form') ||
      lower.includes('fill google form') ||
      lower.includes('docs.google.com/forms');

    await handleStartWorkflow(
      prompt,
      isGoogleFormsIntent ? 'google_forms_fill' : (isSearchIntent ? 'web_search_research' : undefined)
    );
  };

  const handleSelectWorkflow = async (runId: string) => {
    try {
      setIsLoading(true);
      activeRunIdRef.current = runId;
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('eva_active_run', runId);
        sessionStorage.setItem('eva_started', 'true');
      }
      const res = await apiFetch('/api/v1/workflows/active', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ runId })
      });

      if (res.ok) {
        const active: WorkflowRun = await res.json();
        setWorkflow(active);
        setPromptText(active.intent);
        setStarted(true);
        setShowConflictModal(false);

        setChatMessages((prev) => {
          if (messagesByRun[runId] && messagesByRun[runId].length > 0) {
            return messagesByRun[runId];
          }
          const restored: ChatMessage[] = [
            {
              id: `msg_u_${active.workflowRunId}`,
              role: 'user',
              content: active.intent,
              timestamp: new Date(active.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            },
            {
              id: `msg_a_${active.workflowRunId}`,
              role: 'assistant',
              content: active.agentResponse || 'Workflow loaded.',
              timestamp: new Date(active.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              suggestions: active.suggestions
            }
          ];
          setMessagesByRun((m) => ({ ...m, [runId]: restored }));
          return restored;
        });

        if (active.conflicts && active.conflicts.some((c) => c.status === 'open') && active.status === 'AWAITING_USER_RESOLUTION') {
          setTimeout(() => {
            setShowConflictModal(true);
          }, 400);
        }
        await fetchWorkflow(runId);
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
    activeRunIdRef.current = null;
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('eva_started');
      sessionStorage.removeItem('eva_active_run');
    }
    setStarted(false);
    setWorkflow(null);
    setPromptText('');
    setChatMessages([]);
    setShowConflictModal(false);
    setActiveTab('Answer');
  };

  const handleDeleteWorkflow = (runId: string) => {
    if (activeRunIdRef.current === runId) {
      activeRunIdRef.current = null;
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('eva_active_run');
      }
    }
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
    const conflict = workflow.conflicts?.find((c) => c.status === 'open') || workflow.conflicts?.[0];
    if (!conflict) return;

    try {
      setIsLoading(true);
      const res = await apiFetch(`/api/v1/workflows/${workflow.workflowRunId}/conflicts/${conflict.conflictId}/resolve`, {
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
        if (updated.agentResponse) {
          const resMsg: ChatMessage = {
            id: `msg_a_res_${Date.now()}`,
            role: 'assistant',
            content: updated.agentResponse,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          };
          setChatMessages((prev) => {
            const u = [...prev, resMsg];
            if (activeRunIdRef.current) {
              setMessagesByRun((m) => ({ ...m, [activeRunIdRef.current!]: u }));
            }
            return u;
          });
        }
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
      const res = await apiFetch(`/api/v1/workflows/${workflow.workflowRunId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision: 'APPROVE', notes: 'Verified via evidence drawer & human sign-off', nonce: workflow.approvalChallenge?.nonce })
      });

      if (res.ok) {
        const updated = await res.json();
        setWorkflow(updated);
        if (updated.agentResponse) {
          const apprMsg: ChatMessage = {
            id: `msg_a_appr_${Date.now()}`,
            role: 'assistant',
            content: updated.agentResponse,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          };
          setChatMessages((prev) => {
            const u = [...prev, apprMsg];
            if (activeRunIdRef.current) {
              setMessagesByRun((m) => ({ ...m, [activeRunIdRef.current!]: u }));
            }
            return u;
          });
        }
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
        sessionStorage.removeItem('eva_started');
      }
      const res = await apiFetch(`/api/v1/workflows/${workflow?.workflowRunId || 'run_demo_01'}/reset`, { method: 'POST' });
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
    const ev = workflow.evidence?.find((e) => e.evidenceId === evidenceId);
    if (ev) {
      setSelectedEvidence(ev);
    }
  };

  const openConflict = workflow?.conflicts?.find((c) => c.status === 'open');
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
                    {uploadedFiles.map((f, idx) => (
                      <span
                        key={f.id || `landing_att_${idx}_${f.name}`}
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
                  placeholder={
                    enableFormFill
                      ? "Paste Google Form or Web Form URL (e.g. https://docs.google.com/forms/...) to auto-fill..."
                      : enableSearch
                      ? "Search the web for real-time intelligence, policies, or facts..."
                      : "Ask EVA anything or paste a Google Form link to auto-fill..."
                  }
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
                    {/* 1. Attach */}
                    <button
                      type="button"
                      onClick={() => landingFileInputRef.current?.click()}
                      disabled={isUploadingInChat}
                      className={`capsule-pill ${uploadedFiles.length > 0 ? 'active' : ''}`}
                      title="Upload & Attach Document (In-Memory OCR)"
                      aria-label="Attach document"
                    >
                      <Pin className="w-3.5 h-3.5" />
                      <span className="text-xs">Attach</span>
                      {uploadedFiles.length > 0 && (
                        <span className="pill-counter">({uploadedFiles.length})</span>
                      )}
                    </button>

                    {/* 2. Search */}
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => {
                          const next = !enableSearch;
                          setEnableSearch(next);
                          if (next) {
                            setEnableFormFill(false);
                            setSearchMenuOpen(true);
                          } else {
                            setSearchMenuOpen(false);
                          }
                          setFormFillMenuOpen(false);
                          setMcpMenuOpen(false);
                          setToolsMenuOpen(false);
                        }}
                        className={`capsule-pill ${enableSearch ? 'active' : ''}`}
                        title="Toggle Grounded Web Search"
                        aria-label="Toggle grounded search"
                      >
                        <Globe className="w-3.5 h-3.5" />
                        <span className="text-xs">Search</span>
                      </button>

                      {searchMenuOpen && (
                        <div className="popover-menu-container bottom-full mb-2.5 left-0 w-80 z-[60]">
                          <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/10">
                            <div className="flex items-center gap-1.5">
                              <Globe className="w-3.5 h-3.5 text-[#38bdf8]" />
                              <span className="text-xs font-medium text-white">Web Intelligence Search</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => {
                                  const next = !enableSearch;
                                  setEnableSearch(next);
                                  if (next) setEnableFormFill(false);
                                }}
                                className={`text-[10px] font-mono px-1.5 py-0.5 rounded border transition ${
                                  enableSearch
                                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 font-medium'
                                    : 'bg-white/5 text-white/50 border-white/10 hover:text-white'
                                }`}
                              >
                                {enableSearch ? 'Active' : 'Disabled'}
                              </button>
                              <button
                                type="button"
                                onClick={() => setSearchMenuOpen(false)}
                                className="text-white/40 hover:text-white p-0.5 transition"
                                aria-label="Close search menu"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          </div>

                          <p className="text-[11px] text-white/60 leading-tight mb-2.5">
                            Ground answers with real-time web research, regulatory benchmarks & live facts.
                          </p>

                          <div className="space-y-1 mb-2.5">
                            <div className="text-[10px] font-mono uppercase tracking-wider text-white/40">Quick Search Queries</div>
                            {[
                              'Remote engineering equipment stipend benchmarks in 2026',
                              'Corporate travel per diem and accommodation guidelines',
                              'Cedar distributed policy authorization syntax examples'
                            ].map((q, idx) => (
                              <button
                                key={idx}
                                type="button"
                                onClick={() => {
                                  setPromptText(q);
                                  setEnableSearch(true);
                                  setEnableFormFill(false);
                                  setSearchMenuOpen(false);
                                }}
                                className="w-full text-left p-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/15 text-[11px] text-white/80 hover:text-white transition flex items-center gap-2 group"
                              >
                                <Search className="w-3 h-3 text-[#38bdf8] shrink-0 group-hover:scale-110 transition" />
                                <span className="truncate">{q}</span>
                              </button>
                            ))}
                          </div>

                          <div className="flex items-center justify-between pt-2 border-t border-white/10 text-[10px] font-mono text-white/40">
                            <span>Live Web Grounding</span>
                            <span>Search Agent Active</span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* 3. Form Fill */}
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => {
                          const next = !enableFormFill;
                          setEnableFormFill(next);
                          if (next) {
                            setEnableSearch(false);
                            setFormFillMenuOpen(true);
                          } else {
                            setFormFillMenuOpen(false);
                          }
                          setSearchMenuOpen(false);
                          setMcpMenuOpen(false);
                          setToolsMenuOpen(false);
                        }}
                        className={`capsule-pill ${enableFormFill ? 'active' : ''}`}
                        title="Toggle Autonomous Form Filling"
                        aria-label="Toggle autonomous form filling"
                      >
                        <ClipboardList className="w-3.5 h-3.5" />
                        <span className="text-xs">Form Fill</span>
                      </button>

                      {formFillMenuOpen && (
                        <div className="popover-menu-container bottom-full mb-2.5 left-0 w-80 z-[60]">
                          <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/10">
                            <div className="flex items-center gap-1.5">
                              <ClipboardList className="w-3.5 h-3.5 text-[#a78bfa]" />
                              <span className="text-xs font-medium text-white">Autonomous Form Fill</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => {
                                  const next = !enableFormFill;
                                  setEnableFormFill(next);
                                  if (next) setEnableSearch(false);
                                }}
                                className={`text-[10px] font-mono px-1.5 py-0.5 rounded border transition ${
                                  enableFormFill
                                    ? 'bg-purple-500/20 text-purple-300 border-purple-500/40 font-medium'
                                    : 'bg-white/5 text-white/50 border-white/10 hover:text-white'
                                }`}
                              >
                                {enableFormFill ? 'Active' : 'Disabled'}
                              </button>
                              <button
                                type="button"
                                onClick={() => setFormFillMenuOpen(false)}
                                className="text-white/40 hover:text-white p-0.5 transition"
                                aria-label="Close form fill menu"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          </div>

                          <p className="text-[11px] text-white/60 leading-tight mb-2.5">
                            Paste any Google Form link into the prompt. EVA inspects fields, grounds facts from your vault, and completes submission.
                          </p>

                          <div className="space-y-1 mb-2.5">
                            <div className="text-[10px] font-mono uppercase tracking-wider text-white/40">Quick Sample Form</div>
                            <button
                              type="button"
                              onClick={() => {
                                setPromptText('https://docs.google.com/forms/d/e/1FAIpQLSc_application_demo/viewform fill this form for me');
                                setEnableFormFill(true);
                                setEnableSearch(false);
                                setFormFillMenuOpen(false);
                              }}
                              className="w-full text-left p-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/15 text-[11px] text-white/80 hover:text-white transition flex items-center gap-2 group"
                            >
                              <ClipboardList className="w-3.5 h-3.5 text-[#a78bfa] shrink-0 group-hover:scale-110 transition" />
                              <div className="min-w-0">
                                <div className="font-medium text-white">Fill Google Form Demo</div>
                                <div className="text-[10px] text-white/40 font-mono truncate">docs.google.com/forms/...</div>
                              </div>
                            </button>
                          </div>

                          <div className="flex items-center justify-between pt-2 border-t border-white/10 text-[10px] font-mono text-white/40">
                            <span>Google Forms & Web Forms</span>
                            <span>Playwright Engine</span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* 4. MCP Menu Toggle */}
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => {
                          setMcpMenuOpen(!mcpMenuOpen);
                          setToolsMenuOpen(false);
                          setSearchMenuOpen(false);
                          setFormFillMenuOpen(false);
                        }}
                        className={`capsule-pill ${selectedMcp.length > 0 ? 'active' : ''}`}
                        title="Configure Model Context Protocol (MCP)"
                        aria-label="Toggle MCP menu"
                      >
                        <Cpu className="w-3.5 h-3.5" />
                        <span className="text-xs">MCP</span>
                        {selectedMcp.length > 0 && (
                          <span className="pill-counter">({selectedMcp.length})</span>
                        )}
                      </button>

                      {mcpMenuOpen && (
                        <div className="popover-menu-container bottom-full mb-2.5 left-0 z-[60]">
                          <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/10">
                            <div className="flex items-center gap-1.5">
                              <Cpu className="w-3.5 h-3.5 text-white/70" />
                              <span className="text-xs font-medium text-white">MCP Connectors</span>
                              <span className="text-[10px] font-mono text-white/40">({selectedMcp.length}/{AVAILABLE_MCP.length})</span>
                            </div>
                            <button
                              type="button"
                              onClick={toggleAllMcp}
                              className="text-[10px] font-mono text-white/60 hover:text-white transition px-1.5 py-0.5 rounded bg-white/5 hover:bg-white/10 border border-white/10"
                            >
                              {selectedMcp.length === AVAILABLE_MCP.length ? 'Clear' : 'All'}
                            </button>
                          </div>
                          <div className="space-y-1">
                            {AVAILABLE_MCP.map((m) => {
                              const isChecked = selectedMcp.includes(m.id);
                              return (
                                <div
                                  key={m.id}
                                  onClick={() => toggleMcp(m.id)}
                                  className="flex items-start gap-2.5 p-1.5 rounded-lg hover:bg-white/5 cursor-pointer transition select-none group"
                                >
                                  <div className={`mt-0.5 w-3.5 h-3.5 rounded border flex items-center justify-center transition shrink-0 ${isChecked ? 'bg-white border-white text-black' : 'border-white/30 group-hover:border-white/60'}`}>
                                    {isChecked && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <div className="text-xs font-medium text-white">{m.name}</div>
                                    <p className="text-[10px] text-white/50 leading-tight mt-0.5">{m.desc}</p>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* 5. Tools Menu Toggle */}
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => {
                          setToolsMenuOpen(!toolsMenuOpen);
                          setMcpMenuOpen(false);
                          setSearchMenuOpen(false);
                          setFormFillMenuOpen(false);
                        }}
                        className={`capsule-pill ${selectedTools.length > 0 ? 'active' : ''}`}
                        title="Configure Domain Agents"
                        aria-label="Toggle Domain Agents menu"
                      >
                        <Wrench className="w-3.5 h-3.5" />
                        <span className="text-xs">Domain Agents</span>
                        {selectedTools.length > 0 && (
                          <span className="pill-counter">({selectedTools.length})</span>
                        )}
                      </button>

                      {toolsMenuOpen && (
                        <div className="popover-menu-container bottom-full mb-2.5 left-0 z-[60]">
                          <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/10">
                            <div className="flex items-center gap-1.5">
                              <Wrench className="w-3.5 h-3.5 text-white/70" />
                              <span className="text-xs font-medium text-white">Domain Agents</span>
                              <span className="text-[10px] font-mono text-white/40">({selectedTools.length}/{AVAILABLE_TOOLS.length})</span>
                            </div>
                            <button
                              type="button"
                              onClick={toggleAllTools}
                              className="text-[10px] font-mono text-white/60 hover:text-white transition px-1.5 py-0.5 rounded bg-white/5 hover:bg-white/10 border border-white/10"
                            >
                              {selectedTools.length === AVAILABLE_TOOLS.length ? 'Clear' : 'All'}
                            </button>
                          </div>
                          <div className="space-y-1">
                            {AVAILABLE_TOOLS.map((t) => {
                              const isChecked = selectedTools.includes(t.id);
                              return (
                                <div
                                  key={t.id}
                                  onClick={() => toggleTool(t.id)}
                                  className="flex items-start gap-2.5 p-1.5 rounded-lg hover:bg-white/5 cursor-pointer transition select-none group"
                                >
                                  <div className={`mt-0.5 w-3.5 h-3.5 rounded border flex items-center justify-center transition shrink-0 ${isChecked ? 'bg-white border-white text-black' : 'border-white/30 group-hover:border-white/60'}`}>
                                    {isChecked && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <div className="text-xs font-medium text-white">{t.name}</div>
                                    <p className="text-[10px] text-white/50 leading-tight mt-0.5">{t.desc}</p>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
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
                Evidence before action · Dynamic Form Filing · AWS Serverless · 16 Shooting Stars
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
                    {workflow && workflow.template !== 'conversational' && (
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

                    {/* Chat Conversation Stream */}
                    <div className="space-y-4 mb-4">
                      {chatMessages.length > 0 ? (
                        chatMessages.map((msg) => (
                          <React.Fragment key={msg.id}>
                            {msg.role === 'user' ? (
                              <div className="user-query-bubble">
                                {msg.content}
                              </div>
                            ) : (
                              <div className="eva-response-card">
                                <div className="eva-response-header">
                                  <div className="w-5 h-5 rounded bg-white/10 border border-white/20 flex items-center justify-center p-0.5">
                                    <img src="/logo.svg" alt="EVA" className="w-3.5 h-3.5 object-contain" />
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-xs font-semibold text-white tracking-wide">EVA</span>
                                    <span className="text-[10px] font-mono text-white/50 px-1.5 py-0.5 rounded bg-white/5 border border-white/10">
                                      {msg.sources && msg.sources.length > 0
                                        ? 'web research agent'
                                        : workflow?.template === 'google_forms_fill'
                                        ? 'forms automation agent'
                                        : (workflow?.template === 'conversational'
                                        ? 'orchestrator'
                                        : (workflow?.category ? `${workflow.category} agent` : 'agent'))}
                                    </span>
                                  </div>
                                  <span className="ml-auto text-[10px] font-mono text-white/40">{msg.timestamp}</span>
                                </div>

                                <div className="eva-response-body">
                                  <MarkdownRenderer content={msg.content} />
                                </div>

                                {/* Web Research Sources Grid if present */}
                                {msg.sources && msg.sources.length > 0 && (
                                  <div className="mt-3 pt-3 border-t border-white/10">
                                    <div className="flex items-center gap-1.5 text-[11px] font-mono text-white/60 mb-2">
                                      <Globe className="w-3 h-3 text-white/70" />
                                      <span>Verified Web Sources ({msg.sources.length})</span>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                      {msg.sources.map((src, i) => (
                                        <a
                                          key={i}
                                          href={src.url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="p-2.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 transition block group text-left"
                                        >
                                          <div className="text-xs font-medium text-white/90 group-hover:text-white truncate">
                                            {src.title}
                                          </div>
                                          <div className="text-[10px] text-white/50 font-mono mt-0.5 flex items-center gap-1 truncate">
                                            <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                                            <span>{src.sourceDomain}</span>
                                          </div>
                                        </a>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {/* Interactive Suggestion Chips */}
                                {msg.suggestions && msg.suggestions.length > 0 && (
                                  <div className="mt-3.5 pt-3 border-t border-white/10 flex flex-wrap gap-2">
                                    {msg.suggestions.map((sug, i) => (
                                      <button
                                        key={i}
                                        type="button"
                                        onClick={() => handleStartWorkflow(sug.prompt, sug.template)}
                                        className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/15 text-xs text-white/90 hover:text-white transition flex items-center gap-1.5 group"
                                      >
                                        <span>{sug.title}</span>
                                        <ArrowUp className="w-3 h-3 text-white/40 group-hover:text-white group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition" />
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                          </React.Fragment>
                        ))
                      ) : (
                        <>
                          {/* Fallback Single Prompt / Agent Card */}
                          <div className="user-query-bubble">
                            {promptText || workflow?.intent || 'Administrative Operation'}
                          </div>

                          {workflow?.agentResponse && (
                            <div className="eva-response-card">
                              <div className="eva-response-header">
                                <div className="w-5 h-5 rounded bg-white/10 border border-white/20 flex items-center justify-center p-0.5">
                                  <img src="/logo.svg" alt="EVA" className="w-3.5 h-3.5 object-contain" />
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <span className="text-xs font-semibold text-white tracking-wide">EVA</span>
                                  <span className="text-[10px] font-mono text-white/50 px-1.5 py-0.5 rounded bg-white/5 border border-white/10">
                                    {workflow.template === 'conversational' ? 'orchestrator' : (workflow.category ? `${workflow.category} agent` : 'agent')}
                                  </span>
                                </div>
                              </div>

                              <div className="eva-response-body">
                                <MarkdownRenderer content={workflow.agentResponse} />
                              </div>

                              {workflow.suggestions && workflow.suggestions.length > 0 && (
                                <div className="mt-3.5 pt-3 border-t border-white/10 flex flex-wrap gap-2">
                                  {workflow.suggestions.map((sug, i) => (
                                    <button
                                      key={i}
                                      type="button"
                                      onClick={() => handleStartWorkflow(sug.prompt, sug.template)}
                                      className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/15 text-xs text-white/90 hover:text-white transition flex items-center gap-1.5 group"
                                    >
                                      <span>{sug.title}</span>
                                      <ArrowUp className="w-3 h-3 text-white/40 group-hover:text-white group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition" />
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </>
                      )}
                    </div>

                    {/* Agent Thinking Progress Disclosure with 8-Phase Stepper */}
                    {workflow?.template !== 'conversational' && (
                      <AgentProgress
                        status={workflow?.status || 'PLANNING'}
                        hasOpenConflict={Boolean(openConflict)}
                        isHumanApproved={workflow?.status === 'COMPLETED'}
                        fieldsCount={workflow?.formFields?.length || 0}
                        isExecuting={isLoading}
                        plan={workflow?.plan}
                        stepIndex={workflow?.stepIndex}
                        evidence={workflow?.evidence}
                        conflicts={workflow?.conflicts}
                        template={workflow?.template}
                        targetSystem={workflow?.targetSystem}
                      />
                    )}

                    {/* Conflict Notice if modal is closed */}
                    {openConflict && !showConflictModal && workflow?.template !== 'conversational' && (
                      <div className="p-3.5 rounded-xl border border-white/20 bg-white/5 mb-4 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                          <span className="text-white/90 font-mono">
                            {openConflict.field?.replace(/_/g, ' ') || 'field'} conflict pending:{' '}
                            {openConflict.candidateEvidence?.map((e) => e.value).join(' vs. ') || ''}
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
                    {workflow && (workflow.formFields?.length ?? 0) > 0 && (
                      <MockFormExecution
                        fields={workflow.formFields}
                        onInspectEvidence={handleInspectEvidence}
                        isSubmitting={isLoading}
                        isHumanApproved={workflow.status === 'COMPLETED'}
                        targetSystem={workflow.targetSystem}
                        title={workflow.title ? `${workflow.title} Form` : undefined}
                      />
                    )}

                    {/* Live Cedar Inspector Card */}
                    {latestCedar && <CedarInspector decision={latestCedar} />}

                    {/* Causal Explainability */}
                    {workflow?.latestExplanation && workflow.template !== 'conversational' && (
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

                    {/* Workflow Complete Banner (only for operational workflows, not conversational discovery) */}
                    {workflow?.status === 'COMPLETED' && workflow.template !== 'conversational' && (
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
                      {uploadedFiles.map((f, idx) => (
                        <span
                          key={f.id || `docked_att_${idx}_${f.name}`}
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
                    <input
                      type="text"
                      value={followUpText}
                      onChange={(e) => setFollowUpText(e.target.value)}
                      placeholder={
                        enableFormFill
                          ? "Paste Google Form or Web Form URL to auto-fill..."
                          : enableSearch
                          ? "Search the web for real-time intelligence, policies, or facts..."
                          : "Reply to EVA, ask follow-up, search web, or give instructions..."
                      }
                      className="bottom-input"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && followUpText.trim() && !isLoading) {
                          handleSendFollowUp(followUpText);
                        }
                      }}
                    />

                    <button
                      type="button"
                      onClick={() => {
                        if (followUpText.trim() && !isLoading) {
                          handleSendFollowUp(followUpText);
                        }
                      }}
                      disabled={!followUpText.trim() || isLoading}
                      className="action-circle-btn shrink-0"
                      aria-label="Send message"
                    >
                      {isLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin text-black" />
                      ) : (
                        <ArrowUp className="w-4 h-4 text-black" />
                      )}
                    </button>
                  </div>

                  {/* Docked Pills Row - Exact 5 buttons matching Landing View */}
                  <div className="capsule-pills-left flex flex-wrap items-center gap-1.5 pt-1.5 border-t border-white/5">
                    {/* 1. Attach */}
                    <button
                      type="button"
                      onClick={() => followUpFileInputRef.current?.click()}
                      disabled={isUploadingInChat}
                      className={`capsule-pill ${uploadedFiles.length > 0 ? 'active' : ''}`}
                      title="Upload & Attach Document (In-Memory OCR)"
                      aria-label="Attach document"
                    >
                      <Pin className="w-3.5 h-3.5" />
                      <span className="text-xs">Attach</span>
                      {uploadedFiles.length > 0 && (
                        <span className="pill-counter">({uploadedFiles.length})</span>
                      )}
                    </button>

                    {/* 2. Search */}
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => {
                          const next = !enableSearch;
                          setEnableSearch(next);
                          if (next) {
                            setEnableFormFill(false);
                            setDockedSearchMenuOpen(true);
                          } else {
                            setDockedSearchMenuOpen(false);
                          }
                          setDockedFormFillMenuOpen(false);
                          setDockedMcpMenuOpen(false);
                          setDockedToolsMenuOpen(false);
                        }}
                        className={`capsule-pill ${enableSearch ? 'active' : ''}`}
                        title="Toggle Grounded Web Search"
                        aria-label="Toggle grounded search"
                      >
                        <Globe className="w-3.5 h-3.5" />
                        <span className="text-xs">Search</span>
                      </button>

                      {dockedSearchMenuOpen && (
                        <div className="popover-menu-container bottom-full mb-2.5 left-0 w-80 z-[60]">
                          <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/10">
                            <div className="flex items-center gap-1.5">
                              <Globe className="w-3.5 h-3.5 text-[#38bdf8]" />
                              <span className="text-xs font-medium text-white">Web Intelligence Search</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => {
                                  const next = !enableSearch;
                                  setEnableSearch(next);
                                  if (next) setEnableFormFill(false);
                                }}
                                className={`text-[10px] font-mono px-1.5 py-0.5 rounded border transition ${
                                  enableSearch
                                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 font-medium'
                                    : 'bg-white/5 text-white/50 border-white/10 hover:text-white'
                                }`}
                              >
                                {enableSearch ? 'Active' : 'Disabled'}
                              </button>
                              <button
                                type="button"
                                onClick={() => setDockedSearchMenuOpen(false)}
                                className="text-white/40 hover:text-white p-0.5 transition"
                                aria-label="Close search menu"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          </div>

                          <p className="text-[11px] text-white/60 leading-tight mb-2.5">
                            Ground answers with real-time web research, regulatory benchmarks & live facts.
                          </p>

                          <div className="space-y-1 mb-2.5">
                            <div className="text-[10px] font-mono uppercase tracking-wider text-white/40">Quick Search Queries</div>
                            {[
                              'Remote engineering equipment stipend benchmarks in 2026',
                              'Corporate travel per diem and accommodation guidelines',
                              'Cedar distributed policy authorization syntax examples'
                            ].map((q, idx) => (
                              <button
                                key={idx}
                                type="button"
                                onClick={() => {
                                  setFollowUpText(q);
                                  setEnableSearch(true);
                                  setEnableFormFill(false);
                                  setDockedSearchMenuOpen(false);
                                }}
                                className="w-full text-left p-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/15 text-[11px] text-white/80 hover:text-white transition flex items-center gap-2 group"
                              >
                                <Search className="w-3 h-3 text-[#38bdf8] shrink-0 group-hover:scale-110 transition" />
                                <span className="truncate">{q}</span>
                              </button>
                            ))}
                          </div>

                          <div className="flex items-center justify-between pt-2 border-t border-white/10 text-[10px] font-mono text-white/40">
                            <span>Live Web Grounding</span>
                            <span>Search Agent Active</span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* 3. Form Fill */}
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => {
                          const next = !enableFormFill;
                          setEnableFormFill(next);
                          if (next) {
                            setEnableSearch(false);
                            setDockedFormFillMenuOpen(true);
                          } else {
                            setDockedFormFillMenuOpen(false);
                          }
                          setDockedSearchMenuOpen(false);
                          setDockedMcpMenuOpen(false);
                          setDockedToolsMenuOpen(false);
                        }}
                        className={`capsule-pill ${enableFormFill ? 'active' : ''}`}
                        title="Toggle Autonomous Form Filling"
                        aria-label="Toggle autonomous form filling"
                      >
                        <ClipboardList className="w-3.5 h-3.5" />
                        <span className="text-xs">Form Fill</span>
                      </button>

                      {dockedFormFillMenuOpen && (
                        <div className="popover-menu-container bottom-full mb-2.5 left-0 w-80 z-[60]">
                          <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/10">
                            <div className="flex items-center gap-1.5">
                              <ClipboardList className="w-3.5 h-3.5 text-[#a78bfa]" />
                              <span className="text-xs font-medium text-white">Autonomous Form Fill</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => {
                                  const next = !enableFormFill;
                                  setEnableFormFill(next);
                                  if (next) setEnableSearch(false);
                                }}
                                className={`text-[10px] font-mono px-1.5 py-0.5 rounded border transition ${
                                  enableFormFill
                                    ? 'bg-purple-500/20 text-purple-300 border-purple-500/40 font-medium'
                                    : 'bg-white/5 text-white/50 border-white/10 hover:text-white'
                                }`}
                              >
                                {enableFormFill ? 'Active' : 'Disabled'}
                              </button>
                              <button
                                type="button"
                                onClick={() => setDockedFormFillMenuOpen(false)}
                                className="text-white/40 hover:text-white p-0.5 transition"
                                aria-label="Close form fill menu"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          </div>

                          <p className="text-[11px] text-white/60 leading-tight mb-2.5">
                            Paste any Google Form link into the prompt. EVA inspects fields, grounds facts from your vault, and completes submission.
                          </p>

                          <div className="space-y-1 mb-2.5">
                            <div className="text-[10px] font-mono uppercase tracking-wider text-white/40">Quick Sample Form</div>
                            <button
                              type="button"
                              onClick={() => {
                                setFollowUpText('https://docs.google.com/forms/d/e/1FAIpQLSc_application_demo/viewform fill this form for me');
                                setEnableFormFill(true);
                                setEnableSearch(false);
                                setDockedFormFillMenuOpen(false);
                              }}
                              className="w-full text-left p-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/15 text-[11px] text-white/80 hover:text-white transition flex items-center gap-2 group"
                            >
                              <ClipboardList className="w-3.5 h-3.5 text-[#a78bfa] shrink-0 group-hover:scale-110 transition" />
                              <div className="min-w-0">
                                <div className="font-medium text-white">Fill Google Form Demo</div>
                                <div className="text-[10px] text-white/40 font-mono truncate">docs.google.com/forms/...</div>
                              </div>
                            </button>
                          </div>

                          <div className="flex items-center justify-between pt-2 border-t border-white/10 text-[10px] font-mono text-white/40">
                            <span>Google Forms & Web Forms</span>
                            <span>Playwright Engine</span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* 4. MCP Menu Toggle */}
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => {
                          setDockedMcpMenuOpen(!dockedMcpMenuOpen);
                          setDockedToolsMenuOpen(false);
                          setDockedSearchMenuOpen(false);
                          setDockedFormFillMenuOpen(false);
                        }}
                        className={`capsule-pill ${selectedMcp.length > 0 ? 'active' : ''}`}
                        title="Configure Model Context Protocol (MCP)"
                        aria-label="Toggle MCP menu"
                      >
                        <Cpu className="w-3.5 h-3.5" />
                        <span className="text-xs">MCP</span>
                        {selectedMcp.length > 0 && (
                          <span className="pill-counter">({selectedMcp.length})</span>
                        )}
                      </button>

                      {dockedMcpMenuOpen && (
                        <div className="popover-menu-container bottom-full mb-2.5 left-0 z-[60]">
                          <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/10">
                            <div className="flex items-center gap-1.5">
                              <Cpu className="w-3.5 h-3.5 text-white/70" />
                              <span className="text-xs font-medium text-white">MCP Connectors</span>
                              <span className="text-[10px] font-mono text-white/40">({selectedMcp.length}/{AVAILABLE_MCP.length})</span>
                            </div>
                            <button
                              type="button"
                              onClick={toggleAllMcp}
                              className="text-[10px] font-mono text-white/60 hover:text-white transition px-1.5 py-0.5 rounded bg-white/5 hover:bg-white/10 border border-white/10"
                            >
                              {selectedMcp.length === AVAILABLE_MCP.length ? 'Clear' : 'All'}
                            </button>
                          </div>
                          <div className="space-y-1">
                            {AVAILABLE_MCP.map((m) => {
                              const isChecked = selectedMcp.includes(m.id);
                              return (
                                <div
                                  key={m.id}
                                  onClick={() => toggleMcp(m.id)}
                                  className="flex items-start gap-2.5 p-1.5 rounded-lg hover:bg-white/5 cursor-pointer transition select-none group"
                                >
                                  <div className={`mt-0.5 w-3.5 h-3.5 rounded border flex items-center justify-center transition shrink-0 ${isChecked ? 'bg-white border-white text-black' : 'border-white/30 group-hover:border-white/60'}`}>
                                    {isChecked && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <div className="text-xs font-medium text-white">{m.name}</div>
                                    <p className="text-[10px] text-white/50 leading-tight mt-0.5">{m.desc}</p>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* 5. Tools Menu Toggle */}
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => {
                          setDockedToolsMenuOpen(!dockedToolsMenuOpen);
                          setDockedMcpMenuOpen(false);
                          setDockedSearchMenuOpen(false);
                          setDockedFormFillMenuOpen(false);
                        }}
                        className={`capsule-pill ${selectedTools.length > 0 ? 'active' : ''}`}
                        title="Configure Domain Agents"
                        aria-label="Toggle Domain Agents menu"
                      >
                        <Wrench className="w-3.5 h-3.5" />
                        <span className="text-xs">Domain Agents</span>
                        {selectedTools.length > 0 && (
                          <span className="pill-counter">({selectedTools.length})</span>
                        )}
                      </button>

                      {dockedToolsMenuOpen && (
                        <div className="popover-menu-container bottom-full mb-2.5 left-0 z-[60]">
                          <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/10">
                            <div className="flex items-center gap-1.5">
                              <Wrench className="w-3.5 h-3.5 text-white/70" />
                              <span className="text-xs font-medium text-white">Domain Agents</span>
                              <span className="text-[10px] font-mono text-white/40">({selectedTools.length}/{AVAILABLE_TOOLS.length})</span>
                            </div>
                            <button
                              type="button"
                              onClick={toggleAllTools}
                              className="text-[10px] font-mono text-white/60 hover:text-white transition px-1.5 py-0.5 rounded bg-white/5 hover:bg-white/10 border border-white/10"
                            >
                              {selectedTools.length === AVAILABLE_TOOLS.length ? 'Clear' : 'All'}
                            </button>
                          </div>
                          <div className="space-y-1">
                            {AVAILABLE_TOOLS.map((t) => {
                              const isChecked = selectedTools.includes(t.id);
                              return (
                                <div
                                  key={t.id}
                                  onClick={() => toggleTool(t.id)}
                                  className="flex items-start gap-2.5 p-1.5 rounded-lg hover:bg-white/5 cursor-pointer transition select-none group"
                                >
                                  <div className={`mt-0.5 w-3.5 h-3.5 rounded border flex items-center justify-center transition shrink-0 ${isChecked ? 'bg-white border-white text-black' : 'border-white/30 group-hover:border-white/60'}`}>
                                    {isChecked && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <div className="text-xs font-medium text-white">{t.name}</div>
                                    <p className="text-[10px] text-white/50 leading-tight mt-0.5">{t.desc}</p>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Popover Backdrop for Outside Click Dismissal */}
      {(searchMenuOpen || formFillMenuOpen || mcpMenuOpen || toolsMenuOpen ||
        dockedSearchMenuOpen || dockedFormFillMenuOpen || dockedMcpMenuOpen || dockedToolsMenuOpen) && (
        <div
          className="fixed inset-0 z-50 bg-transparent"
          onClick={() => {
            setSearchMenuOpen(false);
            setFormFillMenuOpen(false);
            setMcpMenuOpen(false);
            setToolsMenuOpen(false);
            setDockedSearchMenuOpen(false);
            setDockedFormFillMenuOpen(false);
            setDockedMcpMenuOpen(false);
            setDockedToolsMenuOpen(false);
          }}
          aria-hidden="true"
        />
      )}

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
