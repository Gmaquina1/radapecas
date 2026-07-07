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
  { name: "Mercado Livre", domain: "mercadolivre.com.br", mode: "direct", url: "https://lista.mercadolivre.com.br/" },
  { name: "OLX Brasil", domain: "olx.com.br", mode: "direct", url: "https://www.olx.com.br/brasil?q=" },
  { name: "Shopee", domain: "shopee.com.br", mode: "direct", url: "https://shopee.com.br/search?keyword=" },
  { name: "Google Shopping", domain: "shopping.google.com", mode: "direct", url: "https://www.google.com/search?tbm=shop&q=" },
  { name: "Busca geral Google", domain: "google.com", mode: "direct", url: "https://www.google.com/search?q=" }
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
    buildSearch();
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
      setProgress("Foto carregada. Agora clique em ler codigo.", 12);
      tryBarcodeScan();
    };
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
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

  setProgress("Preparando OCR...", 15);

  try {
    await ensureTesseract();
  } catch {
    setProgress("OCR online indisponivel. Digite o codigo manualmente.", 0);
    return;
  }

  try {
    const result = await Tesseract.recognize(els.canvas, "eng", {
      logger: message => {
        if (message.status === "recognizing text") {
          const pct = Math.round((message.progress || 0) * 100);
          setProgress("Lendo texto da foto...", pct);
        }
      }
    });

    const text = result.data.text || "";
    const candidates = extractPartCodes(text);
    if (candidates.length) {
      addCandidates(candidates, "Codigos sugeridos pelo OCR");
      els.partCode.value = candidates[0];
      buildSearch();
      setProgress("Codigo sugerido. Confira antes de comprar.", 100);
    } else {
      setProgress("Nao encontrei codigo claro. Tente melhorar contraste ou digitar manualmente.", 35);
    }
  } catch {
    setProgress("Nao foi possivel ler esta foto. Tente outra imagem.", 0);
  }
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
    setProgress("Envie uma foto primeiro para a IA analisar.", 0);
    return;
  }

  setProgress("Carregando IA gratuita no navegador...", 18);

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
  buildSearch();
  setProgress("Analise IA pronta para apresentacao.", 100);
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
  const visual = labels[0]?.className ? `A IA visual gratuita viu algo parecido com: ${labels[0].className}.` : "A IA visual gratuita nao trouxe classificacao forte, mas o fluxo de busca continua pelo OCR e dados manuais.";
  const codeText = code ? `Codigo usado na busca: ${code}.` : "Sem codigo confirmado ainda.";
  const context = [typedPart, brand, machine].filter(Boolean).join(" / ");
  const contextText = context ? `Contexto informado: ${context}.` : "Adicione marca ou maquina para aumentar a precisao.";

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

function buildSearch() {
  state.query = makeQuery();
  updateQueryPreview();
  renderResults();
}

function makeQuery() {
  const pieces = [
    exact(els.partCode.value),
    els.partName.value,
    els.brand.value,
    els.machine.value,
    els.partType.value,
    "peca",
    "autopecas",
    els.location.value
  ];

  return pieces
    .map(clean)
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function updateQueryPreview() {
  const query = makeQuery();
  els.queryPreview.textContent = query || "Preencha os dados para montar a busca.";
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
    node.querySelector(".result-desc").textContent = card.description;
    node.querySelector("a").href = card.url;
    els.resultsGrid.appendChild(node);
  });
}

function buildResultCards(query) {
  if (!query) {
    return [
      {
        type: "Aguardando",
        title: "Preencha ou leia o codigo da peca",
        description: "Depois o app cria links de busca em fornecedores e internet.",
        url: "#"
      }
    ];
  }

  const encoded = encodeURIComponent(query);
  const baseCards = defaultSuppliers.map(supplier => ({
    type: "Internet",
    title: supplier.name,
    description: `Buscar por ${query}`,
    url: supplier.url + encoded
  }));

  const customCards = state.suppliers
    .filter(supplier => !defaultSuppliers.some(item => item.domain === supplier.domain))
    .map(supplier => ({
      type: "Fornecedor alvo",
      title: supplier.name,
      description: `Busca no Google apenas dentro de ${supplier.domain}`,
      url: `https://www.google.com/search?q=${encodeURIComponent(`${query} site:${supplier.domain}`)}`
    }));

  const smartCards = [
    {
      type: "Pesquisa tecnica",
      title: "Codigo exato + catalogo PDF",
      description: "Bom para descobrir aplicacao, modelo compativel e catalogos.",
      url: `https://www.google.com/search?q=${encodeURIComponent(`${query} catalogo pdf manual aplicacao`)}`
    },
    {
      type: "Usada / desmanche",
      title: "Peca usada ou remanufaturada",
      description: "Busca focada em peca usada, recuperada e alternativa.",
      url: `https://www.google.com/search?q=${encodeURIComponent(`${query} usada remanufaturada desmanche fornecedor`)}` 
    },
    {
      type: "Linha pesada",
      title: "Maquinas e caminhoes",
      description: "Busca com termos de linha diesel, hidraulica e maquina pesada.",
      url: `https://www.google.com/search?q=${encodeURIComponent(`${query} maquina pesada linha diesel hidraulica`)}` 
    }
  ];

  return [...baseCards, ...smartCards, ...customCards];
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
  els.queryPreview.textContent = "Preencha os dados para montar a busca.";
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
