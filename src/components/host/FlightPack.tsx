"use client";

import { useEffect, useRef, useState } from "react";

import { PaymentAvailabilitySchema, type PaymentAvailability } from "@/server/payments/payment-adapter";

const PACK_KEY = "waitrelay:flight-pack";
const previewOptions = [
  { id: "moonlit", label: "Moonlit courier", detail: "Mint bird, lilac sky, quiet portal" },
  { id: "ember", label: "Ember courier", detail: "Peach bird, navy sky, comet trail" },
] as const;

const previewOnly: PaymentAvailability = {
  mode: "disabled",
  available: false,
  label: "Preview only",
  reason: "Payments are disabled. No transaction can be created.",
};

export function FlightPack({ sensitive = false }: { sensitive?: boolean }) {
  const [availability, setAvailability] = useState<PaymentAvailability>(previewOnly);
  const [open, setOpen] = useState(false);
  const [previewNotice, setPreviewNotice] = useState<string | null>(null);
  const [selected, setSelected] = useState<(typeof previewOptions)[number]["id"]>("moonlit");
  const openButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/payments/availability", { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("availability unavailable");
        return PaymentAvailabilitySchema.parse(await response.json());
      })
      .then(setAvailability)
      .catch(() => undefined);
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!open) return;
    const opener = openButtonRef.current;
    closeButtonRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = [...dialogRef.current.querySelectorAll<HTMLElement>(
        "button:not([disabled]), input:not([disabled]), a[href], [tabindex]:not([tabindex='-1'])",
      )];
      const first = focusable[0];
      const last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      opener?.focus();
    };
  }, [open]);

  const savePreview = () => {
    if (sensitive) {
      setPreviewNotice("Preview selected for this session.");
    } else {
      try {
        localStorage.setItem(PACK_KEY, selected);
        setPreviewNotice("Cosmetic preview saved on this device.");
      } catch {
        setPreviewNotice("Preview selected for this session. Browser storage is unavailable.");
      }
    }
    setOpen(false);
  };

  return <section className="flight-pack">
    <div>
      <span className="eyebrow">Cosmetic, never pay-to-steer</span>
      <h3>Forge a Flight Pack</h3>
      <p>Preview a bird body, trail, and portal style after the answer is ready.</p>
      <span className={`pack-mode pack-mode-${availability.mode}`}>{availability.label}</span>
      {previewNotice && <p role="status">{previewNotice}</p>}
    </div>
    <div className="swatches" role="img" aria-label="Flight pack palette preview: mint, lilac, and peach"><span /><span /><span /></div>
    <button ref={openButtonRef} type="button" className="secondary-button" onClick={() => setOpen(true)}>
      {availability.mode === "demo" ? "Open sandbox preview" : "Preview Flight Pack"}
    </button>

    {open && <div className="pack-dialog-backdrop" onMouseDown={(event) => {
      if (event.currentTarget === event.target) setOpen(false);
    }}>
      <section ref={dialogRef} className="pack-dialog" role="dialog" aria-modal="true" aria-labelledby="pack-dialog-title" aria-describedby="pack-dialog-description">
        <button ref={closeButtonRef} type="button" className="pack-dialog-close" aria-label="Close Flight Pack preview" onClick={() => setOpen(false)}>Close</button>
        <span className="eyebrow">{availability.label}</span>
        <h2 id="pack-dialog-title">Choose a cosmetic flight style</h2>
        <p id="pack-dialog-description">{availability.reason} Steering and agent output are always free.</p>
        <fieldset className="pack-options">
          <legend>Preview style</legend>
          {previewOptions.map((option) => <label key={option.id}>
            <input type="radio" name="flight-pack" value={option.id} checked={selected === option.id} onChange={() => setSelected(option.id)} />
            <span><strong>{option.label}</strong><small>{option.detail}</small></span>
          </label>)}
        </fieldset>
        <button type="button" className="primary-button" onClick={savePreview}>
          {sensitive ? "Use for this preview" : "Save cosmetic preview"}
        </button>
        {sensitive && <p className="pack-private-note">Sensitive mode does not store this choice.</p>}
      </section>
    </div>}
  </section>;
}
