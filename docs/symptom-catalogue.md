# Patient symptom vocabulary — eight expandable sections

The 13 October 2026 replacement supersedes the old quick-choice/More problems catalogue. The user supplied 63 Hindi symptom descriptions and approved the eight section names below after the numbered headings were found to be missing from the pasted file. All Hindi descriptions are copied verbatim; English translations are stored alongside them in [patient_reports_v3.json](../backend/fixtures/patient_reports_v3.json).

| Section | Hindi heading | Supplied bullet positions | Choices |
| --- | --- | --- | --- |
| 1. Breathing, chest & allergy | साँस, सीना और एलर्जी | 1–6 | 6 |
| 2. Fainting, confusion & nerve symptoms | बेहोशी, भ्रम और नसों से जुड़े लक्षण | 7–12 | 6 |
| 3. Bleeding, weakness & fluid loss | खून बहना, कमजोरी और पानी की कमी | 13–18 | 6 |
| 4. Abdominal/urinary problems, fever & other illness | पेट/पेशाब की परेशानी, बुखार और अन्य बीमारी | 19–29 | 11 |
| 5. Injuries, poisoning, eye & limb/genital problems | चोट, ज़हर, आँख और हाथ-पैर/जननांग की परेशानी | 30–43 | 14 |
| 6. Babies & children | शिशु और बच्चे | 44–51 | 8 |
| 7. Pregnancy & after delivery | गर्भावस्था और प्रसव के बाद | 52–59 | 8 |
| 8. Personal safety & mental distress | व्यक्तिगत सुरक्षा और मानसिक परेशानी | 60–63 | 4 |

## Interaction

Only eight section headings appear initially. Ticking a heading opens its choices; it does not select all children or report a clinical finding. Sections can be independently opened and closed. Closing a section keeps its chosen symptoms and shows a selected count. Only individually selected symptom IDs enter the registration request. Removing the last symptom disables checkbox-only continuation unless another input method has provided a description. Method switching and the review/vitals steps preserve selections.

Each patient screen uses the chosen language. The sensitive section preserves the instruction “इन सवालों को जरूरत पड़ने पर अलग, निजी जगह में पूछें।” in Hindi and its English translation. Registration is now staff-led. The former help/skip-form instructions are removed; an authenticated Staff assessed emergency action is available on the earlier Vitals page once its mandatory fields are complete. On Review, selected reports are displayed above the editable description. Text and voice remain available for complaints not covered by this replacement list. The number or order of sections is an interface choice, not a clinical ranking.

## Original records and model input

The catalogue version is `opd-reports-v3`. Registration saves immutable selected IDs, bilingual labels and section context, including the pregnancy/child heading when the bullet depends on that context. The original text and speech transcript stay unchanged. Staff see selected reports with their section labels. The model receives those labels and section context through the existing clinical evidence allowlist. Merely opening a section is never submitted, and selecting a report within the pregnancy section does not silently change the patient’s pregnancy status.

All 44 older IDs and their original wording remain supported for historic records and API clients, but are hidden in new patient intake. Saved earlier labels are never rewritten. A record without captured labels can still resolve its old IDs. Idempotent registration retries recover the original token even if a future catalogue changes.

## Existing safety rules

The supplied 40-condition safety matrix and its thresholds remain unchanged. Five direct report-to-existing-condition mappings preserve deterministic source checks:

| Report | Existing source condition |
| --- | --- |
| `report_v3_01` | Rule 3: severe respiratory distress / inability to speak because of breathlessness |
| `report_v3_03` | Rule 11: acute chest pain/pressure/tightness |
| `report_v3_09` | Rule 15: new focal neurological deficit |
| `report_v3_13` | Rule 7: heavy/uncontrolled bleeding |
| `report_v3_34` | Rule 21: poisoning, overdose or dangerous chemical exposure |

Each mapped condition retains the original selected report as evidence. Other new descriptions remain symptom reports for the existing AI/staff workflow. A compound “or” description does not establish which branch applies, absence of shock, stability, pregnancy or additional clinical criteria. No blanket Immediate assignment or new diagnosis rule is introduced by this vocabulary change. Without an established source match, the existing local fallback and AI guards remain in force. Checking a report prevents an accompanying legacy routine-follow-up choice from establishing a symptom-free routine visit.

Unknown optional measurements and qualitative High / Low observations never become invented numeric readings. Vitals now follows About you, with Temperature, SpO₂ and Pulse required before continuation. Existing source rules and later staff override requirements are unchanged. This replacement list has not been clinically validated.
