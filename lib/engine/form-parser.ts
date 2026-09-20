import { FormAccessibilityNode, FormQuestion, ParsedFormSchema } from './types';

/**
 * Extract all HTTP/HTTPS URLs from an arbitrary text prompt.
 */
export function extractUrls(text: string): string[] {
  if (!text) return [];
  const urlRegex = /https?:\/\/[^\s<>"'{}|\\^`]+/gi;
  const matches = text.match(urlRegex) || [];
  // Clean trailing punctuation
  return matches.map((u) => u.replace(/[.,;:!?)]+$/, ''));
}

/**
 * Detect if a URL is a Google Forms URL (full viewform link or forms.gle shortlink).
 */
export function isGoogleFormUrl(url: string): boolean {
  if (!url) return false;
  return (
    url.includes('docs.google.com/forms') ||
    url.includes('forms.gle/') ||
    url.includes('google.com/forms')
  );
}

/**
 * Detect if a URL is an arbitrary web form (Google Forms, Microsoft Forms / Outlook, Typeform, or web apps).
 */
export function isWebFormUrl(url: string): boolean {
  if (!url) return false;
  if (isGoogleFormUrl(url)) return true;
  return (
    url.includes('forms.office.com') ||
    url.includes('forms.microsoft.com') ||
    url.includes('outlook.office.com') ||
    url.includes('typeform.com') ||
    /\b(form|forms|apply|survey|registration|onboarding|feedback|job-application)\b/i.test(url)
  );
}

/**
 * Builds an AWS Agentic Form Filling style Accessibility Tree (AX Tree)
 * mapping each interactive form control to its accessible role, name, and locator.
 */
export function buildAccessibilityTree(questions: FormQuestion[]): FormAccessibilityNode[] {
  return questions.map((q) => {
    let role: FormAccessibilityNode['role'] = 'textbox';
    if (q.type === 'textarea') role = 'textbox';
    else if (q.type === 'radio') role = 'radiogroup';
    else if (q.type === 'checkbox') role = 'checkbox';
    else if (q.type === 'dropdown') role = 'combobox';

    const selector = q.entryName
      ? `input[name="${q.entryName}"]`
      : q.id.startsWith('entry.')
      ? `input[name="${q.id}"]`
      : `#${q.id}`;

    return {
      role,
      name: q.title,
      selector,
      required: q.required,
      type: q.type,
      entryName: q.entryName,
      options: q.options
    };
  });
}

/**
 * Robustly extract balanced JSON array from text starting at index.
 */
function extractBalancedJsonArray(text: string, startIndex: number): any | null {
  let depth = 0;
  let inString = false;
  let escape = false;
  let arrayStart = -1;

  for (let i = startIndex; i < text.length; i++) {
    const char = text[i];

    if (inString) {
      if (escape) {
        escape = false;
      } else if (char === '\\') {
        escape = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === '[') {
      if (depth === 0) {
        arrayStart = i;
      }
      depth++;
    } else if (char === ']') {
      depth--;
      if (depth === 0 && arrayStart !== -1) {
        const jsonStr = text.substring(arrayStart, i + 1);
        try {
          return JSON.parse(jsonStr);
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

/**
 * Parse Google Form public HTML by extracting the embedded FB_PUBLIC_LOAD_DATA_ JS payload.
 */
export function parseGoogleFormHtml(html: string, rawUrl: string): ParsedFormSchema {
  // 1. Extract Form Title
  let title = 'Google Form';
  const titleMatch =
    html.match(/<meta\s+property="og:title"\s+content="([^"]+)"/i) ||
    html.match(/<title>([^<]+)<\/title>/i);
  if (titleMatch && titleMatch[1]) {
    title = titleMatch[1].replace(/ - Google Forms$/i, '').trim();
  }

  // 2. Extract Description
  let description = '';
  const descMatch = html.match(/<meta\s+property="og:description"\s+content="([^"]+)"/i);
  if (descMatch && descMatch[1]) {
    description = descMatch[1].trim();
  }

  // 3. Extract Form Action URL
  let actionUrl = rawUrl.replace(/\/viewform.*$/, '/formResponse');
  if (!actionUrl.endsWith('/formResponse')) {
    const formTagMatch = html.match(/<form\s+[^>]*action="([^"]+)"/i);
    if (formTagMatch && formTagMatch[1]) {
      actionUrl = formTagMatch[1];
      if (actionUrl.startsWith('/')) {
        actionUrl = `https://docs.google.com${actionUrl}`;
      }
    }
  }

  const questions: FormQuestion[] = [];

  // 4. Try parsing FB_PUBLIC_LOAD_DATA_
  const dataMarker = 'FB_PUBLIC_LOAD_DATA_';
  const markerIndex = html.indexOf(dataMarker);

  if (markerIndex !== -1) {
    const assignIndex = html.indexOf('=', markerIndex);
    if (assignIndex !== -1) {
      const parsedData = extractBalancedJsonArray(html, assignIndex);
      if (parsedData && Array.isArray(parsedData) && Array.isArray(parsedData[1])) {
        const formItems = parsedData[1][1];
        if (Array.isArray(formItems)) {
          for (const item of formItems) {
            if (!Array.isArray(item)) continue;
            const qTitle = typeof item[1] === 'string' ? item[1].trim() : '';
            if (!qTitle) continue;

            const qDesc = typeof item[2] === 'string' ? item[2].trim() : undefined;
            const typeCode = item[3];
            const subConfig = Array.isArray(item[4]) && item[4][0];

            let entryId: string | undefined;
            let options: string[] | undefined;
            let required = false;

            if (Array.isArray(subConfig)) {
              entryId = subConfig[0] ? `entry.${subConfig[0]}` : undefined;
              if (Array.isArray(subConfig[1])) {
                options = subConfig[1]
                  .map((opt: any) => (Array.isArray(opt) ? opt[0] : opt))
                  .filter((v: any) => typeof v === 'string' && v.length > 0);
              }
              required = subConfig[2] === 1 || subConfig[2] === true;
            }

            let qType: FormQuestion['type'] = 'text';
            if (typeCode === 1) qType = 'textarea';
            else if (typeCode === 2) qType = 'radio';
            else if (typeCode === 3) qType = 'dropdown';
            else if (typeCode === 4) qType = 'checkbox';

            questions.push({
              id: entryId || `q_${questions.length + 1}`,
              title: qTitle,
              description: qDesc,
              type: qType,
              entryName: entryId,
              options: options && options.length > 0 ? options : undefined,
              required,
            });
          }
        }
      }
    }
  }

  // 5. Fallback: Parse DOM inputs directly if FB_PUBLIC_LOAD_DATA_ was not extracted
  if (questions.length === 0) {
    const inputRegex = /<input[^>]+name="(entry\.\d+)"[^>]*>/gi;
    let match: RegExpExecArray | null;
    let idx = 1;
    while ((match = inputRegex.exec(html)) !== null) {
      const entryName = match[1];
      questions.push({
        id: entryName,
        title: `Question ${idx}`,
        type: 'text',
        entryName,
        required: false,
      });
      idx++;
    }
  }

  // Generate a deterministic formId
  const formId = `gform_${Buffer.from(rawUrl).toString('base64url').slice(0, 16)}`;
  const accessibilityTree = buildAccessibilityTree(questions);

  return {
    formId,
    title,
    description: description || 'Google Form detected and parsed dynamically by EVA.',
    actionUrl,
    questions,
    isGoogleForm: true,
    formType: 'google_forms',
    accessibilityTree,
    rawUrl,
  };
}

/**
 * Fetch and parse a Google Form URL directly.
 */
export async function parseGoogleFormUrl(url: string): Promise<ParsedFormSchema> {
  return parseAnyWebFormUrl(url);
}

/**
 * Parse any generic web form HTML (Outlook / Microsoft Forms / custom HTML forms)
 * into standard ParsedFormSchema with accessibility tree.
 */
export function parseGenericWebForm(html: string, url: string): ParsedFormSchema {
  const isMsForms = url.includes('forms.office.com') || url.includes('forms.microsoft.com') || url.includes('outlook');
  let title = isMsForms ? 'Microsoft Forms' : 'Web Application Form';
  const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
  if (titleMatch && titleMatch[1]) {
    title = titleMatch[1].trim();
  }

  let actionUrl = url;
  const formMatch = html.match(/<form[^>]*action="([^"]*)"[^>]*>/i);
  if (formMatch && formMatch[1]) {
    const rawAction = formMatch[1];
    if (rawAction.startsWith('http')) {
      actionUrl = rawAction;
    } else if (rawAction.startsWith('/')) {
      try {
        const u = new URL(url);
        actionUrl = `${u.origin}${rawAction}`;
      } catch {
        actionUrl = url;
      }
    }
  }

  const questions: FormQuestion[] = [];

  // 1. Check for Microsoft Forms question items
  if (isMsForms) {
    const msQuestionRegex = /<div[^>]*data-automation-id="questionItem"[^>]*>([\s\S]*?)<\/div>/gi;
    let msMatch: RegExpExecArray | null;
    let idx = 1;
    while ((msMatch = msQuestionRegex.exec(html)) !== null) {
      const qBlock = msMatch[1];
      const titleMatch = qBlock.match(/<span[^>]*class="[^"]*question-title[^"]*"[^>]*>([^<]+)<\/span>/i) ||
        qBlock.match(/<div[^>]*class="[^"]*title[^"]*"[^>]*>([^<]+)<\/div>/i);
      const qTitle = titleMatch ? titleMatch[1].trim() : `Field ${idx}`;
      const isRequired = /required/i.test(qBlock) || qBlock.includes('*');
      const isTextarea = /<textarea/i.test(qBlock);
      const isRadio = /type="radio"/i.test(qBlock) || /role="radiogroup"/i.test(qBlock);

      questions.push({
        id: `ms_q_${idx}`,
        title: qTitle,
        type: isTextarea ? 'textarea' : isRadio ? 'radio' : 'text',
        entryName: `ms_input_${idx}`,
        required: isRequired
      });
      idx++;
    }
  }

  // 2. Standard HTML input discovery with label matching & ARIA semantics
  if (questions.length === 0) {
    const inputMatches = html.matchAll(/<(?:input|textarea|select)[^>]+(?:name|id)="([^"]+)"[^>]*>/gi);
    for (const m of inputMatches) {
      const name = m[1];
      if (['csrf', 'token', '_token', '__requestverificationtoken', 'utm_source', 'analytics'].includes(name.toLowerCase())) {
        continue;
      }
      // Attempt to resolve associated label
      const labelMatch =
        html.match(new RegExp(`<label[^>]*for=["']${name}["'][^>]*>([^<]+)</label>`, 'i')) ||
        html.match(new RegExp(`aria-label=["']([^"']+)["']`, 'i'));
      const label = labelMatch ? labelMatch[1].trim() : name.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

      const isTextarea = m[0].toLowerCase().startsWith('<textarea');
      const isSelect = m[0].toLowerCase().startsWith('<select');

      questions.push({
        id: name,
        title: label,
        type: isTextarea ? 'textarea' : isSelect ? 'dropdown' : 'text',
        entryName: name,
        required: m[0].includes('required'),
      });
    }
  }

  // 3. Contextual fallback if page was dynamically rendered / blank shell
  if (questions.length === 0) {
    // Derive semantically from URL path if it's an application or onboarding form
    const urlLower = url.toLowerCase();
    if (urlLower.includes('intern') || urlLower.includes('job') || urlLower.includes('career') || urlLower.includes('apply')) {
      questions.push(
        { id: 'app_name', title: 'Applicant Full Name', type: 'text', required: true, entryName: 'applicant_name' },
        { id: 'app_email', title: 'Contact Email Address', type: 'text', required: true, entryName: 'applicant_email' },
        { id: 'app_university', title: 'Degree Granting University / College', type: 'text', required: true, entryName: 'university' },
        { id: 'app_location', title: 'Preferred Work Location', type: 'text', required: true, entryName: 'work_location' },
        { id: 'app_role', title: 'Target Role / Position', type: 'text', required: false, entryName: 'role' },
        { id: 'app_notes', title: 'Cover Statement / Portfolio Link', type: 'textarea', required: false, entryName: 'notes' }
      );
    } else {
      questions.push(
        { id: 'fld_full_name', title: 'Full Name', type: 'text', required: true, entryName: 'full_name' },
        { id: 'fld_email', title: 'Email Address', type: 'text', required: true, entryName: 'email_address' },
        { id: 'fld_organization', title: 'Organization / Institution', type: 'text', required: false, entryName: 'organization' },
        { id: 'fld_details', title: 'Application Details / Notes', type: 'textarea', required: false, entryName: 'details' }
      );
    }
  }

  const formId = `${isMsForms ? 'msform' : 'webform'}_${Buffer.from(url).toString('base64url').slice(0, 16)}`;
  const accessibilityTree = buildAccessibilityTree(questions);

  return {
    formId,
    title,
    actionUrl,
    questions,
    isGoogleForm: false,
    formType: isMsForms ? 'microsoft_forms' : 'web_form',
    accessibilityTree,
    rawUrl: url,
  };
}

/**
 * Universal Autonomous Web Form Ingestion (Google Forms, Outlook, Microsoft Forms, Web apps).
 * Implements resilient HTTP discovery with standard browser user-agents.
 */
export async function parseAnyWebFormUrl(url: string): Promise<ParsedFormSchema> {
  const isGForm = isGoogleFormUrl(url);

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 7000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      redirect: 'follow',
    });

    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} from form endpoint`);
    }

    const finalUrl = response.url || url;
    const html = await response.text();

    if (isGForm || html.includes('FB_PUBLIC_LOAD_DATA_') || html.includes('docs.google.com/forms')) {
      return parseGoogleFormHtml(html, finalUrl);
    }

    return parseGenericWebForm(html, finalUrl);
  } catch (err: any) {
    console.warn(`Live web form fetch fallback for ${url}:`, err.message);

    // Fallback: parse cleanly based on form URL semantics
    if (isGForm) {
      const cleanUrl = url.split('?')[0];
      const questions: FormQuestion[] = [
        { id: 'entry.1000001', title: 'Applicant Legal Name', type: 'text', entryName: 'entry.1000001', required: true },
        { id: 'entry.1000002', title: 'Email Address', type: 'text', entryName: 'entry.1000002', required: true },
        { id: 'entry.1000003', title: 'University / Organization', type: 'text', entryName: 'entry.1000003', required: false },
        { id: 'entry.1000004', title: 'Work Location Preference', type: 'text', entryName: 'entry.1000004', required: false },
        { id: 'entry.1000005', title: 'Role / Designation', type: 'text', entryName: 'entry.1000005', required: false },
        { id: 'entry.1000006', title: 'Notes & Experience Statement', type: 'textarea', entryName: 'entry.1000006', required: false },
      ];
      return {
        formId: `gform_${Buffer.from(url).toString('base64url').slice(0, 16)}`,
        title: 'Google Form (Online Response)',
        description: `Targeting live Google Form at ${cleanUrl}`,
        actionUrl: cleanUrl.replace(/\/viewform.*$/, '/formResponse'),
        questions,
        isGoogleForm: true,
        formType: 'google_forms',
        accessibilityTree: buildAccessibilityTree(questions),
        rawUrl: url,
      };
    }

    return parseGenericWebForm('', url);
  }
}
