const canvas = document.getElementById("playfield");
const ctx = canvas.getContext("2d");
const tiltSlider = document.getElementById("tiltSlider");
const tiltReadout = document.getElementById("tiltReadout");
const scoreValue = document.getElementById("scoreValue");
const leftPad = document.getElementById("leftPad");
const rightPad = document.getElementById("rightPad");

const geometry = {
  width: canvas.width,
  height: canvas.height,
  centerX: canvas.width / 2,
  topY: canvas.height * 0.12,
  bottomY: canvas.height * 0.82,
  pocketRadius: 22,
  ballRadius: 14,
  railTopSpread: 34,
  railBottomSpread: 180,
  railTravel: 90,
};

const state = {
  score: 0,
  tilt: sliderValueToTilt(tiltSlider.value),
  leftOffset: 0,
  rightOffset: 0,
  leftPointer: null,
  rightPointer: null,
};

tiltReadout.textContent = `${Math.round(state.tilt)}°`;
tiltSlider.setAttribute("aria-valuenow", tiltSlider.value);

const ball = {
  y: 0,
  velocity: 0,
  state: "ready", // ready | falling | resetting
  fallY: 0,
  fallX: geometry.centerX,
  resetTimer: 0,
};

const timing = {
  lastTick: performance.now(),
  targetStep: 1000 / 60,
};

function sliderValueToTilt(sliderValue) {
  const minTilt = 8; // degrees
  const maxTilt = 28;
  const ratio = Number(sliderValue) / 100;
  return minTilt + (maxTilt - minTilt) * ratio;
}

function tiltToAcceleration(tiltDeg) {
  const gravityBase = 40; // pixels per second^2
  return gravityBase * Math.sin((tiltDeg * Math.PI) / 180);
}

function getRailX(yNorm, side) {
  const topSpread = geometry.railTopSpread;
  const bottomSpread = geometry.railBottomSpread;
  const leftControl = clamp(state.leftOffset, -geometry.railTravel, geometry.railTravel);
  const rightControl = clamp(state.rightOffset, -geometry.railTravel, geometry.railTravel);
  const leftTop = geometry.centerX - topSpread / 2 + leftControl * 0.18;
  const rightTop = geometry.centerX + topSpread / 2 + rightControl * 0.18;
  const leftBottom = geometry.centerX - bottomSpread / 2 + leftControl;
  const rightBottom = geometry.centerX + bottomSpread / 2 + rightControl;

  if (side === "left") {
    return leftTop + (leftBottom - leftTop) * yNorm;
  }
  return rightTop + (rightBottom - rightTop) * yNorm;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function updateTilt(value) {
  state.tilt = sliderValueToTilt(value);
  tiltReadout.textContent = `${Math.round(state.tilt)}°`;
  tiltSlider.setAttribute("aria-valuenow", String(value));
}

tiltSlider.addEventListener("input", (event) => {
  updateTilt(event.target.value);
});

tiltSlider.addEventListener("change", (event) => {
  updateTilt(event.target.value);
});

function normalisePointer(event, padElement) {
  const rect = padElement.getBoundingClientRect();
  const ratio = (event.clientX - rect.left) / rect.width;
  return clamp(ratio, 0, 1);
}

function bindTouchPad(padElement, side) {
  padElement.addEventListener("pointerdown", (event) => {
    padElement.setPointerCapture(event.pointerId);
    padElement.classList.add("is-active");
    if (side === "left") {
      state.leftPointer = event.pointerId;
      state.leftOffset = (normalisePointer(event, padElement) - 0.5) * 2 * geometry.railTravel;
    } else {
      state.rightPointer = event.pointerId;
      state.rightOffset = (normalisePointer(event, padElement) - 0.5) * 2 * geometry.railTravel;
    }
  });

  padElement.addEventListener("pointermove", (event) => {
    if (side === "left" && state.leftPointer !== event.pointerId) return;
    if (side === "right" && state.rightPointer !== event.pointerId) return;
    const normalized = normalisePointer(event, padElement);
    const offset = (normalized - 0.5) * 2 * geometry.railTravel;
    if (side === "left") {
      state.leftOffset = offset;
    } else {
      state.rightOffset = offset;
    }
  });

  padElement.addEventListener("pointerup", (event) => {
    if (side === "left" && state.leftPointer === event.pointerId) {
      state.leftPointer = null;
    }
    if (side === "right" && state.rightPointer === event.pointerId) {
      state.rightPointer = null;
    }
    padElement.classList.remove("is-active");
  });

  padElement.addEventListener("pointercancel", () => {
    if (side === "left") {
      state.leftPointer = null;
    } else {
      state.rightPointer = null;
    }
    padElement.classList.remove("is-active");
  });
}

bindTouchPad(leftPad, "left");
bindTouchPad(rightPad, "right");

function resetBall() {
  ball.y = 0;
  ball.velocity = 0;
  ball.state = "ready";
  ball.fallY = geometry.topY;
  ball.fallX = geometry.centerX;
  ball.resetTimer = 0;
}

function startScoreSequence() {
  state.score += 1;
  scoreValue.textContent = state.score;
  const exitX =
    (getRailX(1, "left") + getRailX(1, "right")) / 2;
  ball.state = "falling";
  ball.fallX = exitX;
  ball.fallY = geometry.bottomY + geometry.ballRadius;
  ball.velocity = 0;
}

function updatePhysics(dt) {
  const dtSeconds = dt / 1000;
  const accelDown = tiltToAcceleration(state.tilt);
  const yNorm = clamp(ball.y, 0, 1);
  const leftX = getRailX(yNorm, "left");
  const rightX = getRailX(yNorm, "right");
  const gap = rightX - leftX - geometry.ballRadius * 2;

  if (ball.state === "ready") {
    const openingThreshold = geometry.ballRadius * 0.6;
    if (gap > openingThreshold) {
      ball.velocity += accelDown * dtSeconds;
    } else {
      // Rails squeezing - encourage the ball to travel upward
      ball.velocity -= accelDown * 1.15 * dtSeconds;
    }

    ball.velocity *= 0.985;
    ball.y += (ball.velocity / (geometry.bottomY - geometry.topY)) * dtSeconds;

    if (ball.y < 0) {
      ball.y = 0;
      ball.velocity = 0;
    }

    if (ball.y > 1) {
      ball.y = 1;
    }

    const exitGap = rightX - leftX - geometry.ballRadius * 2;
    if (ball.y >= 0.995 && exitGap > geometry.ballRadius * 0.8) {
      startScoreSequence();
    }

    if (ball.y > 0 && gap < geometry.ballRadius * 0.4 && ball.velocity > 0) {
      // When the gap narrows significantly the ball reverses course.
      ball.velocity = Math.min(ball.velocity, 0);
    }
  } else if (ball.state === "falling") {
    ball.fallY += (accelDown * 1.6) * dtSeconds;
    if (ball.fallY > geometry.height + geometry.ballRadius * 2) {
      ball.state = "resetting";
      ball.resetTimer = 1.2; // seconds
    }
  } else if (ball.state === "resetting") {
    ball.resetTimer -= dtSeconds;
    if (ball.resetTimer <= 0) {
      resetBall();
    }
  }
}

function drawRails() {
  const gradient = ctx.createLinearGradient(0, geometry.topY, 0, geometry.bottomY);
  gradient.addColorStop(0, "rgba(120, 160, 255, 0.9)");
  gradient.addColorStop(1, "rgba(70, 110, 220, 0.7)");

  ctx.lineWidth = 12;
  ctx.lineCap = "round";

  ctx.strokeStyle = gradient;
  ctx.shadowColor = "rgba(0,0,0,0.45)";
  ctx.shadowBlur = 16;

  ctx.beginPath();
  ctx.moveTo(getRailX(0, "left"), geometry.topY);
  ctx.lineTo(getRailX(1, "left"), geometry.bottomY);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(getRailX(0, "right"), geometry.topY);
  ctx.lineTo(getRailX(1, "right"), geometry.bottomY);
  ctx.stroke();

  ctx.shadowBlur = 0;
}

function drawBall() {
  if (ball.state === "falling") {
    return;
  }
  const yPos = geometry.topY + (geometry.bottomY - geometry.topY) * clamp(ball.y, 0, 1);
  const xLeft = getRailX(clamp(ball.y, 0, 1), "left");
  const xRight = getRailX(clamp(ball.y, 0, 1), "right");
  const xPos = (xLeft + xRight) / 2;

  ctx.beginPath();
  ctx.fillStyle = "#ffffff";
  ctx.shadowColor = "rgba(255,255,255,0.6)";
  ctx.shadowBlur = 12;
  ctx.arc(xPos, yPos, geometry.ballRadius, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
}

function drawFallingBall() {
  ctx.beginPath();
  ctx.fillStyle = "#ffffff";
  ctx.shadowColor = "rgba(255,255,255,0.6)";
  ctx.shadowBlur = 12;
  ctx.arc(ball.fallX, ball.fallY, geometry.ballRadius, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
}

function drawScoringPockets() {
  const pocketLabels = [
    { name: "Mercury", offset: -84 },
    { name: "Earth", offset: -42 },
    { name: "Mars", offset: 0 },
    { name: "Jupiter", offset: 42 },
    { name: "Saturn", offset: 84 },
    { name: "Pluto", offset: 0, bottom: true },
  ];

  ctx.save();
  ctx.translate(geometry.centerX, geometry.bottomY + geometry.pocketRadius * 1.8);

  pocketLabels.forEach((pocket, index) => {
    const radius = pocket.bottom ? geometry.pocketRadius + 6 : geometry.pocketRadius;
    const y = pocket.bottom ? geometry.pocketRadius * 2 + 10 : index * 22;
    const x = pocket.offset;

    ctx.beginPath();
    ctx.fillStyle = pocket.bottom ? "rgba(255, 220, 120, 0.35)" : "rgba(120, 180, 255, 0.25)";
    ctx.strokeStyle = "rgba(200, 220, 255, 0.45)";
    ctx.lineWidth = 2;
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "rgba(240, 250, 255, 0.9)";
    ctx.font = "12px Rajdhani";
    ctx.textAlign = "center";
    ctx.fillText(pocket.name, x, y + radius + 12);
  });

  ctx.restore();
}

function render() {
  ctx.clearRect(0, 0, geometry.width, geometry.height);
  drawScoringPockets();
  drawRails();
  drawBall();
  if (ball.state === "falling") {
    drawFallingBall();
  }
}

function loop(now) {
  const delta = now - timing.lastTick;
  timing.lastTick = now;

  updatePhysics(delta);
  render();

  requestAnimationFrame(loop);
}

resetBall();
requestAnimationFrame(loop);

window.addEventListener("resize", () => {
  // keep slider feedback accurate during orientation changes
  updateTilt(tiltSlider.value);
});
