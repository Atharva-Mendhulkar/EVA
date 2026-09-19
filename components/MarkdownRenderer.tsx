'use client';

import React from 'react';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

// Inline formatting: parses bold, italic, code
function parseInline(text: string): React.ReactNode {
  if (!text) return null;

  // Split by inline code: `code`
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

    // Parse bold: **text**
    const boldParts = part.split(/(\*\*[^*]+\*\*)/g);
    return boldParts.map((bPart, j) => {
      if (bPart.startsWith('**') && bPart.endsWith('**')) {
        return (
          <strong key={`${i}-${j}`} className="font-semibold text-white">
            {parseItalics(bPart.slice(2, -2), `${i}-${j}`)}
          </strong>
        );
      }
      return parseItalics(bPart, `${i}-${j}`);
    });
  });
}

function parseItalics(text: string, keyPrefix: string = 'it'): React.ReactNode {
  // Parse *italic*
  const italicParts = text.split(/(\*[^*]+\*)/g);
  return italicParts.map((part, k) => {
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
      return (
        <em key={`${keyPrefix}-${k}`} className="italic text-zinc-200">
          {part.slice(1, -1)}
        </em>
      );
    }
    return part;
  });
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
          const trimmed = para.trim();
          if (!trimmed) return null;

          // Heading 3: ###
          if (trimmed.startsWith('### ')) {
            return (
              <h4 key={`${index}-${pIdx}`} className="text-sm font-semibold text-white mt-2 mb-1">
                {parseInline(trimmed.replace(/^###\s+/, ''))}
              </h4>
            );
          }

          // Heading 2: ##
          if (trimmed.startsWith('## ')) {
            return (
              <h3 key={`${index}-${pIdx}`} className="text-base font-semibold text-white mt-3 mb-1">
                {parseInline(trimmed.replace(/^##\s+/, ''))}
              </h3>
            );
          }

          // Heading 1: #
          if (trimmed.startsWith('# ')) {
            return (
              <h2 key={`${index}-${pIdx}`} className="text-lg font-bold text-white mt-3 mb-1">
                {parseInline(trimmed.replace(/^#\s+/, ''))}
              </h2>
            );
          }

          // Blockquote: >
          if (trimmed.startsWith('> ')) {
            return (
              <blockquote
                key={`${index}-${pIdx}`}
                className="border-l-2 border-zinc-500 pl-3 py-1 my-1 text-xs text-zinc-400 italic bg-zinc-900/40 rounded-r"
              >
                {parseInline(trimmed.replace(/^>\s*/gm, ''))}
              </blockquote>
            );
          }

          // Warning / Alert banner: starts with ⚠️
          if (trimmed.startsWith('⚠️')) {
            return (
              <div
                key={`${index}-${pIdx}`}
                className="p-3 rounded-lg bg-zinc-900/80 border border-zinc-700/80 text-xs text-zinc-200 my-1"
              >
                {parseInline(trimmed)}
              </div>
            );
          }

          // Bullet list: lines starting with - or *
          const lines = trimmed.split('\n');
          const isBulletList = lines.every((line) => /^\s*[-*]\s+/.test(line));
          if (isBulletList) {
            return (
              <ul key={`${index}-${pIdx}`} className="flex flex-col gap-1.5 my-1 pl-4 list-disc text-zinc-300">
                {lines.map((line, lIdx) => (
                  <li key={lIdx} className="text-xs leading-normal">
                    {parseInline(line.replace(/^\s*[-*]\s+/, ''))}
                  </li>
                ))}
              </ul>
            );
          }

          // Numbered list: lines starting with 1. or 2.
          const isNumberedList = lines.every((line) => /^\s*\d+\.\s+/.test(line));
          if (isNumberedList) {
            return (
              <ol key={`${index}-${pIdx}`} className="flex flex-col gap-1.5 my-1 pl-4 list-decimal text-zinc-300">
                {lines.map((line, lIdx) => (
                  <li key={lIdx} className="text-xs leading-normal">
                    {parseInline(line.replace(/^\s*\d+\.\s+/, ''))}
                  </li>
                ))}
              </ol>
            );
          }

          // Mixed lines with bullets
          if (lines.some((l) => /^\s*[-*]\s+/.test(l))) {
            return (
              <div key={`${index}-${pIdx}`} className="flex flex-col gap-1.5">
                {lines.map((line, lIdx) => {
                  if (/^\s*[-*]\s+/.test(line)) {
                    return (
                      <div key={lIdx} className="flex items-start gap-2 pl-2 text-xs">
                        <span className="text-zinc-500 flex-none mt-1">•</span>
                        <span>{parseInline(line.replace(/^\s*[-*]\s+/, ''))}</span>
                      </div>
                    );
                  }
                  return (
                    <p key={lIdx} className="text-xs leading-relaxed">
                      {parseInline(line)}
                    </p>
                  );
                })}
              </div>
            );
          }

          // Standard paragraph
          return (
            <p key={`${index}-${pIdx}`} className="text-xs leading-relaxed">
              {parseInline(trimmed)}
            </p>
          );
        });
      })}
    </div>
  );
}
