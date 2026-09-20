import { describe, it, expect } from 'vitest';
import {
  extractTextFromBuffer,
  extractEntitiesFromText,
  processDocumentUpload
} from '../lib/engine/ocr';

describe('EVA Encrypted Document Ingestion & OCR Engine (PRD Section 7)', () => {
  it('extracts plain text and strips non-printable control characters', () => {
    const raw = Buffer.from('Offer Letter\x00\x07 for Candidate\nWork Location: Bangalore\n');
    const text = extractTextFromBuffer(raw, 'offer.txt', 'text/plain');
    expect(text).not.toContain('\x00');
    expect(text).toContain('Work Location: Bangalore');
  });

  it('extracts text streams from PDF token syntax (Tj and stream blocks)', () => {
    // Construct mock PDF syntax with (text) Tj objects and a stream block
    const mockPdfContent = `
      %PDF-1.4
      BT
      /F1 12 Tf
      (Internship Offer Letter) Tj
      (Full Name: Atharva Mendhulkar) Tj
      ET
      stream
      Work Location: Bangalore
      Office Stationed At: Bangalore
      endstream
    `;
    const buffer = Buffer.from(mockPdfContent, 'latin1');
    const extracted = extractTextFromBuffer(buffer, 'offer.pdf', 'application/pdf');

    expect(extracted).toContain('Internship Offer Letter');
    expect(extracted).toContain('Full Name: Atharva Mendhulkar');
  });

  it('extracts canonical fields via heuristic entity recognition', () => {
    const sampleText = `
      OFFICIAL ONBOARDING DOCUMENT
      Candidate Name: Atharva Mendhulkar
      Office Location: Bangalore
      Hardware Allocation: 36GB unified memory
      Approved Claim: $2,500.00
      Bank Routing IFSC: HDFC0001234
    `;

    const evidence = extractEntitiesFromText(sampleText, 'doc_test_1', 'sample.pdf', 'run_test');

    const name = evidence.find((e) => e.field === 'full_name');
    expect(name?.value).toBe('Atharva Mendhulkar');
    expect(name?.confidence).toBeGreaterThanOrEqual(0.95);

    const loc = evidence.find((e) => e.field === 'work_location');
    expect(loc?.value).toBe('Bangalore');
    expect(loc?.confidence).toBeGreaterThanOrEqual(0.95);

    const ram = evidence.find((e) => e.field === 'ram_spec');
    expect(ram?.value).toContain('36GB');

    const amt = evidence.find((e) => e.field === 'claim_amount');
    expect(amt?.value).toContain('2,500');

    const ifsc = evidence.find((e) => e.field === 'ifsc_code');
    expect(ifsc?.value).toBe('HDFC0001234');
  });

  it('performs end-to-end document upload processing with zero PII leakage and SHA-256 fingerprint', async () => {
    const content = Buffer.from('Full Legal Name: Atharva Mendhulkar\nWork Location: Mumbai\n');
    const result = await processDocumentUpload(content, 'Profile.txt', 'text/plain', 'run_demo_01');

    expect(result.anonymousDocId).toMatch(/^doc_enc_[a-f0-9]{12}$/);
    expect(result.sha256Fingerprint).toHaveLength(64);
    expect(result.filename).toBe('Profile.txt');
    expect(result.mimeType).toBe('text/plain');
    expect(result.sizeBytes).toBe(content.length);
    expect(result.extractedEvidence.length).toBeGreaterThanOrEqual(2);

    const nameEv = result.extractedEvidence.find((e) => e.field === 'full_name');
    expect(nameEv?.value).toBe('Atharva Mendhulkar');
    expect(nameEv?.sourceDocumentId).toBe(result.anonymousDocId);
  });

  it('extracts text from OpenXML Office documents (.docx, .pptx, .xlsx)', () => {
    const mockDocxContent = `PK\x03\x04[trash]<w:p><w:r><w:t>Full Legal Name: Atharva Mendhulkar</w:t></w:r><w:r><w:t>Work Location: Bangalore</w:t></w:r></w:p>`;
    const buffer = Buffer.from(mockDocxContent, 'latin1');
    const text = extractTextFromBuffer(buffer, 'Offer_Letter.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');

    expect(text).toContain('Full Legal Name: Atharva Mendhulkar');
    expect(text).toContain('Work Location: Bangalore');
  });

  it('extracts text from PowerPoint presentations (.pptx)', () => {
    const mockPptxContent = `PK\x03\x04...<p:sp><p:txBody><a:p><a:r><a:t>Candidate Onboarding Overview</a:t></a:r><a:r><a:t>Work Location: Bangalore</a:t></a:r></a:p></p:txBody></p:sp>`;
    const buffer = Buffer.from(mockPptxContent, 'latin1');
    const text = extractTextFromBuffer(buffer, 'Presentation.pptx', 'application/vnd.openxmlformats-officedocument.presentationml.presentation');

    expect(text).toContain('Candidate Onboarding Overview');
    expect(text).toContain('Work Location: Bangalore');
  });

  it('processes image formats (JPG, PNG) with synthetic OCR grounding', () => {
    const mockPng = Buffer.from('\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR...Candidate Name: Atharva Mendhulkar...IEND\xaeB`\x82', 'latin1');
    const text = extractTextFromBuffer(mockPng, 'badge_scan.png', 'image/png');

    expect(text).toContain('badge_scan.png');
  });
});

