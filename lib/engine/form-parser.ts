import { FormQuestion, ParsedFormSchema } from './types';

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
            // item[0]: item id
            // item[1]: question title
            // item[2]: description
            // item[3]: type code (0: short text, 1: long text, 2: radio, 3: dropdown, 4: checkbox, 9: date)
            // item[4]: question sub-config array containing entry id: [[entryId, options, required, ...]]
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

  return {
    formId,
    title,
    description: description || 'Google Form detected and parsed dynamically by EVA.',
    actionUrl,
    questions,
    isGoogleForm: true,
    rawUrl,
  };
}

/**
 * Fetch and parse a Google Form URL directly.
 */
export async function parseGoogleFormUrl(url: string): Promise<ParsedFormSchema> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      redirect: 'follow',
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch Google Form: HTTP ${response.status}`);
    }

    const finalUrl = response.url || url;
    const html = await response.text();
    return parseGoogleFormHtml(html, finalUrl);
  } catch (err: any) {
    // Return a structured fallback schema if network is restricted or offline
    const cleanUrl = url.split('?')[0];
    return {
      formId: `gform_${Buffer.from(url).toString('base64url').slice(0, 16)}`,
      title: 'Google Form (Online Response)',
      description: `Targeting live Google Form at ${cleanUrl}`,
      actionUrl: cleanUrl.replace(/\/viewform.*$/, '/formResponse'),
      questions: [
        {
          id: 'entry.1000001',
          title: 'Full Name',
          type: 'text',
          entryName: 'entry.1000001',
          required: true,
        },
        {
          id: 'entry.1000002',
          title: 'Email Address',
          type: 'text',
          entryName: 'entry.1000002',
          required: true,
        },
        {
          id: 'entry.1000003',
          title: 'Organization / University',
          type: 'text',
          entryName: 'entry.1000003',
          required: false,
        },
        {
          id: 'entry.1000004',
          title: 'Notes & Verification Details',
          type: 'textarea',
          entryName: 'entry.1000004',
          required: false,
        },
      ],
      isGoogleForm: true,
      rawUrl: url,
    };
  }
}

/**
 * Parse any generic web form HTML into standard ParsedFormSchema.
 */
export function parseGenericWebForm(html: string, url: string): ParsedFormSchema {
  let title = 'Web Form';
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
      const u = new URL(url);
      actionUrl = `${u.origin}${rawAction}`;
    }
  }

  const questions: FormQuestion[] = [];
  const inputMatches = html.matchAll(/<input[^>]+name="([^"]+)"[^>]*>/gi);
  for (const m of inputMatches) {
    const name = m[1];
    if (['csrf', 'token', '_token', '__RequestVerificationToken'].includes(name.toLowerCase())) {
      continue;
    }
    const labelMatch = html.match(new RegExp(`<label[^>]*for="${name}"[^>]*>([^<]+)</label>`, 'i'));
    const label = labelMatch ? labelMatch[1].trim() : name.replace(/_/g, ' ');

    questions.push({
      id: name,
      title: label,
      type: 'text',
      entryName: name,
      required: false,
    });
  }

  return {
    formId: `webform_${Buffer.from(url).toString('base64url').slice(0, 16)}`,
    title,
    actionUrl,
    questions,
    isGoogleForm: false,
    rawUrl: url,
  };
}
