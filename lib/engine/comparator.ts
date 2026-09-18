// NEXUS Deterministic Comparator & Normalization Engine
// PRINCIPLE: Zero LLM reliance for conflict detection. 100% deterministic code.

import { CanonicalField, Conflict, Evidence } from './types';

export const CITY_SYNONYMS: Record<string, string> = {
  'bengaluru': 'bangalore',
  'blr': 'bangalore',
  'bombay': 'mumbai',
  'bombaim': 'mumbai',
  'calcutta': 'kolkata',
  'madras': 'chennai',
  'poona': 'pune',
  'new delhi': 'delhi',
  'ncr': 'delhi'
};

export function normalizeFieldValue(field: CanonicalField, rawValue: string): string {
  if (!rawValue) return '';
  const cleaned = rawValue.trim().toLowerCase().replace(/\s+/g, ' ');

  if (field === 'work_location') {
    return CITY_SYNONYMS[cleaned] || cleaned;
  }

  return cleaned;
}

export interface ComparisonResult {
  conflicts: Conflict[];
  hasCriticalConflict: boolean;
  unresolvedCount: number;
}

export function detectConflicts(
  workflowRunId: string,
  evidenceList: Evidence[]
): ComparisonResult {
  const grouped = new Map<CanonicalField, Evidence[]>();

  for (const ev of evidenceList) {
    const existing = grouped.get(ev.field) || [];
    existing.push(ev);
    grouped.set(ev.field, existing);
  }

  const conflicts: Conflict[] = [];
  let hasCriticalConflict = false;

  for (const [field, records] of grouped.entries()) {
    if (records.length < 2) continue;

    // Compare normalized values
    const firstRecord = records[0];
    const normalizedA = normalizeFieldValue(field, firstRecord.value);
    const mismatchedRecord = records
      .slice(1)
      .find((r) => normalizeFieldValue(field, r.value) !== normalizedA);

    if (mismatchedRecord) {
      const isCritical = ['work_location', 'full_name', 'employer', 'start_date'].includes(field);
      const normalizedB = normalizeFieldValue(field, mismatchedRecord.value);

      const conflict: Conflict = {
        conflictId: `conf_${field}_${Date.now()}`,
        workflowRunId,
        field,
        candidateEvidence: records,
        severity: isCritical ? 'critical' : 'informational',
        status: 'open',
        selectedEvidenceId: null,
        resolvedBy: null,
        resolvedAt: null,
        comparatorAnalysis: {
          field,
          normalizedA,
          normalizedB,
          comparison: 'DIFFERENT',
          result: 'EXECUTION BLOCKED',
          reason: 'These documents contain incompatible values for the same canonical field. NEXUS will not choose one automatically.'
        }
      };

      conflicts.push(conflict);
      if (isCritical) {
        hasCriticalConflict = true;
      }
    }
  }

  return {
    conflicts,
    hasCriticalConflict,
    unresolvedCount: conflicts.filter((c) => c.status === 'open').length
  };
}
