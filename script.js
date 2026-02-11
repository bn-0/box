const APP_VERSION_DATE = '2026-02-11';

const canvas = document.getElementById('ladderCanvas');
const ctx = canvas.getContext('2d');

const nameInput = document.getElementById('nameInput');
const resultInput = document.getElementById('resultInput');
const topLabels = document.getElementById('topLabels');
const bottomLabels = document.getElementById('bottomLabels');
const ladderStage = document.getElementById('ladderStage');
const complexityRange = document.getElementById('complexityRange');
const complexityValue = document.getElementById('complexityValue');
const speedRange = document.getElementById('speedRange');
const speedValue = document.getElementById('speedValue');
const statusText = document.getElementById('status');
const versionInfo = document.getElementById('versionInfo');

const state = {
  names: ['민수', '지연', '하늘', '도윤'],
  results: ['커피', '꽝', '점심', '당첨'],
  complexity: Number(complexityRange.value),
  animationSpeed: Number(speedRange.value),
  lineX: [],
  rows: [],
  rowY: [],
  mapping: [],
  animationToken: 0,
  boardPaddingX: 40,
};

function normalizeList(rawText, prefix) {
  return rawText
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value, index) => value || `${prefix}${index + 1}`);
}

function syncCounts() {
  const count = Math.max(state.names.length, state.results.length, 2);
  while (state.names.length < count) {
    state.names.push(`참가자${state.names.length + 1}`);
  }
  while (state.results.length < count) {
    state.results.push(`결과${state.results.length + 1}`);
  }
}

function updateCanvasWidth() {
  const count = state.names.length;
  const minSpacing = 120;
  const desiredWidth = Math.max(940, state.boardPaddingX * 2 + (count - 1) * minSpacing);
  canvas.width = desiredWidth;
  ladderStage.style.width = `${desiredWidth}px`;
}

function setGridColumns() {
  const count = state.names.length;
  if (count <= 1) {
    const columns = '1fr';
    topLabels.style.gridTemplateColumns = columns;
    bottomLabels.style.gridTemplateColumns = columns;
    return;
  }

  const tracks = [];
  const leftPad = Math.max(0, state.lineX[0] - state.boardPaddingX);
  const rightPad = Math.max(0, canvas.width - state.lineX[count - 1] - state.boardPaddingX);

  tracks.push(`${leftPad + state.boardPaddingX}px`);
  for (let i = 0; i < count - 1; i += 1) {
    tracks.push(`${state.lineX[i + 1] - state.lineX[i]}px`);
  }
  tracks.push(`${rightPad + state.boardPaddingX}px`);

  const template = tracks.join(' ');
  topLabels.style.gridTemplateColumns = template;
  bottomLabels.style.gridTemplateColumns = template;
}

function renderLabels(activeTopIndex = -1, activeBottomIndex = -1) {
  setGridColumns();
  topLabels.innerHTML = '';
  bottomLabels.innerHTML = '';

  const makeSpacer = () => {
    const span = document.createElement('div');
    span.className = 'label-spacer';
    return span;
  };

  topLabels.appendChild(makeSpacer());
  state.names.forEach((name, index) => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'label-chip interactive';
    if (index === activeTopIndex) chip.classList.add('active');
    chip.textContent = name;
    chip.addEventListener('click', () => {
      animatePath(index, state.mapping[index]);
    });
    topLabels.appendChild(chip);
  });
  topLabels.appendChild(makeSpacer());

  bottomLabels.appendChild(makeSpacer());
  state.results.forEach((result, index) => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'label-chip interactive';
    if (index === activeBottomIndex) chip.classList.add('active');
    chip.textContent = result;
    chip.addEventListener('click', () => {
      const topIndex = state.mapping.findIndex((value) => value === index);
      if (topIndex >= 0) {
        animatePath(topIndex, index);
      }
    });
    bottomLabels.appendChild(chip);
  });
  bottomLabels.appendChild(makeSpacer());
}

function ensureEachLineConnected() {
  const count = state.names.length;
  const usage = Array.from({ length: count }, () => 0);

  state.rows.forEach((row) => {
    row.forEach((connected, i) => {
      if (!connected) return;
      usage[i] += 1;
      usage[i + 1] += 1;
    });
  });

  for (let line = 0; line < count; line += 1) {
    if (usage[line] > 0) continue;

    const candidatePairs = [];
    if (line > 0) candidatePairs.push(line - 1);
    if (line < count - 1) candidatePairs.push(line);

    let connected = false;
    for (const pairIndex of candidatePairs) {
      for (let rowIndex = 0; rowIndex < state.rows.length; rowIndex += 1) {
        const row = state.rows[rowIndex];
        const leftConflict = pairIndex > 0 && row[pairIndex - 1];
        const rightConflict = pairIndex < row.length - 1 && row[pairIndex + 1];
        if (!row[pairIndex] && !leftConflict && !rightConflict) {
          row[pairIndex] = true;
          usage[pairIndex] += 1;
          usage[pairIndex + 1] += 1;
          connected = true;
          break;
        }
      }
      if (connected) break;
    }

    if (!connected) {
      const forcedPair = candidatePairs[0] ?? 0;
      const row = state.rows[Math.floor(Math.random() * state.rows.length)];
      row[forcedPair] = true;
      usage[forcedPair] += 1;
      usage[forcedPair + 1] += 1;
    }
  }
}

function createLayoutData() {
  const w = canvas.width;
  const h = canvas.height;
  const count = state.names.length;
  const topPadding = 42;
  const bottomPadding = 42;
  const usableHeight = h - topPadding - bottomPadding;
  const spacing = (w - state.boardPaddingX * 2) / (count - 1);

  state.lineX = Array.from({ length: count }, (_, i) => state.boardPaddingX + i * spacing);

  const rows = state.complexity * 8 + 8;
  const rowGap = usableHeight / rows;
  state.rowY = Array.from({ length: rows }, (_, i) => topPadding + i * rowGap);

  state.rows = state.rowY.map(() => {
    const row = [];
    let previousConnected = false;
    for (let i = 0; i < count - 1; i += 1) {
      const probability = 0.08 + state.complexity * 0.05;
      const connected = !previousConnected && Math.random() < probability;
      row.push(connected);
      previousConnected = connected;
    }
    return row;
  });

  ensureEachLineConnected();
}

function getNextLineIndex(currentIndex, row) {
  if (currentIndex > 0 && row[currentIndex - 1]) {
    return currentIndex - 1;
  }
  if (currentIndex < row.length && row[currentIndex]) {
    return currentIndex + 1;
  }
  return currentIndex;
}

function buildMapping() {
  const finalPositions = [];
  for (let start = 0; start < state.names.length; start += 1) {
    let pos = start;
    state.rows.forEach((row) => {
      pos = getNextLineIndex(pos, row);
    });
    finalPositions.push(pos);
  }
  state.mapping = finalPositions;
}

function drawBaseLadder() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.lineWidth = 2;
  ctx.strokeStyle = '#111827';
  state.lineX.forEach((x) => {
    ctx.beginPath();
    ctx.moveTo(x, 24);
    ctx.lineTo(x, canvas.height - 24);
    ctx.stroke();
  });

  ctx.strokeStyle = '#475569';
  state.rowY.forEach((y, rowIndex) => {
    const row = state.rows[rowIndex];
    row.forEach((connected, i) => {
      if (!connected) return;
      ctx.beginPath();
      ctx.moveTo(state.lineX[i], y);
      ctx.lineTo(state.lineX[i + 1], y);
      ctx.stroke();
    });
  });
}

function buildPathSegments(startIndex) {
  const segments = [];
  let currentLine = startIndex;
  let currentY = 24;

  state.rows.forEach((row, rowIndex) => {
    const y = state.rowY[rowIndex];
    segments.push({ x1: state.lineX[currentLine], y1: currentY, x2: state.lineX[currentLine], y2: y });
    const next = getNextLineIndex(currentLine, row);
    if (next !== currentLine) {
      segments.push({ x1: state.lineX[currentLine], y1: y, x2: state.lineX[next], y2: y });
      currentLine = next;
    }
    currentY = y;
  });

  segments.push({
    x1: state.lineX[currentLine],
    y1: currentY,
    x2: state.lineX[currentLine],
    y2: canvas.height - 24,
  });

  return segments;
}

function segmentLength(segment) {
  const dx = segment.x2 - segment.x1;
  const dy = segment.y2 - segment.y1;
  return Math.hypot(dx, dy);
}

function drawPathPartial(segments, progress) {
  drawBaseLadder();
  ctx.strokeStyle = '#ef4444';
  ctx.lineWidth = 4;

  let remaining = progress;
  for (const segment of segments) {
    const len = segmentLength(segment);
    if (remaining <= 0) break;

    const ratio = Math.min(1, remaining / len);
    ctx.beginPath();
    ctx.moveTo(segment.x1, segment.y1);
    ctx.lineTo(
      segment.x1 + (segment.x2 - segment.x1) * ratio,
      segment.y1 + (segment.y2 - segment.y1) * ratio,
    );
    ctx.stroke();

    remaining -= len;
  }
}

function animatePath(topIndex, expectedBottom) {
  const token = ++state.animationToken;
  const segments = buildPathSegments(topIndex);
  const totalLength = segments.reduce((sum, segment) => sum + segmentLength(segment), 0);
  const speed = 3 + state.animationSpeed * 1.2;

  let progress = 0;
  renderLabels(topIndex, expectedBottom);

  function step() {
    if (token !== state.animationToken) return;

    progress += speed;
    drawPathPartial(segments, progress);

    if (progress < totalLength) {
      requestAnimationFrame(step);
    } else {
      drawPathPartial(segments, totalLength);
      const finalResult = state.results[expectedBottom];
      statusText.textContent = `${state.names[topIndex]} → ${finalResult}`;
    }
  }

  statusText.textContent = `${state.names[topIndex]} 경로를 추적 중...`;
  requestAnimationFrame(step);
}

function skipAnimation() {
  state.animationToken += 1;
  drawBaseLadder();
  statusText.textContent = '애니메이션을 스킵했습니다.';
  renderLabels();
}

function refreshInputs() {
  nameInput.value = state.names.join(',');
  resultInput.value = state.results.join(',');
}

function regenerateLadder(message = '사다리를 생성했습니다.') {
  state.animationToken += 1;
  syncCounts();
  updateCanvasWidth();
  createLayoutData();
  buildMapping();
  drawBaseLadder();
  renderLabels();
  refreshInputs();
  statusText.textContent = message;
}

function applyNames() {
  const names = normalizeList(nameInput.value, '참가자');
  if (names.length < 2) {
    statusText.textContent = '최소 2명 이상의 이름을 입력해주세요.';
    return;
  }
  state.names = names;
  regenerateLadder('이름을 적용하고 사다리를 새로 만들었습니다.');
}

function applyResults() {
  const results = normalizeList(resultInput.value, '결과');
  if (results.length < 2) {
    statusText.textContent = '최소 2개 이상의 결과를 입력해주세요.';
    return;
  }
  state.results = results;
  regenerateLadder('결과를 적용하고 사다리를 새로 만들었습니다.');
}

function addPerson() {
  state.names.push(`참가자${state.names.length + 1}`);
  state.results.push(`결과${state.results.length + 1}`);
  regenerateLadder('인원을 1명 늘렸습니다.');
}

complexityRange.addEventListener('input', (event) => {
  state.complexity = Number(event.target.value);
  complexityValue.textContent = String(state.complexity);
});

speedRange.addEventListener('input', (event) => {
  state.animationSpeed = Number(event.target.value);
  speedValue.textContent = String(state.animationSpeed);
});

document.getElementById('applyNamesBtn').addEventListener('click', applyNames);
document.getElementById('applyResultsBtn').addEventListener('click', applyResults);
document.getElementById('generateBtn').addEventListener('click', () => regenerateLadder('사다리를 다시 만들었습니다.'));
document.getElementById('addPersonBtn').addEventListener('click', addPerson);
document.getElementById('skipBtn').addEventListener('click', skipAnimation);

window.addEventListener('resize', () => {
  drawBaseLadder();
  renderLabels();
});

versionInfo.textContent = `버전(업데이트): ${APP_VERSION_DATE}`;
regenerateLadder('이름/결과를 입력하고 적용을 눌러 시작해보세요.');
