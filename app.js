const state = {
  image: null,
  enhanced: false,
  query: "",
  suppliers: [],
  history: [],
  visionModel: null,
  aiLabels: []
};

const defaultSuppliers = [
  { name: "Diesel Minas Pecas", domain: "Montes Claros MG", mode: "local" },
  { name: "Hidraulica Pesada BR", domain: "Belo Horizonte MG", mode: "local" },
  { name: "Linha Amarela Parts", domain: "Goiania GO", mode: "local" },
  { name: "Trator Norte Pecas", domain: "Taiobeiras MG", mode: "local" },
  { name: "Recuperadora Diesel", domain: "Contagem MG", mode: "local" }
];

const localCatalog = [
  { family: "bomba hidraulica", title: "Bomba hidraulica", suppliers: ["Hidraulica Pesada BR", "Linha Amarela Parts", "Trator Norte Pecas"], price: [1850, 8900], stock: "Disponivel" },
  { family: "componente hidraulico", title: "Componente hidraulico", suppliers: ["Hidraulica Pesada BR", "Diesel Minas Pecas"], price: [750, 6400], stock: "Cotacao rapida" },
  { family: "filtro", title: "Filtro / elemento", suppliers: ["Diesel Minas Pecas", "Trator Norte Pecas"], price: [90, 780], stock: "Disponivel" },
  { family: "sensor", title: "Sensor / modulo", suppliers: ["Linha Amarela Parts", "Diesel Minas Pecas"], price: [380, 5200], stock: "Sob consulta" },
  { family: "modulo", title: "Modulo eletronico", suppliers: ["Linha Amarela Parts", "Recuperadora Diesel"], price: [1200, 9600], stock: "Sob consulta" },
  { family: "motor", title: "Motor / injecao diesel", suppliers: ["Recuperadora Diesel", "Diesel Minas Pecas"], price: [650, 18000], stock: "Cotacao rapida" },
  { family: "transmissao", title: "Transmissao / caixa", suppliers: ["Linha Amarela Parts", "Recuperadora Diesel"], price: [2800, 26000], stock: "Sob consulta" },
  { family: "esteira", title: "Material rodante", suppliers: ["Trator Norte Pecas", "Linha Amarela Parts"], price: [450, 15000], stock: "Disponivel" },
  { family: "radiador", title: "Radiador / arrefecimento", suppliers: ["Diesel Minas Pecas", "Trator Norte Pecas"], price: [900, 7800], stock: "Disponivel" },
  { family: "rolamento", title: "Rolamento / retentor", suppliers: ["Trator Norte Pecas", "Diesel Minas Pecas"], price: [80, 1600], stock: "Disponivel" }
];

const els = {
  input: document.querySelector("#photoInput"),
  dropZone: document.querySelector("#dropZone"),
  previewWrap: document.querySelector("#previewWrap"),
  canvas: document.querySelector("#previewCanvas"),
  runOcrBtn: document.querySelector("#runOcrBtn"),
  analyzeAiBtn: document.querySelector("#analyzeAiBtn"),
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
  clearHistoryBtn: document.querySelector("#clearHistoryBtn"),
  supplierForm: document.querySelector("#supplierForm"),
  supplierName: document.querySelector("#supplierName"),
  supplierDomain: document.querySelector("#supplierDomain"),
  supplierList: document.querySelector("#supplierList"),
  historyList: document.querySelector("#historyList"),
  aiPartType: document.querySelector("#aiPartType"),
  aiSummary: document.querySelector("#aiSummary"),
  confidenceBar: document.querySelector("#confidenceBar"),
  confidenceText: document.querySelector("#confidenceText"),
  aiTags: document.querySelector("#aiTags")
};

init();

function init() {
  state.suppliers = load("radarPecasSuppliers", defaultSuppliers);
  state.history = load("radarPecasHistory", []);
  renderSuppliers();
  renderHistory();
  renderResults();
  bindEvents();
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

  els.enhanceBtn.addEventListener("click", () => {
    state.enhanced = !state.enhanced;
    drawImageToCanvas();
    setProgress(state.enhanced ? "Contraste melhorado" : "Imagem original", 8);
  });

  els.runOcrBtn.addEventListener("click", runRecognition);
  els.analyzeAiBtn.addEventListener("click", runFreeAiAnalysis);
  els.resetBtn.addEventListener("click", resetAll);

  els.form.addEventListener("submit", event => {
    event.preventDefault();
    buildSearch(true);
  });

  ["input", "change"].forEach(type => {
    [els.partCode, els.partName, els.brand, els.machine, els.location, els.partType].forEach(input => {
      input.addEventListener(type, updateQueryPreview);
    });
  });

  els.copyRequestBtn.addEventListener("click", copyRequest);
  els.saveHistoryBtn.addEventListener("click", saveHistory);
  els.clearHistoryBtn.addEventListener("click", clearHistory);

  els.supplierForm.addEventListener("submit", event => {
    event.preventDefault();
    addSupplier();
  });
}

function load(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) || fallback;
  } catch {
    return fallback;
  }
}

function save(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function loadImage(file) {
  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => {
      state.image = img;
      state.enhanced = false;
      els.previewWrap.classList.remove("is-hidden");
      drawImageToCanvas();
      setProgress("Foto carregada. Clique em Reconhecer foto.", 20);
      renderWaitingPhoto();
      tryBarcodeScan();
    };
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
}

function renderWaitingPhoto() {
  els.aiPartType.textContent = "Foto carregada";
  els.aiSummary.textContent = "Clique em Reconhecer foto para ler codigo e montar links de compra.";
  els.confidenceText.textContent = "0%";
  els.confidenceBar.style.width = "0%";
  els.aiTags.innerHTML = "";
}

function drawImageToCanvas() {
  if (!state.image) return;

  const ctx = els.canvas.getContext("2d", { willReadFrequently: true });
  const maxWidth = 1200;
  const scale = Math.min(1, maxWidth / state.image.width);
  els.canvas.width = Math.round(state.image.width * scale);
  els.canvas.height = Math.round(state.image.height * scale);
  ctx.drawImage(state.image, 0, 0, els.canvas.width, els.canvas.height);

  if (state.enhanced) {
    const imageData = ctx.getImageData(0, 0, els.canvas.width, els.canvas.height);
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
      const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      const boosted = gray > 135 ? 255 : Math.max(0, gray - 35);
      data[i] = boosted;
      data[i + 1] = boosted;
      data[i + 2] = boosted;
    }
    ctx.putImageData(imageData, 0, 0);
  }
}

async function tryBarcodeScan() {
  if (!("BarcodeDetector" in window) || !state.image) return;

  try {
    const detector = new BarcodeDetector({
      formats: ["qr_code", "code_128", "code_39", "ean_13", "ean_8", "upc_a", "upc_e", "itf"]
    });
    const codes = await detector.detect(els.canvas);
    const values = codes.map(code => code.rawValue).filter(Boolean);
    if (values.length) {
      addCandidates(values, "Codigo detectado por leitor de barras");
      setProgress("Codigo de barras encontrado", 20);
    }
  } catch {
    // Some browsers expose BarcodeDetector but do not support all formats.
  }
}

async function runRecognition() {
  if (!state.image) {
    setProgress("Envie uma foto primeiro.", 0);
    return;
  }

  setProgress("Reconhecendo foto...", 15);

  try {
    await ensureTesseract();
  } catch {
    setProgress("Nao carregou o leitor. Preencha os dados e clique em buscar.", 0);
    return;
  }

  let foundCode = "";
  try {
    const result = await Tesseract.recognize(els.canvas, "eng", {
      logger: message => {
        if (message.status === "recognizing text") {
          const pct = Math.round((message.progress || 0) * 100);
          setProgress("Lendo codigo da foto...", pct);
        }
      }
    });

    const text = result.data.text || "";
    const candidates = extractPartCodes(text);
    if (candidates.length) {
      addCandidates(candidates, "Codigos sugeridos pelo OCR");
      els.partCode.value = candidates[0];
      foundCode = candidates[0];
    } else {
      addCandidates(["sem codigo claro"], "Resultado da leitura");
    }
  } catch {
    addCandidates(["sem codigo claro"], "Resultado da leitura");
  }

  await recognizeVisualContext();
  const query = buildSearchQueryForPurchase();
  renderPurchaseReady(foundCode, query);
  buildSearch(true);
  setProgress("Links de compra prontos.", 100);
}

async function recognizeVisualContext() {
  let labels = [];
  try {
    await ensureFreeVisionModel();
    labels = await state.visionModel.classify(els.canvas);
    state.aiLabels = labels;
  } catch {
    labels = [];
    state.aiLabels = [];
  }

  const analysis = buildFreeAiReport(labels);
  applyAnalysisToSearch(analysis);
  renderFreeAiReport(analysis);
}

function buildSearchQueryForPurchase(condition = "") {
  if (!hasMinimumSearchData()) return "";

  const pieces = [
    clean(els.partCode.value),
    clean(els.partName.value),
    clean(els.brand.value),
    clean(els.machine.value),
    condition,
    "peca"
  ];

  return pieces.filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
}

function hasMinimumSearchData() {
  return Boolean(
    clean(els.partCode.value) ||
    clean(els.partName.value) ||
    clean(els.brand.value) ||
    clean(els.machine.value)
  );
}

function renderPurchaseReady(code, query) {
  const part = clean(els.partName.value) || "Peca identificada";
  els.aiPartType.textContent = part;
  els.aiSummary.textContent = code
    ? `Codigo reconhecido: ${code}. Links montados para compra.`
    : `Codigo nao confirmado. Links montados com os dados disponiveis.`;
  els.confidenceText.textContent = code ? "82%" : "55%";
  els.confidenceBar.style.width = code ? "82%" : "55%";
  els.aiTags.innerHTML = "";
  [query || "busca por imagem", code ? `codigo ${code}` : "sem codigo", "nova / usada / remanufaturada"].forEach(tag => {
    const span = document.createElement("span");
    span.className = "ai-tag";
    span.textContent = tag;
    els.aiTags.appendChild(span);
  });
}

function ensureTesseract() {
  return new Promise((resolve, reject) => {
    if (window.Tesseract) {
      resolve();
      return;
    }

    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js";
    script.async = true;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

async function runFreeAiAnalysis() {
  if (!state.image) {
    setProgress("Envie uma foto primeiro.", 0);
    return;
  }

  setProgress("Analisando imagem...", 55);

  let labels = [];
  try {
    await ensureFreeVisionModel();
    labels = await state.visionModel.classify(els.canvas);
    state.aiLabels = labels;
  } catch {
    labels = [];
    state.aiLabels = [];
  }

  const analysis = buildFreeAiReport(labels);
  renderFreeAiReport(analysis);
  applyAnalysisToSearch(analysis);
  buildSearch(true);
  setProgress("Resultados encontrados.", 100);
}

function ensureFreeVisionModel() {
  return new Promise(async (resolve, reject) => {
    try {
      if (state.visionModel) {
        resolve();
        return;
      }

      await loadScript("https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0/dist/tf.min.js");
      await loadScript("https://cdn.jsdelivr.net/npm/@tensorflow-models/mobilenet@2.1.1/dist/mobilenet.min.js");

      if (!window.mobilenet) {
        reject(new Error("Modelo visual nao carregou."));
        return;
      }

      state.visionModel = await mobilenet.load({ version: 2, alpha: 1.0 });
      resolve();
    } catch (error) {
      reject(error);
    }
  });
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const existing = [...document.scripts].find(script => script.src === src);
    if (existing) {
      resolve();
      return;
    }

    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

function buildFreeAiReport(labels) {
  const code = clean(els.partCode.value);
  const typedPart = clean(els.partName.value);
  const brand = clean(els.brand.value);
  const machine = clean(els.machine.value);
  const labelText = labels.map(item => item.className).join(" ").toLowerCase();
  const combined = `${typedPart} ${brand} ${machine} ${labelText}`.toLowerCase();
  const partGuess = inferPartFamily(combined);
  const confidence = calculateDemoConfidence({ labels, code, typedPart, brand, machine, partGuess });
  const terms = buildAiSearchTerms({ code, typedPart, brand, machine, partGuess });

  return {
    partGuess,
    confidence,
    labels,
    terms,
    summary: makeAiSummary({ code, typedPart, brand, machine, partGuess, labels })
  };
}

function inferPartFamily(text) {
  const bank = [
    { name: "bomba hidraulica / componente hidraulico", words: ["bomba", "hidraul", "hydraulic", "mangueira", "valvula", "comando", "cilindro"] },
    { name: "filtro / elemento de manutencao", words: ["filtro", "filter", "oil", "air", "diesel"] },
    { name: "sensor / modulo eletronico", words: ["sensor", "modulo", "module", "ecu", "eletron", "chicote"] },
    { name: "motor / injecao diesel", words: ["motor", "diesel", "bico", "injetor", "injector", "bomba injetora"] },
    { name: "transmissao / caixa / cardan", words: ["caixa", "transmiss", "gear", "cardan", "diferencial"] },
    { name: "material rodante / esteira", words: ["esteira", "rolete", "corrente", "sprocket", "rodante"] },
    { name: "radiador / arrefecimento", words: ["radiador", "cooler", "ventoinha", "arrefecimento"] },
    { name: "rolamento / retentor / vedacao", words: ["rolamento", "bearing", "retentor", "vedacao", "seal"] }
  ];

  const hit = bank.find(item => item.words.some(word => text.includes(word)));
  return hit ? hit.name : "peca mecanica ou automotiva a confirmar";
}

function calculateDemoConfidence({ labels, code, typedPart, brand, machine, partGuess }) {
  let score = 20;
  if (labels.length) score += Math.round(Math.min(25, (labels[0].probability || 0) * 35));
  if (code) score += 25;
  if (typedPart) score += 15;
  if (brand) score += 10;
  if (machine) score += 10;
  if (partGuess !== "peca mecanica ou automotiva a confirmar") score += 10;
  return Math.max(15, Math.min(92, score));
}

function buildAiSearchTerms({ code, typedPart, brand, machine, partGuess }) {
  const main = [code && `"${code}"`, typedPart || partGuess, brand, machine, "peca"].filter(Boolean).join(" ");
  const terms = [
    main,
    [code && `"${code}"`, brand, "catalogo pdf aplicacao"].filter(Boolean).join(" "),
    [typedPart || partGuess, machine, "fornecedor Brasil"].filter(Boolean).join(" "),
    [code && `"${code}"`, "usada remanufaturada"].filter(Boolean).join(" ")
  ];

  return [...new Set(terms.filter(Boolean))];
}

function makeAiSummary({ code, typedPart, brand, machine, partGuess, labels }) {
  const visual = labels[0]?.className ? `Imagem: ${labels[0].className}.` : "Imagem processada.";
  const codeText = code ? `Codigo: ${code}.` : "Codigo: nao confirmado.";
  const context = [typedPart, brand, machine].filter(Boolean).join(" / ");
  const contextText = context ? `Base: ${context}.` : "Base: imagem.";

  return `${partGuess}. ${codeText} ${contextText} ${visual}`;
}

function renderFreeAiReport(analysis) {
  els.aiPartType.textContent = analysis.partGuess;
  els.aiSummary.textContent = analysis.summary;
  els.confidenceText.textContent = `${analysis.confidence}%`;
  els.confidenceBar.style.width = `${analysis.confidence}%`;
  els.aiTags.innerHTML = "";

  const tags = [
    ...analysis.terms,
    ...analysis.labels.slice(0, 3).map(item => `Visual: ${item.className}`)
  ];

  tags.forEach(tag => {
    const span = document.createElement("span");
    span.className = "ai-tag";
    span.textContent = tag;
    els.aiTags.appendChild(span);
  });
}

function applyAnalysisToSearch(analysis) {
  if (!clean(els.partName.value) && analysis.partGuess !== "peca mecanica ou automotiva a confirmar") {
    els.partName.value = analysis.partGuess;
  }
}

function renderPhotoDemo() {
  els.aiPartType.textContent = clean(els.partName.value) || "Peca detectada";
  els.aiSummary.textContent = "Imagem recebida. Fornecedores compativeis selecionados.";
  els.confidenceText.textContent = "68%";
  els.confidenceBar.style.width = "68%";
  els.aiTags.innerHTML = "";
  ["Imagem processada", "Cotacao pronta", "Fornecedores locais"].forEach(tag => {
    const span = document.createElement("span");
    span.className = "ai-tag";
    span.textContent = tag;
    els.aiTags.appendChild(span);
  });
}

function extractPartCodes(text) {
  const raw = text
    .toUpperCase()
    .replace(/[|]/g, "1")
    .replace(/[°º]/g, "0")
    .match(/[A-Z0-9][A-Z0-9./-]{3,28}[A-Z0-9]/g) || [];

  const blacklist = new Set(["BRASIL", "ORIGINAL", "CODIGO", "NUMERO", "PECAS", "PECA", "MODELO"]);

  return [...new Set(raw)]
    .map(item => item.replace(/^[./-]+|[./-]+$/g, ""))
    .filter(item => item.length >= 5)
    .filter(item => !blacklist.has(item))
    .filter(item => /\d/.test(item))
    .sort((a, b) => scoreCode(b) - scoreCode(a))
    .slice(0, 8);
}

function scoreCode(code) {
  let score = code.length;
  if (/\d{5,}/.test(code)) score += 6;
  if (/[A-Z]/.test(code) && /\d/.test(code)) score += 4;
  if (/[/-]/.test(code)) score += 2;
  return score;
}

function addCandidates(candidates, label) {
  els.candidateList.innerHTML = "";
  const title = document.createElement("span");
  title.className = "result-type";
  title.textContent = label;
  els.candidateList.appendChild(title);

  candidates.forEach(candidate => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "candidate-pill";
    btn.textContent = candidate;
    btn.addEventListener("click", () => {
      els.partCode.value = candidate;
      buildSearch();
    });
    els.candidateList.appendChild(btn);
  });
}

function buildSearch(scroll = false) {
  state.query = makeQuery();
  updateQueryPreview();
  renderResults();
  if (scroll) scrollToResults();
}

function makeQuery() {
  const pieces = [
    exact(els.partCode.value),
    els.partName.value,
    els.brand.value,
    els.machine.value,
    els.partType.value,
    els.location.value
  ];

  const base = pieces
    .map(clean)
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

  return base ? `${base} peca autopecas` : "";
}

function updateQueryPreview() {
  const query = makeQuery();
  els.queryPreview.textContent = query || "Tire uma foto ou informe a peca.";
}

function exact(value) {
  const cleanValue = clean(value);
  return cleanValue ? `"${cleanValue}"` : "";
}

function clean(value) {
  return String(value || "").trim();
}

function renderResults() {
  const query = state.query || makeQuery();
  els.resultsGrid.innerHTML = "";

  const cards = buildResultCards(query);
  cards.forEach(card => {
    const node = els.resultTemplate.content.cloneNode(true);
    node.querySelector(".result-type").textContent = card.type;
    node.querySelector("h3").textContent = card.title;
    node.querySelector(".result-desc").innerHTML = card.description;
    const linksWrap = node.querySelector(".buy-links");
    (card.links || []).forEach(link => {
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

function buildResultCards(query) {
  if (!query) {
    return [
      {
        type: "Aguardando foto",
        title: "Nenhuma busca iniciada",
        description: "Tire uma foto da peca para listar fornecedores.",
        action: "Aguardar"
      }
    ];
  }

  return buildPurchaseCards();
}

function buildPurchaseCards() {
  if (!hasMinimumSearchData()) {
    return [{
      type: "Dados insuficientes",
      title: "Nao foi possivel montar links confiaveis",
      description: "Informe codigo, nome da peca, marca ou maquina para buscar ofertas reais.",
      links: []
    }];
  }

  const options = [
    { label: "Peca nova", type: "Nova", condition: "nova original paralela comprar" },
    { label: "Peca usada", type: "Usada", condition: "usada desmanche semi nova comprar" },
    { label: "Remanufaturada", type: "Remanufaturada", condition: "remanufaturada recuperada recondicionada comprar" }
  ];

  return options.map((option, index) => {
    const query = buildSearchQueryForPurchase(option.condition);
    const fallback = query;
    return {
      type: `Compra ${option.type}`,
      title: option.label,
      description: `
        <strong>${escapeHtml(fallback)}</strong>
        <div class="match-row">
          <div class="match-chip"><span>Tipo</span><strong>${escapeHtml(option.type)}</strong></div>
          <div class="match-chip"><span>Codigo</span><strong>${escapeHtml(clean(els.partCode.value) || "A confirmar")}</strong></div>
          <div class="match-chip"><span>Busca</span><strong>Pronta</strong></div>
        </div>
      `,
      links: buildPurchaseLinks(fallback, option.type)
    };
  });
}

function buildPurchaseLinks(query, type) {
  const encoded = encodeURIComponent(query);
  const googleShopping = `https://www.google.com/search?tbm=shop&q=${encoded}`;
  const google = `https://www.google.com/search?q=${encoded}`;
  const mercadoLivre = `https://lista.mercadolivre.com.br/${encoded}`;
  const olx = `https://www.olx.com.br/brasil?q=${encoded}`;
  const shopee = `https://shopee.com.br/search?keyword=${encoded}`;

  const links = [
    { label: "Ver ofertas", url: googleShopping },
    { label: "Comparar precos", url: google },
    { label: "Opcoes de compra", url: mercadoLivre },
    { label: "Mais ofertas", url: shopee }
  ];

  if (type === "Usada") {
    links.splice(2, 0, { label: "Usados proximos", url: olx });
  }

  return links;
}

function matchLocalCatalog(query) {
  const text = query.toLowerCase();
  const scored = localCatalog.map(item => {
    let score = 58;
    if (text.includes(item.family)) score += 24;
    item.family.split(" ").forEach(word => {
      if (word.length > 3 && text.includes(word)) score += 8;
    });
    if (/\d{4,}/.test(text)) score += 10;
    if (/new holland|jcb|volvo|case|caterpillar|komatsu|fiatallis|fiatalis|dynapac/.test(text)) score += 7;
    if (/rg140|3cx|w170|d7|210|ca-25|ca250/.test(text)) score += 7;
    return { ...item, score: Math.min(96, score) };
  });

  const ranked = scored.sort((a, b) => b.score - a.score).slice(0, 6);
  return ranked.some(item => item.score > 70) ? ranked : [
    { ...localCatalog[0], score: 78 },
    { ...localCatalog[1], score: 74 },
    { ...localCatalog[2], score: 69 },
    { ...localCatalog[5], score: 66 }
  ];
}

function estimatePrice(range, seed) {
  const [min, max] = range;
  const factor = ((seed * 37) % 100) / 100;
  return Math.round((min + (max - min) * factor) / 10) * 10;
}

function formatMoney(value) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function scrollToResults() {
  document.querySelector(".results-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function copySupplierRequest(card) {
  if (!card.supplier) return;
  const message = [
    `Fornecedor: ${card.supplier}`,
    `Peca: ${card.part}`,
    `Codigo: ${clean(els.partCode.value) || "nao informado"}`,
    `Maquina: ${clean(els.machine.value) || "nao informado"}`,
    `Valor estimado: ${formatMoney(card.price)}`,
    `Prazo: ${card.deadline}`
  ].join("\n");
  navigator.clipboard?.writeText(message);
  setProgress("Cotacao copiada.", 100);
}

function copyRequest() {
  const message = makeWhatsAppMessage();
  navigator.clipboard?.writeText(message);
  setProgress("Pedido copiado para enviar no WhatsApp.", 100);
}

function makeWhatsAppMessage() {
  return [
    "Estou procurando uma peca.",
    "",
    `Codigo: ${clean(els.partCode.value) || "nao informado"}`,
    `Peca: ${clean(els.partName.value) || "nao informado"}`,
    `Marca: ${clean(els.brand.value) || "nao informado"}`,
    `Maquina/veiculo: ${clean(els.machine.value) || "nao informado"}`,
    `Tipo: ${clean(els.partType.value) || "qualquer"}`,
    `Cidade/UF: ${clean(els.location.value) || "nao informado"}`,
    "",
    "Tem disponivel? Pode me passar valor, prazo e foto?"
  ].join("\n");
}

function saveHistory() {
  const query = makeQuery();
  if (!query) return;

  state.history = [
    {
      query,
      code: clean(els.partCode.value),
      createdAt: new Date().toLocaleString("pt-BR")
    },
    ...state.history.filter(item => item.query !== query)
  ].slice(0, 12);

  save("radarPecasHistory", state.history);
  renderHistory();
  setProgress("Busca salva no historico deste aparelho.", 100);
}

function clearHistory() {
  state.history = [];
  save("radarPecasHistory", state.history);
  renderHistory();
}

function renderHistory() {
  els.historyList.innerHTML = "";
  if (!state.history.length) {
    els.historyList.innerHTML = `<div class="history-item"><div><strong>Nenhuma busca salva</strong><span>As buscas ficam guardadas neste navegador.</span></div></div>`;
    return;
  }

  state.history.forEach(item => {
    const row = document.createElement("div");
    row.className = "history-item";
    row.innerHTML = `<div><strong>${escapeHtml(item.code || "Busca sem codigo")}</strong><span>${escapeHtml(item.query)} - ${escapeHtml(item.createdAt)}</span></div>`;
    const btn = document.createElement("button");
    btn.className = "secondary-btn";
    btn.type = "button";
    btn.textContent = "Reabrir";
    btn.addEventListener("click", () => {
      els.partCode.value = item.code || "";
      state.query = item.query;
      els.queryPreview.textContent = item.query;
      renderResults();
    });
    row.appendChild(btn);
    els.historyList.appendChild(row);
  });
}

function addSupplier() {
  const name = clean(els.supplierName.value);
  const domain = normalizeDomain(els.supplierDomain.value);
  if (!name || !domain) return;

  state.suppliers = [
    ...state.suppliers.filter(item => item.domain !== domain),
    { name, domain, mode: "site" }
  ];
  save("radarPecasSuppliers", state.suppliers);
  els.supplierForm.reset();
  renderSuppliers();
  renderResults();
}

function normalizeDomain(value) {
  return clean(value)
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split("/")[0]
    .toLowerCase();
}

function renderSuppliers() {
  els.supplierList.innerHTML = "";
  state.suppliers.forEach(supplier => {
    const row = document.createElement("div");
    row.className = "supplier-item";
    row.innerHTML = `<div><strong>${escapeHtml(supplier.name)}</strong><span>${escapeHtml(supplier.domain)}</span></div>`;

    if (!defaultSuppliers.some(item => item.domain === supplier.domain)) {
      const btn = document.createElement("button");
      btn.className = "ghost-btn";
      btn.type = "button";
      btn.textContent = "Remover";
      btn.addEventListener("click", () => {
        state.suppliers = state.suppliers.filter(item => item.domain !== supplier.domain);
        save("radarPecasSuppliers", state.suppliers);
        renderSuppliers();
        renderResults();
      });
      row.appendChild(btn);
    }

    els.supplierList.appendChild(row);
  });
}

function resetAll() {
  state.image = null;
  state.enhanced = false;
  state.query = "";
  els.input.value = "";
  els.form.reset();
  els.candidateList.innerHTML = "";
  els.previewWrap.classList.add("is-hidden");
  els.aiPartType.textContent = "Aguardando foto da peca";
  els.aiSummary.textContent = "Use uma foto real para o prototipo sugerir tipo de peca, codigo lido e buscas provaveis.";
  els.confidenceText.textContent = "0%";
  els.confidenceBar.style.width = "0%";
  els.aiTags.innerHTML = "";
  els.queryPreview.textContent = "Tire uma foto ou informe a peca.";
  setProgress("Aguardando foto", 0);
  renderResults();
}

function setProgress(text, percent) {
  const safePercent = Math.max(0, Math.min(100, Number(percent) || 0));
  els.progressText.textContent = text;
  els.progressPercent.textContent = `${safePercent}%`;
  els.progressBar.style.width = `${safePercent}%`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
