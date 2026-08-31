"use client";

import styles from "./flight.module.css";

export type PassiveExperienceProps = {
  stage: string;
  compact?: boolean;
  onResume?: () => void;
  onDismiss?: () => void;
};

function titleCase(value: string): string {
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}

export function PassiveExperience({ stage, compact = false, onResume, onDismiss }: PassiveExperienceProps) {
  return (
    <section
      className={compact ? styles.instant : styles.passive}
      aria-label={compact ? "Agent activity" : "Passive flight activity"}
      data-flight-mode={compact ? "instant" : "passive"}
    >
      <div className={styles.passiveCopy}>
        <span className={styles.miniBird} aria-hidden="true" />
        <div>
          <p className={styles.eyebrow}>WaitRelay</p>
          <p className={styles.stage} aria-live="polite">{titleCase(stage)}</p>
        </div>
      </div>
      {!compact && (
        <div className={styles.passiveActions}>
          {onResume && <button className={styles.resumeButton} type="button" onClick={onResume}>Open flight</button>}
          {onDismiss && <button className={styles.dismissButton} type="button" onClick={onDismiss} aria-label="Dismiss activity">×</button>}
        </div>
      )}
    </section>
  );
}
