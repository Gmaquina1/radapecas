const APP_VERSION = "v1.4.0-funcional";
const TESSERACT_CDN = "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js";

const state = {
  imageLoaded: false,
  fileName: "",
  lastOcrText: "",
  lastCodes: []
};

const els = {
  versionBadge: document.querySelector("#versionBadge"),
  input: document.querySelector("#photoInput"),
  dropZone: document.querySelector("#dropZone"),
  previewWrap: document.querySelector("#previewWrap"),
  canvas: document.querySelector("#previewCanvas"),
  recognizeBtn: document.querySelector("#runOcrBtn"),
  enhanceBtn: document.querySelector("#enhanceBtn"),
  resetBtn: document.querySelector("#resetBtn"),
  progressText: document.querySelector("#progressText"),
  progressPercent: document.querySelector("#progressPercent"),
  progressBar: document.querySelector("#progressBar"),
  form: document.querySelector("#partsForm"),
  partCode: document.querySelector("#partCode"),
  partName: document.querySelector("#partName"),
  brand: document.querySelector("#brand"),
  machine: document.querySelector("#machine"),
  location: document.querySelector("#location"),
  partType: document.querySelector("#partType"),
  candidateList: document.querySelector("#candidateList"),
  queryPreview: document.querySelector("#queryPreview"),
  resultsGrid: document.querySelector("#resultsGrid"),
  resultTemplate: document.querySelector("#resultTemplate"),
  copyRequestBtn: document.querySelector("#copyRequestBtn"),
  saveHistoryBtn: document.querySelector("#saveHistoryBtn"),
  aiPartType: document.querySelector("#aiPartType"),
  aiSummary: document.querySelector("#aiSummary"),
  confidenceBar: document.querySelector("#confidenceBar"),
  confidenceText: document.querySelector("#confidenceText"),
  aiTags: document.querySelector("#aiTags")
};

init();

function init() {
  if (els.versionBadge) els.versionBadge.textContent = APP_VERSION;
  bindEvents();
  renderEmptyResults();
}

function bindEvents() {
  els.input.addEventListener("change", event => {
    const file = event.target.files?.[0];
    if (file) loadImage(file);
  });

  ["dragenter", "dragover"].forEach(type => {
    els.dropZone.addEventListener(type, event => {
      event.preventDefault();
      els.dropZone.classList.add("is-dragging");
    });
  });

  ["dragleave", "drop"].forEach(type => {
    els.dropZone.addEventListener(type, event => {
      event.preventDefault();
      els.dropZone.classList.remove("is-dragging");
    });
  });

  els.dropZone.addEventListener("drop", event => {
    const file = event.dataTransfer.files?.[0];
    if (file) loadImage(file);
  });

  els.recognizeBtn.addEventListener("click", recognizePhoto);
  els.enhanceBtn.addEventListener("click", enhanceCanvas);
  els.resetBtn.addEventListener("click", resetAll);

  els.form.addEventListener("submit", event => {
    event.preventDefault();
    runManualSearch();
  });

  [els.partCode, els.partName, els.brand, els.machine, els.location, els.partType].forEach(input => {
    input.addEventListener("input", updateQueryPreview);
    input.addEventListener("change", updateQueryPreview);
  });

  els.copyRequestBtn.addEventListener("click", copyRequest);
  els.saveHistoryBtn.addEventListener("click", saveSearch);
}

function loadImage(file) {
  state.fileName = file.name || "";
  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => {
      drawImage(img);
      state.imageLoaded = true;
      els.previewWrap.classList.remove("is-hidden");
      setProgress("Foto carregada. Clique em Reconhecer foto.", 20);
      setAnalysis("Foto carregada", "Pronto para ler codigo, etiqueta ou texto da peca.", 0, ["aguardando reconhecimento"]);
    };
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
}

function drawImage(img) {
  const ctx = els.canvas.getContext("2d", { willReadFrequently: true });
  const maxWidth = 1400;
  const scale = Math.min(1, maxWidth / img.width);
  els.canvas.width = Math.round(img.width * scale);
  els.canvas.height = Math.round(img.height * scale);
  ctx.clearRect(0, 0, els.canvas.width, els.canvas.height);
  ctx.drawImage(img, 0, 0, els.canvas.width, els.canvas.height);
}

function enhanceCanvas() {
  if (!state.imageLoaded) {
    setProgress("Envie uma foto primeiro.", 0);
    return;
  }

  const ctx = els.canvas.getContext("2d", { willReadFrequently: true });
  const imageData = ctx.getImageData(0, 0, els.canvas.width, els.canvas.height);
  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    const boosted = gray > 145 ? 255 : Math.max(0, gray - 45);
    data[i] = boosted;
    data[i + 1] = boosted;
    data[i + 2] = boosted;
  }

  ctx.putImageData(imageData, 0, 0);
  setProgress("Contraste aplicado. Clique em Reconhecer foto novamente.", 25);
}

async function recognizePhoto() {
  if (!state.imageLoaded) {
    setProgress("Envie uma foto primeiro.", 0);
    return;
  }

  clearCandidates();
  setProgress("Reconhecendo foto...", 12);

  const barcodeCodes = await detectBarcodeCodes();
  if (barcodeCodes.length) {
    applyDetectedCodes(barcodeCodes, "Codigo de barras");
    finishRecognition("Codigo encontrado por leitor de barras.", 90);
    return;
  }

  const ocrText = await runOcr();
  state.lastOcrText = ocrText;
  const codes = extractPartCodes(`${ocrText}\n${state.fileName}`);
  state.lastCodes = codes;

  if (codes.length) {
    applyDetectedCodes(codes, "Codigo lido na foto");
  }

  const inferredPart = inferPartFromText(ocrText);
  if (!clean(els.partName.value) && inferredPart) {
    els.partName.value = inferredPart;
  }

  if (hasSearchData()) {
    finishRecognition(codes.length ? "Codigo reconhecido. Links prontos." : "Texto analisado. Links prontos com dados disponiveis.", codes.length ? 82 : 58);
  } else {
    setAnalysis(
      "Nao consegui identificar a peca",
      "A foto nao trouxe codigo legivel. Preencha codigo, nome, marca ou maquina e clique em Buscar peca.",
      25,
      ["foto sem codigo claro", "preencha dados para buscar"]
    );
    renderEmptyResults("Informe codigo, nome, marca ou maquina para montar links reais.");
    setProgress("Nao encontrei dados suficientes.", 35);
  }
}

async function detectBarcodeCodes() {
  if (!("BarcodeDetector" in window)) return [];

  try {
    const detector = new BarcodeDetector({
      formats: ["qr_code", "code_128", "code_39", "ean_13", "ean_8", "upc_a", "upc_e", "itf"]
    });
    const detected = await detector.detect(els.canvas);
    return detected.map(item => item.rawValue).filter(Boolean);
  } catch {
    return [];
  }
}

async function runOcr() {
  try {
    await ensureTesseract();
  } catch {
    setProgress("Leitor OCR nao carregou. Use os campos manuais.", 0);
    return "";
  }

  try {
    const originalText = await recognizeCanvasText(els.canvas, "Lendo texto/codigo da foto...", 15, 55);
    const enhancedCanvas = buildHighContrastCanvas();
    const enhancedText = await recognizeCanvasText(enhancedCanvas, "Conferindo codigo com contraste alto...", 56, 88);
    return `${originalText}\n${enhancedText}`;
  } catch {
    return "";
  }
}

async function recognizeCanvasText(canvas, label, minPct, maxPct) {
  const result = await Tesseract.recognize(canvas, "eng", {
    tessedit_char_whitelist: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789/-. ",
    preserve_interword_spaces: "1",
    logger: message => {
      if (message.status === "recognizing text") {
        const span = maxPct - minPct;
        const pct = Math.round(minPct + ((message.progress || 0) * span));
        setProgress(label, pct);
      }
    }
  });

  return result.data.text || "";
}

function buildHighContrastCanvas() {
  const source = els.canvas;
  const target = document.createElement("canvas");
  target.width = source.width;
  target.height = source.height;

  const sourceCtx = source.getContext("2d", { willReadFrequently: true });
  const targetCtx = target.getContext("2d", { willReadFrequently: true });
  const imageData = sourceCtx.getImageData(0, 0, source.width, source.height);
  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    const threshold = gray > 150 ? 255 : 0;
    data[i] = threshold;
    data[i + 1] = threshold;
    data[i + 2] = threshold;
  }

  targetCtx.putImageData(imageData, 0, 0);
  return target;
}

function ensureTesseract() {
  return new Promise((resolve, reject) => {
    if (window.Tesseract) {
      resolve();
      return;
    }

    const script = document.createElement("script");
    script.src = TESSERACT_CDN;
    script.async = true;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

function extractPartCodes(text) {
  const matches = (text || "")
    .toUpperCase()
    .replace(/[|]/g, "1")
    .replace(/[°º]/g, "0")
    .match(/[A-Z0-9][A-Z0-9./-]{3,30}[A-Z0-9]/g) || [];

  const blocked = new Set(["CODIGO", "ORIGINAL", "BRASIL", "PECAS", "PECA", "MODELO", "SERIE", "MARCA"]);

  return [...new Set(matches)]
    .map(item => item.replace(/^[./-]+|[./-]+$/g, ""))
    .filter(item => item.length >= 5)
    .filter(item => /\d/.test(item))
    .filter(item => !blocked.has(item))
    .sort((a, b) => scoreCode(b) - scoreCode(a))
    .slice(0, 6);
}

function scoreCode(code) {
  let score = code.length;
  if (/\d{5,}/.test(code)) score += 10;
  if (/[A-Z]/.test(code) && /\d/.test(code)) score += 5;
  if (/[/-]/.test(code)) score += 3;
  return score;
}

function inferPartFromText(text) {
  const normalized = (text || "").toLowerCase();
  const families = [
    ["bomba hidraulica", ["bomba", "hydraulic", "hidraul"]],
    ["filtro", ["filtro", "filter"]],
    ["sensor", ["sensor"]],
    ["modulo eletronico", ["modulo", "module", "ecu"]],
    ["bico injetor", ["injetor", "injector", "bico"]],
    ["radiador", ["radiador", "cooler"]],
    ["rolamento", ["rolamento", "bearing"]],
    ["correia", ["correia", "belt"]],
    ["mangueira hidraulica", ["mangueira", "hose"]]
  ];

  const found = families.find(([, words]) => words.some(word => normalized.includes(word)));
  return found ? found[0] : "";
}

function applyDetectedCodes(codes, label) {
  const uniqueCodes = [...new Set(codes)].slice(0, 6);
  if (uniqueCodes[0]) els.partCode.value = uniqueCodes[0];

  els.candidateList.innerHTML = "";
  const title = document.createElement("span");
  title.className = "result-type";
  title.textContent = label;
  els.candidateList.appendChild(title);

  uniqueCodes.forEach(code => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "candidate-pill";
    button.textContent = code;
    button.addEventListener("click", () => {
      els.partCode.value = code;
      finishRecognition("Codigo selecionado. Links atualizados.", 82);
    });
    els.candidateList.appendChild(button);
  });
}

function finishRecognition(message, confidence) {
  const searchText = baseSearchText();
  setAnalysis(
    clean(els.partName.value) || clean(els.partCode.value) || "Peca reconhecida",
    message,
    confidence,
    buildTags(searchText)
  );
  updateQueryPreview();
  renderPurchaseCards();
  setProgress("Resultados prontos.", 100);
  scrollToResults();
}

function runManualSearch() {
  if (!hasSearchData()) {
    renderEmptyResults("Informe codigo, nome da peca, marca ou maquina.");
    setProgress("Dados insuficientes para buscar.", 0);
    return;
  }

  finishRecognition("Busca montada com os dados informados.", 70);
}

function renderPurchaseCards() {
  const base = baseSearchText();
  if (!base) {
    renderEmptyResults("Informe codigo, nome da peca, marca ou maquina.");
    return;
  }

  els.resultsGrid.innerHTML = "";
  els.queryPreview.textContent = base;

  const cards = [
    {
      type: "Nova",
      title: "Melhor preco - peca nova",
      query: `${base} nova original paralela comprar`,
      chips: ["Nova", clean(els.partCode.value) || "Codigo a confirmar", "Compra imediata"]
    },
    {
      type: "Usada",
      title: "Melhor preco - peca usada",
      query: `${base} usada desmanche semi nova comprar`,
      chips: ["Usada", clean(els.partCode.value) || "Codigo a confirmar", "Menor custo"]
    },
    {
      type: "Remanufaturada",
      title: "Melhor preco - remanufaturada",
      query: `${base} remanufaturada recuperada recondicionada comprar`,
      chips: ["Remanufaturada", clean(els.partCode.value) || "Codigo a confirmar", "Garantia/recuperada"]
    }
  ];

  cards.forEach(card => {
    const node = els.resultTemplate.content.cloneNode(true);
    node.querySelector(".result-type").textContent = card.type;
    node.querySelector("h3").textContent = card.title;
    node.querySelector(".result-desc").innerHTML = `
      <strong>${escapeHtml(card.query)}</strong>
      <div class="match-row">
        <div class="match-chip"><span>Tipo</span><strong>${escapeHtml(card.chips[0])}</strong></div>
        <div class="match-chip"><span>Codigo</span><strong>${escapeHtml(card.chips[1])}</strong></div>
        <div class="match-chip"><span>Foco</span><strong>${escapeHtml(card.chips[2])}</strong></div>
      </div>
    `;

    const linksWrap = node.querySelector(".buy-links");
    buildPurchaseLinks(card.query, card.type).forEach(link => {
      const anchor = document.createElement("a");
      anchor.href = link.url;
      anchor.target = "_blank";
      anchor.rel = "noopener";
      anchor.textContent = link.label;
      linksWrap.appendChild(anchor);
    });

    els.resultsGrid.appendChild(node);
  });
}

function buildPurchaseLinks(query, type) {
  const encoded = encodeURIComponent(query);
  const marketplaceSlug = slugForMarketplace(query);
  const links = [
    { label: "Ver ofertas", url: `https://www.google.com/search?tbm=shop&q=${encoded}` },
    { label: "Comparar precos", url: `https://www.google.com/search?q=${encoded}` },
    { label: "Opcoes de compra", url: `https://lista.mercadolivre.com.br/${marketplaceSlug}` },
    { label: "Mais ofertas", url: `https://shopee.com.br/search?keyword=${encoded}` }
  ];

  if (type === "Usada") {
    links.splice(2, 0, { label: "Usados proximos", url: `https://www.olx.com.br/brasil?q=${encoded}` });
  }

  return links;
}

function slugForMarketplace(value) {
  return clean(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

function renderEmptyResults(message = "Tire uma foto ou informe a peca.") {
  els.resultsGrid.innerHTML = "";
  const node = els.resultTemplate.content.cloneNode(true);
  node.querySelector(".result-type").textContent = "Aguardando";
  node.querySelector("h3").textContent = "Nenhuma busca montada";
  node.querySelector(".result-desc").textContent = message;
  els.resultsGrid.appendChild(node);
  els.queryPreview.textContent = message;
}

function hasSearchData() {
  return Boolean(baseSearchText());
}

function baseSearchText() {
  return [
    clean(els.partCode.value),
    clean(els.partName.value),
    clean(els.brand.value),
    clean(els.machine.value)
  ].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
}

function updateQueryPreview() {
  els.queryPreview.textContent = baseSearchText() || "Tire uma foto ou informe a peca.";
}

function setAnalysis(title, summary, confidence, tags) {
  els.aiPartType.textContent = title;
  els.aiSummary.textContent = summary;
  els.confidenceText.textContent = `${confidence}%`;
  els.confidenceBar.style.width = `${confidence}%`;
  els.aiTags.innerHTML = "";

  tags.forEach(tag => {
    const span = document.createElement("span");
    span.className = "ai-tag";
    span.textContent = tag;
    els.aiTags.appendChild(span);
  });
}

function buildTags(searchText) {
  return [
    clean(els.partCode.value) ? `codigo ${clean(els.partCode.value)}` : "codigo a confirmar",
    searchText || "busca pendente",
    "nova / usada / remanufaturada"
  ];
}

function copyRequest() {
  const message = [
    "Estou procurando uma peca.",
    "",
    `Codigo: ${clean(els.partCode.value) || "nao informado"}`,
    `Peca: ${clean(els.partName.value) || "nao informado"}`,
    `Marca: ${clean(els.brand.value) || "nao informado"}`,
    `Maquina/veiculo: ${clean(els.machine.value) || "nao informado"}`,
    `Cidade/UF: ${clean(els.location.value) || "nao informado"}`,
    "",
    "Tem disponivel? Pode me passar valor, prazo e foto?"
  ].join("\n");

  navigator.clipboard?.writeText(message);
  setProgress("Pedido copiado.", 100);
}

function saveSearch() {
  if (!hasSearchData()) {
    setProgress("Nada para salvar ainda.", 0);
    return;
  }

  const history = JSON.parse(localStorage.getItem("radarPecasHistory") || "[]");
  history.unshift({ query: baseSearchText(), date: new Date().toLocaleString("pt-BR") });
  localStorage.setItem("radarPecasHistory", JSON.stringify(history.slice(0, 20)));
  setProgress("Busca salva neste aparelho.", 100);
}

function resetAll() {
  state.imageLoaded = false;
  state.fileName = "";
  state.lastOcrText = "";
  state.lastCodes = [];
  els.input.value = "";
  els.form.reset();
  els.candidateList.innerHTML = "";
  els.previewWrap.classList.add("is-hidden");
  setAnalysis("Aguardando foto", "Resultado aparece apos reconhecer a imagem.", 0, []);
  renderEmptyResults();
  setProgress("Aguardando foto", 0);
}

function clearCandidates() {
  els.candidateList.innerHTML = "";
}

function scrollToResults() {
  document.querySelector(".results-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function setProgress(text, percent) {
  const safePercent = Math.max(0, Math.min(100, Number(percent) || 0));
  els.progressText.textContent = text;
  els.progressPercent.textContent = `${safePercent}%`;
  els.progressBar.style.width = `${safePercent}%`;
}

function clean(value) {
  return String(value || "").trim();
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
