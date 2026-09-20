# EVA Sample Documents & Domain Agent Testing Guide

This directory contains verified sample test documents covering all 6 domain agents and operational workflows in EVA. You can upload any of these files directly into your **Personal Vault** or attach them to your chat prompts using the **Attach** button.

---

### Document Inventory & Domain Agent Mapping

| # | Filename | Domain Agent | Applicable Workflows / Functionalities | Key Grounded Fields Extracted |
|---|---|---|---|---|
| **01** | `01_Internship_Offer_Letter.txt` | **Employment Domain Agent** | Internship Onboarding, Google Forms Fill, Career Actions | `full_name`, `role`, `employer`, `work_location` (Bangalore), `start_date` (July 1, 2026), `monthly_stipend` |
| **02** | `02_College_NOC.txt` | **Education Domain Agent** | Educational Clearances, University Verification | `full_name`, `university` (IIT Madras), `work_location` (Chennai), `start_date` (June 15, 2026) |
| **03** | `03_Hardware_Procurement_Requisition.txt` | **Finance & Procurement Agent** | Hardware Procurement, Developer Workstations | `employee_name`, `device_model` (MacBook Pro 16" M3 Max), `ram_spec` (64GB), `storage` (1TB), `budget_amount` ($3,499.00), `department_code` (ENG-PROD-2026) |
| **04** | `04_Hospital_Discharge_Invoice.txt` | **Healthcare Admin Agent** | Medical Expense Reimbursement, Health Insurance Claims | `patient_name`, `hospital_name` (Apollo Hospitals), `insurance_policy_id` (POL-MED-2026-9812), `claim_amount` ($1,850.00), `admission_date`, `discharge_date` |
| **05** | `05_Vendor_Tax_Cheque.txt` | **Finance & Payout Agent** | Vendor Payout Update, Automated Wire Disbursements | `vendor_name` (CloudScale Solutions), `bank_name` (HDFC Bank), `account_number` (50100492819201), `ifsc_code` (HDFC0001234), `claim_amount` ($8,500.00) |
| **06** | `06_National_Identity_Card.txt` | **Government Bureaucracy Agent** | Citizen Registrations, Statutory Identity Verification | `full_name` (Atharva Mendhulkar), `work_location` (Chennai), `jurisdiction`, `date_of_birth` |
| **07** | `07_University_Transcript.txt` | **Education Domain Agent** | Academic Verification, Scholarship Applications | `student_name`, `university` (IIT Madras), `cgpa` (9.42 / 10.00), `degree` (B.Tech CSE & AI) |
| **08** | `08_Mutual_NDA_Agreement.txt` | **Legal & Compliance Agent** | Legal Due Diligence, Contract Execution, Cedar Zero-Trust | `signatories`, `agreement_type`, `effective_date`, `covenants` |

---

### How to Test Each Functionality

#### 1. Testing Deterministic Contradiction Detection (Phase 4 of 8)
- Attach both `01_Internship_Offer_Letter.txt` and `02_College_NOC.txt`.
- Type: `I'm starting my internship onboarding`.
- **Expected Outcome**: EVA extracts fields, pauses execution at Step Functions token, and prompts you with a conflict card showing the start date discrepancy (`July 1, 2026` in Offer Letter vs `June 15, 2026` in College NOC) and location discrepancy (`Bangalore` vs `Chennai`). You can click to authoritatively resolve it.

#### 2. Testing Zero-Trust Cedar Policy Evaluation (Phase 6 of 8)
- Type: `Order a developer workstation for my engineering role` with `03_Hardware_Procurement_Requisition.txt` attached.
- **Expected Outcome**: Cedar Policy Decision Point (PDP) evaluates Policy 02. Form population is **ALLOWED** into sandbox, but consequential external submission is mathematically **DENIED** until you sign off.

#### 3. Testing Medical Insurance Reimbursement
- Attach `04_Hospital_Discharge_Invoice.txt`.
- Type: `File insurance reimbursement for my hospital bill`.
- **Expected Outcome**: Healthcare Admin Agent extracts Apollo Hospitals charges ($1,850.00) with zero hallucination.

#### 4. Testing Google Forms Dynamic Parsing & Population
- Type: `fill google form https://docs.google.com/forms/d/e/1FAIpQLSc_Example/viewform for candidate registration`.
- Attach `01_Internship_Offer_Letter.txt` or `06_National_Identity_Card.txt`.
- **Expected Outcome**: EVA extracts form field questions from the live schema, binds matching evidence from the vault, generates single-use cryptographic approval nonces, and halts for your confirmation.

#### 5. Testing Append-Only Audit Hash Chain Verification
- Go to the **Audit Trail** tab after running any workflow.
- Inspect the SHA-256 event hash chain. Every single step (`parse_intent`, `vault_search`, `extract_evidence`, `evaluate_policy`, `dispatch`) is mathematically linked to the previous event hash.
