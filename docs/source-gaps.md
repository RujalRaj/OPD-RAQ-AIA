# Source reconciliation and unresolved clinical specification

Both original documents were read in full before implementation, including all nine workbook worksheets. Document content was treated as requirements material, not as permission to override the user's later instructions or as evidence of clinical validation. The originals remain unchanged.

## User decisions applied after the handoff

Automatic three-level agent assignment replaces mandatory per-encounter nurse or doctor approval. All roles can override. Nurses, interns and JRs must submit at least one vital they choose plus a reason; doctors need a reason. Unresolved requests go to the doctor without changing the active priority. Token/parcha identifiers remain fixed. These decisions take precedence over conflicting handoff or workbook wording.

## Five mismatches in the supplied 30 cases

The expected labels are the workbook's original labels. They have not been rewritten to improve the result.

| Case | Expected | Implemented | Why it remains unresolved |
| --- | --- | --- | --- |
| 5 | Immediate | Soon | Pregnancy, bleeding and dizziness are reported; the applicable bleeding condition requires heavy bleeding or other qualifying context. The narrow parser does not infer that severity. |
| 7 | Immediate | Soon | New severe headache with blurred vision is reported; the source rule says sudden severe headache. “New” is not silently converted to “sudden.” |
| 10 | Immediate | Soon | Severe abdominal pain with sweating matches the pain phrase but the source rule assigns Soon without defined red-flag instability. The provided narrative does not establish the additional Immediate condition. |
| 12 | Immediate | Soon | Chest discomfort is not enough for the narrow parser to establish the complete acute chest-pain or accompanying-feature condition. Staff can confirm the source condition or override. |
| 20 | Immediate | Soon | Snake bite has an Immediate expected label but no corresponding explicit condition in the supplied 40-row safety matrix. No new clinical mapping was invented. |

Cases 11, 24, 25 and 26 also use the incomplete-coverage fallback even though Soon agrees with their expected label. Matching an expected label via fallback is not evidence that the clinical interpretation is correct.

## Deliberate boundaries

- Numeric rules retain the source operators and qualifiers: e.g. room-air context for the numerical SpO₂ condition; distress/deterioration for the respiratory-rate condition; pregnancy for the pregnancy BP condition. No general normal ranges, missing-vital cutoffs or risk scores were invented.
- The safety matrix supplies no general Routine rule. Stable-visit routing is an explicit synthetic demonstration assumption drawn from the supplied fixture descriptions and checkbox, not a clinical rule. Unrecognized narrative prevents that route.
- Missing vitals remain unknown. The database uses recorded / not measured / unable to obtain status, units and measurement timestamps. Random blood sugar uses mg/dL as an explicit prototype unit convention; no glucose threshold is invented.
- The phrase extractor is deliberately narrow, with basic negation/history handling. It does not establish absence from unmentioned symptoms and does not resolve arbitrary clinical language, slang or Hindi transliteration.
- A human override can differ from the source suggestion. The original source alert and suggestion remain visible and the override is audited. Reassessment preserves the staff decision rather than silently undoing it.
- The optional model uses strict priority/evidence fields. Free-form generated explanations are discarded rather than accepted as measurements or diagnoses. Structural checks are not proof of clinical correctness.

Resolving these gaps requires a qualified clinical owner to specify the intended local policy and approve revised source material. This repository does not claim such approval.

## Live model integration — 13 October 2026

Groq and OpenAI can now suggest all three priorities. Source-rule minimums, uncertainty guards, explicit missing observations, fixed tokens and staff overrides remain. A model may apply Routine outside the narrow local vocabulary when it reports sufficient context and no guard blocks that result; the coverage-gap flag remains visible. This is pretrained model judgement, not an additional validated clinical rule. The five disagreements above describe the unchanged local evaluator and original workbook fixtures, not measured performance of either hosted model. A live connection still requires a locally configured API key. See [live AI setup](live-ai-setup.md).
