'use client';

import React from 'react';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

// Inline formatting: parses bold, links, code, italic
function parseInline(text: string): React.ReactNode {
  if (!text) return null;

  // 1. Split by inline code: `code`
  const codeParts = text.split(/(`[^`]+`)/g);
  return codeParts.map((part, i) => {
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code
          key={i}
          className="px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700 font-mono text-[11px] text-zinc-200"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    return parseFormatted(part, `c-${i}`);
  });
}

function parseFormatted(text: string, keyPrefix: string): React.ReactNode {
  // Tokenize bold-links **[label](url)**, normal links [label](url), bold **text**, and italic *text*
  const tokenRegex = /(\*\*\[[^\]]+\]\([^\s)]+\)\*\*|\[[^\]]+\]\([^\s)]+\)|\*\*[^*]+\*\*|\*[^*]+\*)/g;
  const parts = text.split(tokenRegex);

  return parts.map((part, idx) => {
    const key = `${keyPrefix}-${idx}`;

    // Bold Link: **[label](url)**
    if (part.startsWith('**[') && part.endsWith(')**')) {
      const inner = part.slice(2, -2);
      const match = inner.match(/^\[([^\]]+)\]\(([^\s)]+)\)$/);
      if (match) {
        return (
          <strong key={key} className="font-semibold text-white">
            <a
              href={match[2]}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:text-blue-300 underline underline-offset-2 font-medium transition-colors"
            >
              {match[1]}
            </a>
          </strong>
        );
      }
    }

    // Normal Link: [label](url)
    if (part.startsWith('[') && part.endsWith(')') && part.includes('](')) {
      const match = part.match(/^\[([^\]]+)\]\(([^\s)]+)\)$/);
      if (match) {
        return (
          <a
            key={key}
            href={match[2]}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 hover:text-blue-300 underline underline-offset-2 font-medium transition-colors"
          >
            {match[1]}
          </a>
        );
      }
    }

    // Bold text: **text**
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return (
        <strong key={key} className="font-semibold text-white">
          {part.slice(2, -2)}
        </strong>
      );
    }

    // Italic text: *text*
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
      return (
        <em key={key} className="italic text-zinc-300">
          {part.slice(1, -1)}
        </em>
      );
    }

    return part;
  });
}

function renderBlock(trimmed: string, keyPrefix: string): React.ReactNode {
  if (!trimmed) return null;

  // Horizontal divider: --- or *** or ___
  if (/^(\-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
    return <hr key={keyPrefix} className="border-t border-zinc-800 my-2" />;
  }

  // Heading 4: ####
  if (trimmed.startsWith('#### ')) {
    const nl = trimmed.indexOf('\n');
    if (nl !== -1) {
      const heading = trimmed.slice(0, nl).replace(/^####\s+/, '');
      const rest = trimmed.slice(nl + 1).trim();
      return (
        <React.Fragment key={keyPrefix}>
          <h5 className="text-xs font-semibold text-zinc-200 tracking-wide mt-2 mb-1">
            {parseInline(heading)}
          </h5>
          {renderBlock(rest, `${keyPrefix}-rest`)}
        </React.Fragment>
      );
    }
    return (
      <h5 key={keyPrefix} className="text-xs font-semibold text-zinc-200 tracking-wide mt-2 mb-1">
        {parseInline(trimmed.replace(/^####\s+/, ''))}
      </h5>
    );
  }

  // Heading 3: ###
  if (trimmed.startsWith('### ')) {
    const nl = trimmed.indexOf('\n');
    if (nl !== -1) {
      const heading = trimmed.slice(0, nl).replace(/^###\s+/, '');
      const rest = trimmed.slice(nl + 1).trim();
      return (
        <React.Fragment key={keyPrefix}>
          <h4 className="text-sm font-semibold text-white mt-2 mb-1">
            {parseInline(heading)}
          </h4>
          {renderBlock(rest, `${keyPrefix}-rest`)}
        </React.Fragment>
      );
    }
    return (
      <h4 key={keyPrefix} className="text-sm font-semibold text-white mt-2 mb-1">
        {parseInline(trimmed.replace(/^###\s+/, ''))}
      </h4>
    );
  }

  // Heading 2: ##
  if (trimmed.startsWith('## ')) {
    const nl = trimmed.indexOf('\n');
    if (nl !== -1) {
      const heading = trimmed.slice(0, nl).replace(/^##\s+/, '');
      const rest = trimmed.slice(nl + 1).trim();
      return (
        <React.Fragment key={keyPrefix}>
          <h3 className="text-base font-semibold text-white mt-3 mb-1">
            {parseInline(heading)}
          </h3>
          {renderBlock(rest, `${keyPrefix}-rest`)}
        </React.Fragment>
      );
    }
    return (
      <h3 key={keyPrefix} className="text-base font-semibold text-white mt-3 mb-1">
        {parseInline(trimmed.replace(/^##\s+/, ''))}
      </h3>
    );
  }

  // Heading 1: #
  if (trimmed.startsWith('# ')) {
    const nl = trimmed.indexOf('\n');
    if (nl !== -1) {
      const heading = trimmed.slice(0, nl).replace(/^#\s+/, '');
      const rest = trimmed.slice(nl + 1).trim();
      return (
        <React.Fragment key={keyPrefix}>
          <h2 className="text-lg font-bold text-white mt-3 mb-1">
            {parseInline(heading)}
          </h2>
          {renderBlock(rest, `${keyPrefix}-rest`)}
        </React.Fragment>
      );
    }
    return (
      <h2 key={keyPrefix} className="text-lg font-bold text-white mt-3 mb-1">
        {parseInline(trimmed.replace(/^#\s+/, ''))}
      </h2>
    );
  }

  // Blockquote: >
  if (trimmed.startsWith('> ')) {
    return (
      <blockquote
        key={keyPrefix}
        className="border-l-2 border-zinc-500 pl-3 py-1 my-1 text-xs text-zinc-400 italic bg-zinc-900/40 rounded-r"
      >
        {parseInline(trimmed.replace(/^>\s*/gm, ''))}
      </blockquote>
    );
  }

  // Pure Bullet list: all lines start with - or *
  const lines = trimmed.split('\n');
  const isBulletList = lines.every((line) => /^\s*[-*]\s+/.test(line));
  if (isBulletList) {
    return (
      <ul key={keyPrefix} className="flex flex-col gap-1.5 my-1 pl-4 list-disc text-zinc-300">
        {lines.map((line, lIdx) => (
          <li key={lIdx} className="text-xs leading-normal">
            {parseInline(line.replace(/^\s*[-*]\s+/, ''))}
          </li>
        ))}
      </ul>
    );
  }

  // Pure Numbered list: all lines start with 1. or 2.
  const isNumberedList = lines.every((line) => /^\s*\d+\.\s+/.test(line));
  if (isNumberedList) {
    return (
      <ol key={keyPrefix} className="flex flex-col gap-1.5 my-1 pl-4 list-decimal text-zinc-300">
        {lines.map((line, lIdx) => (
          <li key={lIdx} className="text-xs leading-normal">
            {parseInline(line.replace(/^\s*\d+\.\s+/, ''))}
          </li>
        ))}
      </ol>
    );
  }

  // Mixed lines with bullets or numbered entries with indented sub-bullets
  if (lines.length > 1 && lines.some((l) => /^\s*[-*]\s+/.test(l) || /^\s*\d+\.\s+/.test(l))) {
    return (
      <div key={keyPrefix} className="flex flex-col gap-1.5 my-1">
        {lines.map((line, lIdx) => {
          const bulletMatch = line.match(/^(\s*)[-*]\s+(.*)$/);
          if (bulletMatch) {
            const isIndented = bulletMatch[1].length >= 2;
            return (
              <div
                key={lIdx}
                className={`flex items-start gap-2 ${isIndented ? 'pl-5 text-zinc-400' : 'pl-2 text-zinc-300'} text-xs leading-relaxed`}
              >
                <span className="text-zinc-500 flex-none mt-1 text-[10px]">•</span>
                <div className="flex-1">{parseInline(bulletMatch[2])}</div>
              </div>
            );
          }

          const numMatch = line.match(/^(\s*)(\d+\.)\s+(.*)$/);
          if (numMatch) {
            return (
              <div key={lIdx} className="flex items-start gap-2 text-xs leading-relaxed mt-1">
                <span className="text-zinc-400 font-mono text-[11px] flex-none">{numMatch[2]}</span>
                <div className="flex-1 font-medium text-white">{parseInline(numMatch[3])}</div>
              </div>
            );
          }

          return (
            <p key={lIdx} className="text-xs leading-relaxed text-zinc-300">
              {parseInline(line)}
            </p>
          );
        })}
      </div>
    );
  }

  // Standard paragraph
  return (
    <p key={keyPrefix} className="text-xs leading-relaxed">
      {parseInline(trimmed)}
    </p>
  );
}

export function MarkdownRenderer({ content, className = '' }: MarkdownRendererProps) {
  if (!content) return null;

  // Split into blocks: code blocks vs regular markdown sections
  const blocks = content.split(/(```[\s\S]*?```)/g);

  return (
    <div className={`markdown-content flex flex-col gap-2.5 text-zinc-300 leading-relaxed ${className}`}>
      {blocks.map((block, index) => {
        if (block.startsWith('```') && block.endsWith('```')) {
          const lines = block.slice(3, -3).trim().split('\n');
          const firstLine = lines[0]?.trim();
          const hasLang = firstLine && /^[a-zA-Z0-9_-]+$/.test(firstLine);
          const lang = hasLang ? firstLine : '';
          const code = hasLang ? lines.slice(1).join('\n') : lines.join('\n');

          return (
            <div key={index} className="my-2 rounded-lg border border-zinc-800 bg-zinc-950 overflow-hidden">
              {lang && (
                <div className="px-3 py-1 bg-zinc-900 border-b border-zinc-800/80 text-[10px] font-mono text-zinc-400">
                  {lang}
                </div>
              )}
              <pre className="p-3 text-xs font-mono text-zinc-200 overflow-x-auto">
                <code>{code}</code>
              </pre>
            </div>
          );
        }

        // Regular markdown text: split into paragraphs / lists / headings
        const paragraphs = block.split(/\n\n+/);

        return paragraphs.map((para, pIdx) => {
          return renderBlock(para.trim(), `${index}-${pIdx}`);
        });
      })}
    </div>
  );
}
