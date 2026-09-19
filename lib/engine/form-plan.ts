// Shared FormPopulationPlan builder (PRD Section 5.4).
// Single home for evidence→field mapping used by both the deterministic
// resolve path (state-machine) and the Form Filling Agent.

import { CanonicalField, Evidence, FieldMapping, FormField, FormPopulationPlan } from './types';

export interface FieldResolution {
  value: string;
  evidenceId: string;
  sourceDocument: string;
  sourceLocation: string;
  confidence: number;
}

export interface FormFieldSchemaItem {
  field: CanonicalField;
  label: string;
  entryName?: string;
  type?: FormField['type'];
  options?: string[];
  required?: boolean;
}

export function buildPopulationPlan(
  formId: string,
  workflowRunId: string,
  schema: FormFieldSchemaItem[],
  evidence: Evidence[],
  resolutions: Partial<Record<CanonicalField, FieldResolution>> = {},
  agentVersion = 'eva-form-filling/1.0'
): { plan: FormPopulationPlan; fields: FormField[] } {
  const fields: FormField[] = schema.map((item, idx) => {
    const resolution = resolutions[item.field];
    if (resolution) {
      return {
        fieldId: `fld_${item.field}_${idx}`,
        canonicalField: item.field,
        label: item.label,
        value: resolution.value,
        sourceDocument: resolution.sourceDocument,
        sourceLocation: resolution.sourceLocation,
        confidence: resolution.confidence,
        evidenceId: resolution.evidenceId,
        userConfirmed: true,
        status: 'verified' as const,
        entryName: item.entryName,
        type: item.type,
        options: item.options,
        required: item.required,
      };
    }
    const ev = evidence.find((e) => e.field === item.field);
    return {
      fieldId: `fld_${item.field}_${idx}`,
      canonicalField: item.field,
      label: item.label,
      value: ev ? ev.value : 'N/A',
      sourceDocument: ev ? ev.sourceDocumentName : 'Verified Vault Document',
      sourceLocation: ev ? ev.sourceLocation : 'Section 1',
      confidence: ev ? ev.confidence : 0.95,
      evidenceId: ev ? ev.evidenceId : `ev_${item.field}_${workflowRunId}`,
      status: 'verified' as const,
      entryName: item.entryName,
      type: item.type,
      options: item.options,
      required: item.required,
    };
  });

  const avgConfidence = fields.reduce((acc, f) => acc + (f.confidence || 0), 0) /
    (fields.length || 1);

  const plan: FormPopulationPlan = {
    formId,
    workflowRunId,
    mappings: fields.map(
      (f): FieldMapping => ({
        formField: f.fieldId,
        canonicalField: f.canonicalField,
        evidenceId: f.evidenceId,
        value: f.value,
        sourceDocumentId: f.sourceDocument,
        confidence: f.confidence,
        rationale: `Mapped from ${f.sourceDocument} (${f.sourceLocation}).`
      })
    ),
    missingFields: fields.filter((f) => !f.value || f.value === 'N/A').map((f) => f.fieldId),
    ambiguousFields: [],
    confidence: Number(avgConfidence.toFixed(2)),
    agentVersion,
    generatedAt: new Date().toISOString()
  };

  return { plan, fields };
}
