import { useState } from 'react';
import { createPortal } from 'react-dom';
import { FileCode2, Copy, Check, X } from 'lucide-react';
import type { Lead } from '../lib/types';
import { buildLpPrompt } from '../lib/lpPrompt';
import { cn } from './ui';

export function LpPromptButton({ lead, compact }: { lead: Lead; compact?: boolean }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        className={cn('btn-ghost', compact && 'px-2 py-1.5')}
        title="Gerar prompt para construir a landing page"
      >
        <FileCode2 className="h-3.5 w-3.5" />
        {!compact && <span>Gerar prompt LP</span>}
      </button>
      {open && <PromptModal lead={lead} onClose={() => setOpen(false)} />}
    </>
  );
}

function PromptModal({ lead, onClose }: { lead: Lead; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const prompt = buildLpPrompt(lead);

  function copy() {
    navigator.clipboard.writeText(prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="card flex max-h-[85vh] w-full max-w-2xl flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h3 className="flex items-center gap-2 text-base font-semibold">
              <FileCode2 className="h-4 w-4 text-brand-400" /> Prompt da LP — {lead.name}
            </h3>
            <p className="text-xs text-zinc-500">Copie e cole no Claude Code (numa pasta nova) para gerar a página.</p>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-200"><X className="h-4 w-4" /></button>
        </div>

        <pre className="flex-1 overflow-auto whitespace-pre-wrap rounded-xl border border-white/[0.06] bg-black/30 p-4 font-mono text-xs leading-relaxed text-zinc-300">{prompt}</pre>

        <div className="mt-4 flex items-center justify-between gap-3">
          <p className="text-[11px] text-zinc-500">1. Copie · 2. Crie uma pasta · 3. Abra o Claude Code · 4. Cole e gere a LP</p>
          <button onClick={copy} className="btn-primary shrink-0">
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? 'Copiado!' : 'Copiar prompt'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
