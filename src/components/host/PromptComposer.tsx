"use client";

import { useState, type FormEvent } from "react";

import { FLAGSHIP_TASK } from "../../../demo/tokyo-scenario";

export interface PromptComposerProps {
  busy: boolean;
  onSubmit: (prompt: string) => void;
}

export function PromptComposer({ busy, onSubmit }: PromptComposerProps) {
  const [prompt, setPrompt] = useState(FLAGSHIP_TASK);
  return (
    <form className="prompt-composer" onSubmit={(event: FormEvent) => {
      event.preventDefault();
      const normalized = prompt.trim();
      if (normalized) onSubmit(normalized);
    }}>
      <label htmlFor="task-prompt">What should the agent plan?</label>
      <textarea id="task-prompt" value={prompt} onChange={(event) => setPrompt(event.target.value)} rows={4} maxLength={2_000} disabled={busy} />
      <div className="composer-footer">
        <span>Demo data is versioned scenario evidence, not live verification.</span>
        <button className="primary-button" type="submit" disabled={busy || !prompt.trim()}>
          {busy ? "Run in flight" : "Start the relay"}
        </button>
      </div>
    </form>
  );
}
