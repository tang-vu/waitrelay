import { createSeededRng, seededBetween } from "../seeded-rng";

export type FlightIntent = "upper" | "lower" | "neutral";

export type FlightParticle = {
  x: number;
  y: number;
  radius: number;
  speed: number;
  phase: number;
  brightness: number;
};

export type FlightStar = {
  x: number;
  y: number;
  radius: number;
  phase: number;
};

export type FlightEngineState = {
  elapsed: number;
  sceneryElapsed: number;
  birdY: number;
  birdVelocity: number;
  wingPhase: number;
  worldOffset: number;
  intent: FlightIntent;
  terminal: boolean;
  ghostPhase: number;
  ghostAmplitude: number;
  particles: FlightParticle[];
  stars: FlightStar[];
};

export function createFlightEngine(seed: string): FlightEngineState {
  const rng = createSeededRng(seed);
  const particles = Array.from({ length: 34 }, () => ({
    x: rng(),
    y: rng(),
    radius: seededBetween(rng, 0.8, 2.4),
    speed: seededBetween(rng, 0.018, 0.055),
    phase: seededBetween(rng, 0, Math.PI * 2),
    brightness: seededBetween(rng, 0.25, 0.85),
  }));
  const stars = Array.from({ length: 52 }, () => ({
    x: rng(),
    y: rng() * 0.88,
    radius: seededBetween(rng, 0.35, 1.45),
    phase: seededBetween(rng, 0, Math.PI * 2),
  }));

  return {
    elapsed: 0,
    sceneryElapsed: 0,
    birdY: 0.5,
    birdVelocity: 0,
    wingPhase: 0,
    worldOffset: 0,
    intent: "neutral",
    terminal: false,
    ghostPhase: seededBetween(rng, 0, Math.PI * 2),
    ghostAmplitude: seededBetween(rng, 0.08, 0.16),
    particles,
    stars,
  };
}

export function updateFlightEngine(
  state: FlightEngineState,
  deltaSeconds: number,
): FlightEngineState {
  const delta = Math.min(Math.max(deltaSeconds, 0), 0.05);
  const targetY = state.intent === "upper" ? 0.31 : state.intent === "lower" ? 0.69 : 0.5;
  const spring = (targetY - state.birdY) * 10.5;
  const damping = state.birdVelocity * 5.8;
  const birdVelocity = state.birdVelocity + (spring - damping) * delta;
  const birdY = Math.min(0.82, Math.max(0.18, state.birdY + birdVelocity * delta));

  for (const particle of state.particles) {
    particle.x -= particle.speed * delta * (state.terminal ? 0.35 : 1);
    if (particle.x < -0.03) particle.x = 1.03;
  }

  return {
    ...state,
    elapsed: state.elapsed + delta,
    sceneryElapsed: state.sceneryElapsed + (state.terminal || !Number.isFinite(deltaSeconds) ? 0 : Math.max(0, deltaSeconds)),
    birdY,
    birdVelocity,
    wingPhase: state.wingPhase + delta * (state.terminal ? 2.2 : 6.4),
    worldOffset: state.worldOffset + delta * (state.terminal ? 0.012 : 0.045),
  };
}

export function setFlightIntent(state: FlightEngineState, intent: FlightIntent): void {
  state.intent = intent;
}

export function setFlightTerminal(state: FlightEngineState, terminal: boolean): void {
  state.terminal = terminal;
}
