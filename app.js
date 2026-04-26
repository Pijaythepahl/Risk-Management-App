const STORAGE_KEY = "risk-board-risks";
const THRESHOLD_KEY = "risk-board-threshold";
const DEFAULT_THRESHOLD = 12;
const MAX_RISKS = 20;

const statuses = ["Open", "Mitigating", "Accepted", "Closed"];
const probabilityLabels = [
  { value: 5, label: "Almost Certain" },
  { value: 4, label: "Likely" },
  { value: 3, label: "Possible" },
  { value: 2, label: "Unlikely" },
  { value: 1, label: "Rare" }
];
const impactLabels = [
  { value: 1, label: "Negligible" },
  { value: 2, label: "Minor" },
  { value: 3, label: "Significant" },
  { value: 4, label: "Severe" },
  { value: 5, label: "Catastrophic" }
];
const appetiteThresholds = [4, 8, 12, 16, 20, 25];
const markerOffsets = [
  { x: -9, y: -9 },
  { x: 9, y: -9 },
  { x: -9, y: 9 },
  { x: 9, y: 9 },
  { x: 0, y: -13 },
  { x: 0, y: 13 },
  { x: -13, y: 0 },
  { x: 13, y: 0 }
];

const elements = {
  thresholdInput: document.querySelector("#thresholdInput"),
  totalRisks: document.querySelector("#totalRisks"),
  highRisks: document.querySelector("#highRisks"),
  acceptableRisks: document.querySelector("#acceptableRisks"),
  overdueRisks: document.querySelector("#overdueRisks"),
  averageScore: document.querySelector("#averageScore"),
  heatmap: document.querySelector("#heatmap"),
  heatmapArrows: document.querySelector("#heatmapArrows"),
  heatmapMarkers: document.querySelector("#heatmapMarkers"),
  probabilityScale: document.querySelector("#probabilityScale"),
  impactScale: document.querySelector("#impactScale"),
  statusFilter: document.querySelector("#statusFilter"),
  categoryFilter: document.querySelector("#categoryFilter"),
  acceptabilityFilter: document.querySelector("#acceptabilityFilter"),
  sortSelect: document.querySelector("#sortSelect"),
  exportButton: document.querySelector("#exportButton"),
  importInput: document.querySelector("#importInput"),
  riskList: document.querySelector("#riskList"),
  visibleCount: document.querySelector("#visibleCount"),
  emptyState: document.querySelector("#emptyState"),
  newRiskButton: document.querySelector("#newRiskButton"),
  emptyAddButton: document.querySelector("#emptyAddButton"),
  riskDialog: document.querySelector("#riskDialog"),
  riskForm: document.querySelector("#riskForm"),
  dialogTitle: document.querySelector("#dialogTitle"),
  closeDialogButton: document.querySelector("#closeDialogButton"),
  cancelButton: document.querySelector("#cancelButton"),
  deleteRiskButton: document.querySelector("#deleteRiskButton"),
  riskId: document.querySelector("#riskId"),
  titleInput: document.querySelector("#titleInput"),
  descriptionInput: document.querySelector("#descriptionInput"),
  categoryInput: document.querySelector("#categoryInput"),
  categorySuggestions: document.querySelector("#categorySuggestions"),
  statusInput: document.querySelector("#statusInput"),
  probabilityInput: document.querySelector("#probabilityInput"),
  impactInput: document.querySelector("#impactInput"),
  probabilityValue: document.querySelector("#probabilityValue"),
  impactValue: document.querySelector("#impactValue"),
  riskScorePreview: document.querySelector("#riskScorePreview"),
  mitigationInput: document.querySelector("#mitigationInput"),
  dueDateInput: document.querySelector("#dueDateInput"),
  residualProbabilityInput: document.querySelector("#residualProbabilityInput"),
  residualImpactInput: document.querySelector("#residualImpactInput"),
  residualProbabilityValue: document.querySelector("#residualProbabilityValue"),
  residualImpactValue: document.querySelector("#residualImpactValue"),
  residualScorePreview: document.querySelector("#residualScorePreview")
};

let risks = loadRisks();
let threshold = loadThreshold();

function loadRisks() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(saved) ? saved.slice(0, MAX_RISKS).map(normalizeRisk) : [];
  } catch {
    return [];
  }
}

function loadThreshold() {
  const saved = localStorage.getItem(THRESHOLD_KEY);
  if (saved === null) return DEFAULT_THRESHOLD;
  return clampScore(saved, 1, 25);
}

function saveRisks() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(risks));
}

function saveThreshold() {
  localStorage.setItem(THRESHOLD_KEY, String(threshold));
}

function clampScore(value, min = 1, max = 5) {
  const number = Number(value);
  if (!Number.isFinite(number)) return min;
  return Math.min(max, Math.max(min, Math.round(number)));
}

function normalizeRisk(risk) {
  return {
    id: String(risk.id || createId()),
    title: String(risk.title || "Untitled risk"),
    description: String(risk.description || ""),
    category: String(risk.category || "General"),
    probability: clampScore(risk.probability),
    impact: clampScore(risk.impact),
    status: statuses.includes(risk.status) ? risk.status : "Open",
    mitigation: String(risk.mitigation || ""),
    dueDate: String(risk.dueDate || ""),
    residualProbability: clampScore(risk.residualProbability || risk.probability || 1),
    residualImpact: clampScore(risk.residualImpact || risk.impact || 1),
    createdAt: risk.createdAt || new Date().toISOString()
  };
}

function createId() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return `risk-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function score(risk) {
  return risk.probability * risk.impact;
}

function residualScore(risk) {
  return risk.residualProbability * risk.residualImpact;
}

function classificationFor(value) {
  if (value > threshold) return "unacceptable";
  if (value >= Math.max(1, threshold - 3)) return "moderate";
  return "acceptable";
}

function isAcceptable(risk) {
  return score(risk) <= threshold;
}

function isOverdue(risk) {
  if (!risk.dueDate || risk.status === "Closed") return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(`${risk.dueDate}T00:00:00`) < today;
}

function render() {
  renderThresholdControl();
  elements.thresholdInput.value = threshold;
  renderDashboard();
  renderHeatmap();
  renderCategories();
  renderRisks();
  renderCategorySuggestions();
}

function renderThresholdControl() {
  const customOption = elements.thresholdInput.querySelector("[data-custom-threshold]");
  if (customOption) customOption.remove();
  if (appetiteThresholds.includes(threshold)) return;

  const option = document.createElement("option");
  option.value = String(threshold);
  option.textContent = "Custom appetite";
  option.dataset.customThreshold = "true";
  elements.thresholdInput.appendChild(option);
}

function renderDashboard() {
  const total = risks.length;
  const high = risks.filter((risk) => !isAcceptable(risk)).length;
  const acceptable = risks.filter(isAcceptable).length;
  const overdue = risks.filter(isOverdue).length;
  const average = total ? risks.reduce((sum, risk) => sum + score(risk), 0) / total : 0;

  elements.totalRisks.textContent = total;
  elements.highRisks.textContent = high;
  elements.acceptableRisks.textContent = acceptable;
  elements.overdueRisks.textContent = overdue;
  elements.averageScore.textContent = average.toFixed(1).replace(".0", "");
}

function renderHeatmap() {
  elements.heatmap.innerHTML = "";
  elements.heatmapArrows.innerHTML = `
    <defs>
      <marker id="arrowHead" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
        <path d="M0,0 L8,4 L0,8 Z" fill="rgba(24, 32, 43, 0.62)"></path>
      </marker>
    </defs>
  `;
  elements.heatmapMarkers.innerHTML = "";
  renderHeatmapScales();

  for (let probability = 5; probability >= 1; probability -= 1) {
    for (let impact = 1; impact <= 5; impact += 1) {
      const cellScore = probability * impact;
      const cell = document.createElement("div");
      cell.className = `heat-cell ${classificationFor(cellScore)}`;
      cell.title = `Probability ${probability}, impact ${impact}, score ${cellScore}`;
      elements.heatmap.appendChild(cell);
    }
  }

  risks.slice(0, MAX_RISKS).forEach((risk, index) => {
    const inherentPoint = heatmapPoint(risk.impact, risk.probability);
    const residualPoint = heatmapPoint(risk.residualImpact, risk.residualProbability);
    const offset = markerOffsets[index % markerOffsets.length];

    drawRiskArrow(inherentPoint, residualPoint);
    drawRiskMarker(`R${index + 1}`, "inherent", inherentPoint, offset, risk.title);
    drawRiskMarker(`M${index + 1}`, "residual", residualPoint, { x: offset.x * -1, y: offset.y * -1 }, risk.title);
  });
}

function renderHeatmapScales() {
  elements.probabilityScale.innerHTML = probabilityLabels
    .map((item) => `<div class="axis-label"><span>${item.label}</span><strong>P${item.value}</strong></div>`)
    .join("");

  elements.impactScale.innerHTML = impactLabels
    .map((item) => `<div class="axis-label"><strong>I${item.value}</strong><span>${item.label}</span></div>`)
    .join("");
}

function heatmapPoint(impact, probability) {
  return {
    x: ((impact - 0.5) / 5) * 100,
    y: ((5.5 - probability) / 5) * 100
  };
}

function drawRiskArrow(from, to) {
  const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
  line.setAttribute("class", "risk-arrow");
  line.setAttribute("x1", from.x);
  line.setAttribute("y1", from.y);
  line.setAttribute("x2", to.x);
  line.setAttribute("y2", to.y);
  line.setAttribute("marker-end", "url(#arrowHead)");
  line.setAttribute("vector-effect", "non-scaling-stroke");
  elements.heatmapArrows.setAttribute("viewBox", "0 0 100 100");
  elements.heatmapArrows.appendChild(line);
}

function drawRiskMarker(label, kind, point, offset, title) {
  const marker = document.createElement("div");
  marker.className = `risk-marker ${kind}`;
  marker.textContent = label;
  marker.title = `${label}: ${title}`;
  marker.style.left = `${point.x}%`;
  marker.style.top = `${point.y}%`;
  marker.style.transform = `translate(-50%, -50%) translate(${offset.x}px, ${offset.y}px)`;
  elements.heatmapMarkers.appendChild(marker);
}

function renderCategories() {
  const selected = elements.categoryFilter.value;
  const categories = [...new Set(risks.map((risk) => risk.category).filter(Boolean))].sort();
  elements.categoryFilter.innerHTML = `<option value="all">All categories</option>`;
  categories.forEach((category) => {
    const option = document.createElement("option");
    option.value = category;
    option.textContent = category;
    elements.categoryFilter.appendChild(option);
  });
  elements.categoryFilter.value = categories.includes(selected) ? selected : "all";
}

function renderCategorySuggestions() {
  const categories = [...new Set(risks.map((risk) => risk.category).filter(Boolean))].sort();
  elements.categorySuggestions.innerHTML = "";
  categories.forEach((category) => {
    const option = document.createElement("option");
    option.value = category;
    elements.categorySuggestions.appendChild(option);
  });
}

function getVisibleRisks() {
  const status = elements.statusFilter.value;
  const category = elements.categoryFilter.value;
  const acceptability = elements.acceptabilityFilter.value;
  const sorted = [...risks].filter((risk) => {
    const statusMatch = status === "all" || risk.status === status;
    const categoryMatch = category === "all" || risk.category === category;
    const acceptabilityMatch =
      acceptability === "all" ||
      (acceptability === "acceptable" && isAcceptable(risk)) ||
      (acceptability === "unacceptable" && !isAcceptable(risk));
    return statusMatch && categoryMatch && acceptabilityMatch;
  });

  if (elements.sortSelect.value === "due-asc") {
    sorted.sort((a, b) => {
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return a.dueDate.localeCompare(b.dueDate);
    });
  } else {
    sorted.sort((a, b) => score(b) - score(a));
  }

  return sorted;
}

function renderRisks() {
  const visibleRisks = getVisibleRisks();
  elements.riskList.innerHTML = "";
  elements.visibleCount.textContent = `${visibleRisks.length} shown`;
  elements.emptyState.classList.toggle("visible", risks.length === 0);

  visibleRisks.forEach((risk) => {
    const riskNumber = risks.findIndex((item) => item.id === risk.id) + 1;
    const riskScore = score(risk);
    const riskClass = classificationFor(riskScore);
    const card = document.createElement("article");
    card.className = `risk-card ${riskClass}-risk ${riskScore > threshold ? "high-priority" : ""}`;
    card.innerHTML = `
      <div class="risk-card-header">
        <div>
          <h3>${escapeHtml(risk.title)}</h3>
          <div class="risk-meta">
            <span class="pill">${escapeHtml(risk.category)}</span>
            <span class="pill">${escapeHtml(risk.status)}</span>
            ${risk.dueDate ? `<span class="pill">${isOverdue(risk) ? "Overdue: " : "Due: "}${formatDate(risk.dueDate)}</span>` : ""}
          </div>
        </div>
        <span class="pill ${riskClass}"><span>${labelForClass(riskClass)}</span></span>
      </div>
      <p class="risk-description">${escapeHtml(risk.description)}</p>
      <div class="score-strip">
        <span class="pill">R${riskNumber} / M${riskNumber}</span>
        <span class="pill">Risk ${riskScore}</span>
        <span class="pill">P${risk.probability}</span>
        <span class="pill">I${risk.impact}</span>
        <span class="pill">Residual ${residualScore(risk)}</span>
      </div>
      ${risk.mitigation ? `<p class="risk-description"><strong>Mitigation:</strong> ${escapeHtml(risk.mitigation)}</p>` : ""}
      <div class="card-actions">
        <button type="button" data-action="edit" data-id="${risk.id}">Edit</button>
        <button type="button" class="danger-button" data-action="delete" data-id="${risk.id}">Delete</button>
      </div>
    `;
    elements.riskList.appendChild(card);
  });
}

function labelForClass(className) {
  if (className === "unacceptable") return "Unacceptable";
  if (className === "moderate") return "Moderate";
  return "Acceptable";
}

function formatDate(value) {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(
    new Date(`${value}T00:00:00`)
  );
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => {
    const entities = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" };
    return entities[character];
  });
}

function openRiskDialog(risk) {
  const isEditing = Boolean(risk);
  if (!isEditing && risks.length >= MAX_RISKS) {
    alert(`Risk Board is designed for up to ${MAX_RISKS} risks. Delete or import a smaller set before adding more.`);
    return;
  }
  elements.riskForm.reset();
  elements.dialogTitle.textContent = isEditing ? "Edit Risk" : "Add Risk";
  elements.deleteRiskButton.style.display = isEditing ? "inline-block" : "none";

  const nextRisk = risk || {
    id: "",
    title: "",
    description: "",
    category: "",
    probability: 3,
    impact: 3,
    status: "Open",
    mitigation: "",
    dueDate: "",
    residualProbability: 2,
    residualImpact: 2
  };

  elements.riskId.value = nextRisk.id;
  elements.titleInput.value = nextRisk.title;
  elements.descriptionInput.value = nextRisk.description;
  elements.categoryInput.value = nextRisk.category;
  elements.statusInput.value = nextRisk.status;
  elements.probabilityInput.value = nextRisk.probability;
  elements.impactInput.value = nextRisk.impact;
  elements.mitigationInput.value = nextRisk.mitigation;
  elements.dueDateInput.value = nextRisk.dueDate;
  elements.residualProbabilityInput.value = nextRisk.residualProbability;
  elements.residualImpactInput.value = nextRisk.residualImpact;
  updateScorePreview();
  elements.riskDialog.showModal();
  elements.titleInput.focus();
}

function closeRiskDialog() {
  elements.riskDialog.close();
}

function updateScorePreview() {
  const probability = clampScore(elements.probabilityInput.value);
  const impact = clampScore(elements.impactInput.value);
  const residualProbability = clampScore(elements.residualProbabilityInput.value);
  const residualImpact = clampScore(elements.residualImpactInput.value);

  elements.probabilityValue.textContent = probability;
  elements.impactValue.textContent = impact;
  elements.riskScorePreview.textContent = probability * impact;
  elements.residualProbabilityValue.textContent = residualProbability;
  elements.residualImpactValue.textContent = residualImpact;
  elements.residualScorePreview.textContent = residualProbability * residualImpact;
}

function saveFormRisk(event) {
  event.preventDefault();
  if (!elements.riskId.value && risks.length >= MAX_RISKS) {
    alert(`Risk Board is designed for up to ${MAX_RISKS} risks.`);
    return;
  }
  const id = elements.riskId.value || createId();
  const nextRisk = normalizeRisk({
    id,
    title: elements.titleInput.value.trim(),
    description: elements.descriptionInput.value.trim(),
    category: elements.categoryInput.value.trim() || "General",
    probability: elements.probabilityInput.value,
    impact: elements.impactInput.value,
    status: elements.statusInput.value,
    mitigation: elements.mitigationInput.value.trim(),
    dueDate: elements.dueDateInput.value,
    residualProbability: elements.residualProbabilityInput.value,
    residualImpact: elements.residualImpactInput.value,
    createdAt: risks.find((risk) => risk.id === id)?.createdAt || new Date().toISOString()
  });

  const existingIndex = risks.findIndex((risk) => risk.id === id);
  if (existingIndex >= 0) {
    risks[existingIndex] = nextRisk;
  } else {
    risks.unshift(nextRisk);
  }

  saveRisks();
  closeRiskDialog();
  render();
}

function deleteRisk(id) {
  const risk = risks.find((item) => item.id === id);
  if (!risk) return;
  const confirmed = confirm(`Delete "${risk.title}"?`);
  if (!confirmed) return;
  risks = risks.filter((item) => item.id !== id);
  saveRisks();
  render();
}

function exportRisks() {
  const payload = {
    app: "Risk Board",
    exportedAt: new Date().toISOString(),
    threshold,
    risks
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `risk-board-export-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

function importRisks(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(String(reader.result));
      const importedRisks = Array.isArray(parsed) ? parsed : parsed.risks;
      if (!Array.isArray(importedRisks)) throw new Error("No risks array found");

      risks = importedRisks.slice(0, MAX_RISKS).map(normalizeRisk);
      if (importedRisks.length > MAX_RISKS) {
        alert(`Imported the first ${MAX_RISKS} risks. Risk Board keeps the heatmap readable by limiting the board to ${MAX_RISKS} risks.`);
      }
      if (parsed.threshold) {
        threshold = clampScore(parsed.threshold, 1, 25);
        saveThreshold();
      }
      saveRisks();
      render();
    } catch (error) {
      alert("That JSON file could not be imported. Check that it contains a Risk Board export or an array of risks.");
    } finally {
      elements.importInput.value = "";
    }
  };
  reader.readAsText(file);
}

elements.newRiskButton.addEventListener("click", () => openRiskDialog());
elements.emptyAddButton.addEventListener("click", () => openRiskDialog());
elements.closeDialogButton.addEventListener("click", closeRiskDialog);
elements.cancelButton.addEventListener("click", closeRiskDialog);
elements.riskForm.addEventListener("submit", saveFormRisk);
elements.deleteRiskButton.addEventListener("click", () => {
  if (!elements.riskId.value) return;
  closeRiskDialog();
  deleteRisk(elements.riskId.value);
});

[
  elements.probabilityInput,
  elements.impactInput,
  elements.residualProbabilityInput,
  elements.residualImpactInput
].forEach((input) => input.addEventListener("input", updateScorePreview));

[elements.statusFilter, elements.categoryFilter, elements.acceptabilityFilter, elements.sortSelect].forEach((input) => {
  input.addEventListener("change", renderRisks);
});

elements.thresholdInput.addEventListener("change", () => {
  threshold = clampScore(elements.thresholdInput.value, 1, 25);
  saveThreshold();
  render();
});

elements.riskList.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const risk = risks.find((item) => item.id === button.dataset.id);
  if (button.dataset.action === "edit") openRiskDialog(risk);
  if (button.dataset.action === "delete") deleteRisk(button.dataset.id);
});

elements.exportButton.addEventListener("click", exportRisks);
elements.importInput.addEventListener("change", importRisks);

render();
