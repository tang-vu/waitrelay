import type { FlightEngineState } from "../engine/flight-engine";

export type FlightRenderStage =
  | "understanding"
  | "gathering"
  | "evaluating"
  | "composing"
  | "verifying";

export type FlightRenderOptions = {
  stage: FlightRenderStage;
  gateVisible: boolean;
  selectedLane?: "upper" | "lower";
  acknowledged?: boolean;
  terminal: boolean;
  ghostVisible: boolean;
};

const palettes: Record<FlightRenderStage, [string, string, string]> = {
  understanding: ["#071225", "#142c4e", "#8dd8d2"],
  gathering: ["#08152d", "#18365a", "#85cde9"],
  evaluating: ["#0d1230", "#312858", "#d3a6eb"],
  composing: ["#11122b", "#44315b", "#f0b4ce"],
  verifying: ["#081726", "#174352", "#9de4c4"],
};

function drawAurora(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  state: FlightEngineState,
  accent: string,
): void {
  context.save();
  context.globalCompositeOperation = "screen";
  for (let ribbon = 0; ribbon < 3; ribbon += 1) {
    const gradient = context.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, "rgba(0,0,0,0)");
    gradient.addColorStop(0.45, `${accent}${ribbon === 1 ? "35" : "20"}`);
    gradient.addColorStop(1, "rgba(0,0,0,0)");
    context.strokeStyle = gradient;
    context.lineWidth = height * (0.11 + ribbon * 0.028);
    context.filter = "blur(24px)";
    context.beginPath();
    const vertical = height * (0.25 + ribbon * 0.14);
    context.moveTo(-width * 0.1, vertical);
    context.bezierCurveTo(
      width * 0.25,
      vertical + Math.sin(state.elapsed * 0.35 + ribbon) * 34,
      width * 0.62,
      vertical - 58,
      width * 1.12,
      vertical + 34,
    );
    context.stroke();
  }
  context.restore();
}

function drawClouds(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  state: FlightEngineState,
): void {
  context.save();
  context.filter = "blur(13px)";
  for (let layer = 0; layer < 3; layer += 1) {
    const offset = ((state.worldOffset * (0.38 + layer * 0.2) + layer * 0.37) % 1.35) * width;
    context.fillStyle = `rgba(157, 189, 211, ${0.035 + layer * 0.025})`;
    for (let cloud = -1; cloud < 3; cloud += 1) {
      const x = cloud * width * 0.54 - offset;
      const y = height * (0.2 + layer * 0.26);
      context.beginPath();
      context.ellipse(x, y, width * 0.23, height * 0.09, -0.12, 0, Math.PI * 2);
      context.ellipse(x + width * 0.13, y + height * 0.02, width * 0.19, height * 0.07, 0.1, 0, Math.PI * 2);
      context.fill();
    }
  }
  context.restore();
}

function drawCurrents(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  state: FlightEngineState,
  selectedLane?: "upper" | "lower",
  acknowledged?: boolean,
): void {
  const lanes = [0.31, 0.69] as const;
  context.save();
  context.globalCompositeOperation = "screen";
  lanes.forEach((lane, index) => {
    const isSelected = selectedLane === (index === 0 ? "upper" : "lower");
    const laneColor = index === 0 ? "126, 213, 229" : "213, 167, 236";
    context.strokeStyle = `rgba(${laneColor}, ${isSelected ? (acknowledged ? 0.9 : 0.65) : 0.25})`;
    context.lineWidth = isSelected ? 3.2 : 1.5;
    context.setLineDash(isSelected && !acknowledged ? [8, 10] : []);
    context.lineDashOffset = -state.elapsed * 25;
    context.beginPath();
    context.moveTo(width * 0.08, height * lane);
    context.bezierCurveTo(
      width * 0.35,
      height * (lane - 0.07),
      width * 0.72,
      height * (lane + 0.08),
      width * 1.04,
      height * lane,
    );
    context.stroke();

    for (let mote = 0; mote < 8; mote += 1) {
      const x = ((mote / 8 + state.worldOffset * 0.45 + index * 0.08) % 1) * width;
      const y = height * lane + Math.sin(mote * 1.7 + state.elapsed) * height * 0.035;
      context.fillStyle = `rgba(${laneColor}, ${isSelected ? 0.78 : 0.36})`;
      context.beginPath();
      context.arc(x, y, isSelected ? 2.3 : 1.4, 0, Math.PI * 2);
      context.fill();
    }
  });
  context.restore();
}

function drawBird(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  state: FlightEngineState,
): void {
  const x = width * 0.27;
  const y = height * state.birdY;
  const scale = Math.min(width, height) / 360;
  const flap = Math.sin(state.wingPhase) * 8 * scale;

  context.save();
  context.translate(x, y);
  context.shadowColor = "rgba(152, 239, 232, 0.78)";
  context.shadowBlur = 20 * scale;

  const bodyGradient = context.createLinearGradient(-28 * scale, -18 * scale, 34 * scale, 20 * scale);
  bodyGradient.addColorStop(0, "#f8ffff");
  bodyGradient.addColorStop(0.55, "#bcebea");
  bodyGradient.addColorStop(1, "#799fbe");
  context.fillStyle = bodyGradient;

  context.beginPath();
  context.moveTo(-34 * scale, 2 * scale);
  context.lineTo(9 * scale, -13 * scale);
  context.lineTo(36 * scale, -2 * scale);
  context.lineTo(8 * scale, 7 * scale);
  context.lineTo(-9 * scale, 17 * scale);
  context.closePath();
  context.fill();

  context.fillStyle = "rgba(192, 236, 239, 0.92)";
  context.beginPath();
  context.moveTo(-8 * scale, 2 * scale);
  context.lineTo(-19 * scale, (-31 - flap) * scale);
  context.lineTo(18 * scale, -8 * scale);
  context.closePath();
  context.fill();

  context.fillStyle = "rgba(114, 168, 195, 0.86)";
  context.beginPath();
  context.moveTo(-8 * scale, 4 * scale);
  context.lineTo(-18 * scale, (30 + flap * 0.55) * scale);
  context.lineTo(18 * scale, 7 * scale);
  context.closePath();
  context.fill();

  context.strokeStyle = "rgba(255,255,255,0.64)";
  context.lineWidth = Math.max(0.8, scale);
  context.beginPath();
  context.moveTo(-8 * scale, 2 * scale);
  context.lineTo(17 * scale, -7 * scale);
  context.moveTo(-8 * scale, 2 * scale);
  context.lineTo(15 * scale, 7 * scale);
  context.stroke();

  context.fillStyle = "#d9fff8";
  context.beginPath();
  context.arc(19 * scale, -4 * scale, 1.8 * scale, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

function drawSeedGhost(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  state: FlightEngineState,
): void {
  const x = width * (0.57 + Math.sin(state.elapsed * 0.22 + state.ghostPhase) * 0.025);
  const y = height * (0.5 + Math.sin(state.elapsed * 0.58 + state.ghostPhase) * state.ghostAmplitude);
  const scale = Math.min(width, height) / 520;
  context.save();
  context.globalCompositeOperation = "screen";
  context.setLineDash([3, 9]);
  context.strokeStyle = "rgba(187, 179, 255, 0.2)";
  context.lineWidth = 1;
  context.beginPath();
  context.moveTo(width * 0.31, y);
  context.bezierCurveTo(width * 0.38, y - height * 0.04, width * 0.48, y + height * 0.04, x, y);
  context.stroke();
  context.setLineDash([]);
  context.translate(x, y);
  context.fillStyle = "rgba(197, 225, 240, 0.17)";
  context.strokeStyle = "rgba(220, 210, 255, 0.35)";
  context.lineWidth = 1;
  context.beginPath();
  context.moveTo(-25 * scale, 1 * scale);
  context.lineTo(5 * scale, -11 * scale);
  context.lineTo(27 * scale, -1 * scale);
  context.lineTo(5 * scale, 7 * scale);
  context.lineTo(-8 * scale, 13 * scale);
  context.closePath();
  context.fill();
  context.stroke();
  context.restore();
}

function drawPortal(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  state: FlightEngineState,
): void {
  const x = width * 0.74;
  const y = height * state.birdY;
  const radius = Math.min(width, height) * (0.09 + Math.min(0.05, state.elapsed % 1 * 0.012));
  context.save();
  context.globalCompositeOperation = "screen";
  context.translate(x, y);
  for (let ring = 0; ring < 4; ring += 1) {
    context.strokeStyle = `rgba(166, 244, 224, ${0.52 - ring * 0.09})`;
    context.lineWidth = 2.4 - ring * 0.35;
    context.beginPath();
    context.ellipse(0, 0, radius * (0.5 + ring * 0.14), radius * (1 + ring * 0.12), state.elapsed * 0.08, 0, Math.PI * 2);
    context.stroke();
  }
  context.restore();
}

export function renderFlight(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  state: FlightEngineState,
  options: FlightRenderOptions,
): void {
  const [top, bottom, accent] = palettes[options.stage];
  const sky = context.createLinearGradient(0, 0, width, height);
  sky.addColorStop(0, top);
  sky.addColorStop(0.58, bottom);
  sky.addColorStop(1, "#060c1c");
  context.fillStyle = sky;
  context.fillRect(0, 0, width, height);

  drawAurora(context, width, height, state, accent);

  for (const star of state.stars) {
    const brightness = 0.24 + (Math.sin(state.elapsed * 0.7 + star.phase) + 1) * 0.2;
    context.fillStyle = `rgba(224, 245, 255, ${brightness})`;
    context.beginPath();
    context.arc(star.x * width, star.y * height, star.radius, 0, Math.PI * 2);
    context.fill();
  }

  drawClouds(context, width, height, state);
  if (options.gateVisible && !options.terminal) {
    drawCurrents(context, width, height, state, options.selectedLane, options.acknowledged);
  }

  for (const particle of state.particles) {
    const flicker = 0.58 + Math.sin(state.elapsed * 1.6 + particle.phase) * 0.26;
    context.fillStyle = `rgba(185, 238, 239, ${particle.brightness * flicker})`;
    context.beginPath();
    context.arc(particle.x * width, particle.y * height, particle.radius, 0, Math.PI * 2);
    context.fill();
  }

  if (options.terminal) drawPortal(context, width, height, state);
  if (options.ghostVisible && !options.terminal) drawSeedGhost(context, width, height, state);
  drawBird(context, width, height, state);
}
