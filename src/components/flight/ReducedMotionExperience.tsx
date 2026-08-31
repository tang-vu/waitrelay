"use client";

import type { SafeFlightAck, SafeFlightGate } from "../../features/flight/bridge";
import styles from "./flight.module.css";

const optionDescriptions: Readonly<Record<string, string>> = {
  "less-walking": "Keep the route compact.",
  "more-discovery": "Travel farther for distinctive stops.",
  reliable: "Favor stronger source confidence.",
  surprising: "Favor novelty with adequate evidence.",
  practical: "Prioritize immediately useful choices.",
  creative: "Explore a less expected direction.",
  breadth: "Cover more viable possibilities.",
  depth: "Investigate fewer options more deeply.",
  concise: "Keep the final response focused.",
  detailed: "Include more supporting detail.",
  speed: "Use the evidence already available.",
  confidence: "Require additional verification.",
};

export type ReducedMotionExperienceProps = {
  stage: string;
  gate?: SafeFlightGate | null;
  selectedOptionId?: string;
  acknowledgement?: SafeFlightAck | null;
  terminal?: boolean;
  onChoose: (optionId: SafeFlightGate["options"][number]["optionId"]) => void;
  onSkip: () => void;
  onPassive: () => void;
  onDismiss: () => void;
};

function feedback(acknowledgement?: SafeFlightAck | null): string | undefined {
  if (!acknowledgement) return undefined;
  if (acknowledgement.status === "appliedNow") return "Applied now";
  if (acknowledgement.status === "tooLate") return "Too late for this run";
  if (acknowledgement.status === "savedNext") return "Saved for next time";
  return "Choice not applied";
}

export function ReducedMotionExperience({
  stage,
  gate,
  selectedOptionId,
  acknowledgement,
  terminal = false,
  onChoose,
  onSkip,
  onPassive,
  onDismiss,
}: ReducedMotionExperienceProps) {
  const ackText = feedback(acknowledgement);
  return (
    <section className={`${styles.reduced} ${terminal ? styles.terminal : ""}`} aria-label="Reduced motion flight">
      <div className={styles.topbar}>
        <div className={styles.stageGroup}>
          <span className={styles.stageMark} aria-hidden="true" />
          <div><p className={styles.eyebrow}>Calm constellation</p><p className={styles.stage}>{stage}</p></div>
        </div>
        <div className={styles.controls}>
          <button type="button" className={styles.quietButton} onClick={onPassive}>Quiet mode</button>
          <button type="button" className={styles.dismissButton} onClick={onDismiss} aria-label="Dismiss activity">×</button>
        </div>
      </div>
      {gate && !terminal && (
        <div>
          <p className={styles.gateHeading}>Choose a constellation</p>
          <div className={styles.constellation} role="group" aria-label="Agent preference">
            {gate.options.map((option) => (
              <button
                key={option.optionId}
                className={`${styles.nodeOption} ${selectedOptionId === option.optionId ? styles.nodeSelected : ""}`}
                type="button"
                disabled={Boolean(selectedOptionId)}
                onClick={() => onChoose(option.optionId)}
                aria-pressed={selectedOptionId === option.optionId}
              >
                <span className={styles.optionLabel}>{option.label}</span>
                <span className={styles.optionDescription}>{optionDescriptions[option.optionId]}</span>
              </button>
            ))}
          </div>
          <div className={styles.feedbackRow}>
            <p className={styles.feedback} role="status" aria-live="polite">
              {selectedOptionId && !ackText ? <><span className={styles.pendingDot} aria-hidden="true" />Waiting for agent confirmation</> : ackText}
            </p>
            <button type="button" className={styles.skipButton} onClick={onSkip}>Skip choice</button>
          </div>
        </div>
      )}
    </section>
  );
}
