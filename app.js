const APP_VERSION = "v2.3.0-busca-servidor";
const TESSERACT_CDN = "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js";
const MARKETPLACE_API = "/api/search-offers";
const VISION_AI_ENDPOINT = "/api/analyze-image";

const state = {
  imageLoaded: false,
  fileName: "",
  lastAiResult: null,
  lastOcrText: "",
  lastCodes: []
};

const els = {
  versionBadge: document.querySelector("#versionBadge"),
  input: document.querySelector("#photoInput"),
  cameraInput: document.querySelector("#cameraInput"),
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
  segment: document.querySelector("#segment"),
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

  els.cameraInput.addEventListener("change", event => {
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

  [els.partCode, els.partName, els.brand, els.machine, els.location, els.segment, els.partType].forEach(input => {
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
      setProgress("Foto carregada. Clique em Reconhecer com IA.", 20);
      setAnalysis("Foto carregada", "Pronto para ler codigo, etiqueta, placa, embalagem ou texto da peca.", 0, ["aguardando reconhecimento"]);
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
  setProgress("Contraste aplicado. Clique em Reconhecer com IA novamente.", 25);
}

async function analyzeWithVisionAi() {
  try {
    const imageDataUrl = canvasToAiImage();
    const response = await fetch(VISION_AI_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        imageDataUrl,
        fileName: state.fileName,
        context: {
          code: clean(els.partCode.value),
          partName: clean(els.partName.value),
          brand: clean(els.brand.value),
          applicationModel: clean(els.machine.value),
          segment: selectedSegmentText(),
          condition: selectedConditionText()
        }
      })
    });

    if (!response.ok) {
      const data = await safeReadJson(response);
      const detail = clean(data?.detail || data?.error);
      setProgress(detail ? `IA indisponivel: ${detail}` : "IA indisponivel. Usando leitura local...", 18);
      setAnalysis(
        "IA nao analisou a foto",
        detail || "A chamada para a IA nao retornou uma resposta valida. Veja os Logs do Render.",
        0,
        ["erro na IA", "ver logs"]
      );
      return null;
    }

    const data = await response.json();
    if (!data.ok || !data.result) {
      setProgress("IA nao confirmou a peca. Usando leitura local...", 18);
      setAnalysis(
        "IA nao retornou identificacao",
        "O servidor respondeu, mas nao trouxe o nome visual da peca.",
        0,
        ["sem resposta visual", "ver logs"]
      );
      return null;
    }

    state.lastAiResult = data.result;
    return data.result;
  } catch (error) {
    setProgress(`IA offline: ${error.message || "falha de conexao"}`, 18);
    setAnalysis(
      "IA offline",
      error.message || "Nao foi possivel enviar a foto para o servidor.",
      0,
      ["falha de conexao", "ver logs"]
    );
    return null;
  }
}

async function safeReadJson(response) {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

function canvasToAiImage() {
  const maxSide = 1280;
  const scale = Math.min(1, maxSide / Math.max(els.canvas.width, els.canvas.height));
  const target = document.createElement("canvas");
  target.width = Math.max(1, Math.round(els.canvas.width * scale));
  target.height = Math.max(1, Math.round(els.canvas.height * scale));

  const ctx = target.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, target.width, target.height);
  ctx.drawImage(els.canvas, 0, 0, target.width, target.height);

  return target.toDataURL("image/jpeg", 0.86);
}

function applyAiResult(result) {
  const codes = [
    clean(result.partCode),
    ...(Array.isArray(result.alternativeCodes) ? result.alternativeCodes.map(clean) : [])
  ].filter(Boolean);

  if (codes.length) {
    applyDetectedCodes(codes, "IA encontrou codigo(s)");
  }

  if (!clean(els.partName.value) && clean(result.partName)) els.partName.value = clean(result.partName);
  if (!clean(els.partName.value) && clean(result.partFamily)) els.partName.value = clean(result.partFamily);
  if (!clean(els.brand.value) && clean(result.brand)) els.brand.value = clean(result.brand);
  if (!clean(els.machine.value) && clean(result.applicationModel)) els.machine.value = clean(result.applicationModel);

  selectByAiValue(els.segment, result.segment);
  selectByAiValue(els.partType, result.condition);

  const hasAnyResult = Boolean(
    clean(els.partCode.value) ||
    clean(els.partName.value) ||
    clean(els.brand.value) ||
    clean(els.machine.value)
  );

  if (!hasAnyResult) {
    setAnalysis(
      "IA nao confirmou a peca",
      clean(result.visualDescription) || clean(result.notes) || "A foto nao trouxe informacao suficiente para uma busca confiavel.",
      confidenceFromAi(result),
      ["foto inconclusiva", "preencha dados"]
    );
    return false;
  }

  setAnalysis(
    clean(result.partName) || clean(result.partCode) || "Peca identificada por IA",
    clean(result.visualDescription) || clean(result.notes) || "IA de visao analisou a foto e extraiu os dados principais.",
    confidenceFromAi(result),
    buildAiTags(result)
  );

  updateQueryPreview();
  return true;
}

function selectByAiValue(select, value) {
  const normalized = normalizeText(value);
  if (!select || !normalized) return;

  const aliases = {
    novo: "original",
    nova: "original",
    new: "original",
    original: "original",
    paralela: "paralela",
    paralelo: "paralela",
    usada: "usada",
    usado: "usada",
    used: "usada",
    reman: "remanufaturada",
    remanufaturada: "remanufaturada",
    remanufaturado: "remanufaturada",
    recondicionada: "remanufaturada",
    recondicionado: "remanufaturada",
    recuperada: "remanufaturada",
    recuperado: "remanufaturada",
    automotivo: "automotiva",
    automotiva: "automotiva",
    motocicleta: "moto",
    moto: "moto",
    caminhao: "caminhao",
    maquina: "maquina",
    agricola: "maquina",
    eletrodomestico: "eletrodomestico",
    industrial: "industrial",
    eletrica: "eletrica",
    eletronica: "eletronica",
    hidraulica: "hidraulica"
  };

  const wanted = aliases[normalized] || normalized;
  const option = [...select.options].find(item => item.value === wanted || normalizeText(item.textContent) === wanted);
  if (option) select.value = option.value;
}

function confidenceFromAi(result) {
  const value = Number(result?.confidence || 0);
  if (value <= 1) return Math.round(value * 100);
  return Math.max(0, Math.min(100, Math.round(value)));
}

function buildAiTags(result) {
  return [
    clean(result.partCode) ? `codigo ${clean(result.partCode)}` : "codigo a confirmar",
    clean(result.partFamily) || "",
    clean(result.segment) || selectedSegmentText() || "segmento geral",
    clean(result.condition) || "condicao a confirmar",
    ...(Array.isArray(result.visualFeatures) ? result.visualFeatures.slice(0, 2).map(clean).filter(Boolean) : []),
    ...(Array.isArray(result.searchTerms) ? result.searchTerms.slice(0, 2).map(clean).filter(Boolean) : [])
  ].filter(Boolean);
}

async function recognizePhoto() {
  if (!state.imageLoaded) {
    setProgress("Envie uma foto primeiro.", 0);
    return;
  }

  clearCandidates();
  setProgress("Reconhecendo foto com IA...", 12);

  const aiResult = await analyzeWithVisionAi();
  if (aiResult && applyAiResult(aiResult) && hasSearchData()) {
    await finishRecognition("IA analisou a foto. Verificando anuncios reais.", confidenceFromAi(aiResult));
    return;
  }

  const barcodeCodes = await detectBarcodeCodes();
  if (barcodeCodes.length) {
    applyDetectedCodes(barcodeCodes, "Codigo de barras");
    await finishRecognition("Codigo encontrado por leitor de barras.", 90);
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
    await finishRecognition(codes.length ? "Codigo reconhecido. Verificando anuncios reais." : "Texto analisado. Verificando anuncios reais.", codes.length ? 82 : 58);
  } else {
    setAnalysis(
      "Nao consegui identificar a peca",
      "A foto nao trouxe codigo legivel. Preencha codigo, nome, marca ou aplicacao/modelo e clique em Buscar peca.",
      25,
      ["foto sem codigo claro", "preencha dados para buscar"]
    );
    renderEmptyResults("Informe codigo, nome, marca ou aplicacao/modelo para montar links reais.");
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
    const variants = buildOcrCanvases();
    const texts = [];

    for (let index = 0; index < variants.length; index += 1) {
      const minPct = 15 + (index * 24);
      const maxPct = Math.min(88, minPct + 22);
      const label = index === 0 ? "Lendo texto/codigo da foto..." : `Conferindo imagem ${index + 1}/${variants.length}...`;
      const text = await recognizeCanvasText(variants[index], label, minPct, maxPct);
      texts.push(text);
    }

    return texts.join("\n");
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

function buildOcrCanvases() {
  return [
    cloneCanvas(els.canvas, "normal"),
    cloneCanvas(els.canvas, "contrast"),
    cloneCanvas(els.canvas, "inverted"),
    cloneCanvas(els.canvas, "sharp")
  ];
}

function cloneCanvas(source, mode) {
  const target = document.createElement("canvas");
  target.width = source.width;
  target.height = source.height;

  const sourceCtx = source.getContext("2d", { willReadFrequently: true });
  const targetCtx = target.getContext("2d", { willReadFrequently: true });
  const imageData = sourceCtx.getImageData(0, 0, source.width, source.height);
  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    let value = gray;

    if (mode === "contrast") {
      value = gray > 145 ? 255 : 0;
    }

    if (mode === "inverted") {
      value = gray > 145 ? 0 : 255;
    }

    if (mode === "sharp") {
      value = Math.max(0, Math.min(255, (gray - 110) * 2.2 + 110));
    }

    data[i] = value;
    data[i + 1] = value;
    data[i + 2] = value;
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
    ["bomba", ["bomba", "pump"]],
    ["filtro", ["filtro", "filter"]],
    ["sensor", ["sensor", "sonda"]],
    ["modulo eletronico", ["modulo", "module", "ecu", "central"]],
    ["placa eletronica", ["placa", "board", "pci", "eletronica"]],
    ["bico injetor", ["injetor", "injector", "bico"]],
    ["radiador", ["radiador", "cooler"]],
    ["rolamento", ["rolamento", "bearing"]],
    ["correia", ["correia", "belt"]],
    ["mangueira", ["mangueira", "hose"]],
    ["pastilha de freio", ["pastilha", "brake", "freio"]],
    ["disco de freio", ["disco", "brake", "freio"]],
    ["vela de ignicao", ["vela", "spark", "ignicao"]],
    ["bobina", ["bobina", "coil"]],
    ["amortecedor", ["amortecedor", "shock"]],
    ["retentor", ["retentor", "seal"]],
    ["junta", ["junta", "gasket"]],
    ["engrenagem", ["engrenagem", "gear"]],
    ["valvula", ["valvula", "valve"]],
    ["resistencia", ["resistencia", "heating"]],
    ["compressor", ["compressor"]],
    ["termostato", ["termostato", "thermostat"]],
    ["fonte", ["fonte", "power supply"]],
    ["conector", ["conector", "connector"]]
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
      finishRecognition("Codigo selecionado. Verificando anuncios reais.", 82);
    });
    els.candidateList.appendChild(button);
  });
}

async function finishRecognition(message, confidence) {
  const searchText = baseSearchText();
  setAnalysis(
    clean(els.partName.value) || clean(els.partCode.value) || "Peca reconhecida",
    message,
    confidence,
    buildTags(searchText)
  );
  updateQueryPreview();
  await renderPurchaseCards();
  setProgress("Resultados prontos.", 100);
  scrollToResults();
}

async function runManualSearch() {
  if (!hasSearchData()) {
    renderEmptyResults("Informe codigo, nome da peca, marca ou aplicacao/modelo.");
    setProgress("Dados insuficientes para buscar.", 0);
    return;
  }

  await finishRecognition("Busca montada. Verificando anuncios reais.", 70);
}

async function renderPurchaseCards() {
  const base = baseSearchText();
  if (!base) {
    renderEmptyResults("Informe codigo, nome da peca, marca ou aplicacao/modelo.");
    return;
  }

  els.resultsGrid.innerHTML = "";
  els.queryPreview.textContent = base;
  setProgress("Buscando anuncios com preco real...", 88);

  let cardRequests = [
    {
      key: "new",
      type: "Nova",
      title: selectedConditionTitle() || "Peca nova confirmada",
      query: `${purchaseSearchText()} nova`,
      chips: ["Nova", clean(els.partCode.value) || "Codigo a confirmar", "Anuncio confirmado"]
    },
    {
      key: "used",
      type: "Usada",
      title: "Peca usada confirmada",
      query: `${purchaseSearchText()} usada`,
      chips: ["Usada", clean(els.partCode.value) || "Codigo a confirmar", "Existe anuncio"]
    },
    {
      key: "reman",
      type: "Remanufaturada",
      title: "Remanufaturada confirmada",
      query: `${purchaseSearchText()} remanufaturada`,
      chips: ["Remanufaturada", clean(els.partCode.value) || "Codigo a confirmar", "Existe anuncio"]
    }
  ];

  if (els.partType.value === "usada") {
    cardRequests = cardRequests.filter(card => card.key === "used");
  }

  if (els.partType.value === "remanufaturada") {
    cardRequests = cardRequests.filter(card => card.key === "reman");
  }

  if (["original", "paralela"].includes(els.partType.value)) {
    cardRequests = cardRequests.filter(card => card.key === "new");
  }

  const cards = await findConfirmedCards(cardRequests);

  if (!cards.length) {
    renderFallbackSearchLinks("Nao encontrei preco confirmado ainda. Use estes links para abrir buscas prontas com a peca identificada.");
    return;
  }

  cards.forEach(card => {
    const node = els.resultTemplate.content.cloneNode(true);
    node.querySelector(".result-type").textContent = card.type;
    node.querySelector("h3").textContent = card.title;
    node.querySelector(".result-desc").innerHTML = `
      <strong>${escapeHtml(card.offers.length)} anuncio(s) encontrado(s) com preco</strong>
      <div class="match-row">
        <div class="match-chip"><span>Tipo</span><strong>${escapeHtml(card.chips[0])}</strong></div>
        <div class="match-chip"><span>Codigo</span><strong>${escapeHtml(card.chips[1])}</strong></div>
        <div class="match-chip"><span>Foco</span><strong>${escapeHtml(card.chips[2])}</strong></div>
      </div>
      <div class="offer-list">
        ${card.offers.map(offer => `
          <a href="${escapeHtml(offer.url)}" target="_blank" rel="noopener" class="offer-row">
            <span>${escapeHtml(offer.title)}</span>
            <strong>${formatCurrency(offer.price)}</strong>
          </a>
        `).join("")}
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

async function findConfirmedCards(cardRequests) {
  const responses = await Promise.all(cardRequests.map(async card => {
    const offers = await searchMarketplaceWithFallback(card);
    return {
      ...card,
      offers: filterOffersByCategory(offers, card.key).slice(0, 3)
    };
  }));

  return responses.filter(card => card.offers.length);
}

async function searchMarketplaceWithFallback(card) {
  const queries = buildOfferQueries(card);
  const seenUrls = new Set();
  const combined = [];

  for (const query of queries) {
    const offers = await searchMarketplace(query);
    offers.forEach(offer => {
      if (!seenUrls.has(offer.url)) {
        seenUrls.add(offer.url);
        combined.push(offer);
      }
    });

    if (combined.length >= 12) break;
  }

  return combined;
}

function buildOfferQueries(card) {
  const code = clean(els.partCode.value);
  const main = purchaseSearchText();
  const part = clean(els.partName.value) || clean(state.lastAiResult?.partName) || clean(state.lastAiResult?.partFamily);
  const brand = clean(els.brand.value);
  const machine = clean(els.machine.value);
  const family = clean(state.lastAiResult?.partFamily);

  const conditionWords = {
    new: ["nova", "original"],
    used: ["usada", "desmanche"],
    reman: ["remanufaturada", "recondicionada"]
  }[card.key] || [];

  return [
    [code, ...conditionWords].join(" "),
    [code, part, brand, machine].join(" "),
    [part, brand, machine, conditionWords[0]].join(" "),
    [part, family, conditionWords[0]].join(" "),
    main
  ]
    .map(item => item.replace(/\s+/g, " ").trim())
    .filter(item => item.length >= 3)
    .filter((item, index, list) => list.indexOf(item) === index);
}

async function searchMarketplace(query) {
  try {
    const url = `${MARKETPLACE_API}?q=${encodeURIComponent(query)}&limit=30`;
    const response = await fetch(url);
    if (!response.ok) return [];
    const data = await response.json();
    return (data.results || [])
      .map(item => ({
        title: item.title || "",
        price: Number(item.price || 0),
        url: item.permalink || "",
        condition: item.condition || ""
      }))
      .filter(offer => offer.title && offer.price > 0 && offer.url);
  } catch {
    return [];
  }
}

function filterOffersByCategory(offers, categoryKey) {
  return offers
    .map(offer => ({ ...offer, score: scoreOfferMatch(offer, categoryKey) }))
    .filter(offer => offer.score >= minimumOfferScore())
    .sort((a, b) => {
      if (a.price !== b.price) return a.price - b.price;
      return b.score - a.score;
    });
}

function scoreOfferMatch(offer, categoryKey) {
  const title = normalizeText(offer.title);
  const titleCompact = compactText(offer.title);
  const code = compactText(els.partCode.value);
  const terms = buildRelevanceTerms();
  let score = 0;

  if (code.length >= 5 && titleCompact.includes(code)) score += 70;
  if (code.length >= 5 && !titleCompact.includes(code)) score -= 35;

  terms.forEach(term => {
    if (title.includes(term)) score += 12;
  });

  if (categoryKey === "new") {
    if (offer.condition === "new") score += 25;
    if (hasUsedSignal(title) || hasRemanSignal(title)) score -= 80;
  }

  if (categoryKey === "used") {
    if (offer.condition === "used" || hasUsedSignal(title)) score += 35;
    if (!(offer.condition === "used" || hasUsedSignal(title))) score -= 100;
  }

  if (categoryKey === "reman") {
    if (hasRemanSignal(title)) score += 45;
    if (!hasRemanSignal(title)) score -= 100;
  }

  return score;
}

function minimumOfferScore() {
  const code = compactText(els.partCode.value);
  const terms = buildRelevanceTerms();
  if (code.length >= 5) return 65;
  return terms.length >= 2 ? 18 : 22;
}

function buildRelevanceTerms() {
  const raw = [
    clean(els.partName.value),
    clean(els.brand.value),
    clean(els.machine.value),
    selectedSegmentText(),
    visualSearchTerms().join(" ")
  ].join(" ");

  const blocked = new Set(["peca", "pecas", "codigo", "original", "paralela", "comprar", "para", "com"]);

  return normalizeText(raw)
    .split(/\s+/)
    .filter(word => word.length >= 3)
    .filter(word => !blocked.has(word))
    .slice(0, 8);
}

function hasUsedSignal(text) {
  return /(usad|semi\s?nov|desmanch|retirad|sucata|segunda mao)/.test(text);
}

function hasRemanSignal(text) {
  return /(reman|remanufaturad|recondicionad|recuperad|retificad|revisad)/.test(text);
}

function buildPurchaseLinks(query, type) {
  const encoded = encodeURIComponent(query);
  const marketplaceSlug = slugForMarketplace(query);
  const links = [
    { label: "Buscar mais ofertas", url: `https://www.google.com/search?tbm=shop&q=${encoded}` },
    { label: "Comparar na internet", url: `https://www.google.com/search?q=${encoded}` },
    { label: "Ver lista completa", url: `https://lista.mercadolivre.com.br/${marketplaceSlug}` },
    { label: "Procurar em lojas", url: `https://shopee.com.br/search?keyword=${encoded}` }
  ];

  if (type === "Usada") {
    links.splice(2, 0, { label: "Usados proximos", url: `https://www.olx.com.br/brasil?q=${encoded}` });
  }

  return links;
}

function formatCurrency(value) {
  return Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });
}

function normalizeText(value) {
  return clean(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function compactText(value) {
  return normalizeText(value).replace(/[^a-z0-9]/g, "");
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

function renderFallbackSearchLinks(message) {
  const query = purchaseSearchText() || baseSearchText();
  els.resultsGrid.innerHTML = "";
  els.queryPreview.textContent = query || message;

  const node = els.resultTemplate.content.cloneNode(true);
  node.querySelector(".result-type").textContent = "Busca pronta";
  node.querySelector("h3").textContent = clean(els.partName.value) || clean(state.lastAiResult?.partName) || "Peca identificada";
  node.querySelector(".result-desc").textContent = message;

  const linksWrap = node.querySelector(".buy-links");
  buildPurchaseLinks(query || clean(els.partName.value) || "peca", "Busca").forEach(link => {
    const anchor = document.createElement("a");
    anchor.href = link.url;
    anchor.target = "_blank";
    anchor.rel = "noopener";
    anchor.textContent = link.label;
    linksWrap.appendChild(anchor);
  });

  els.resultsGrid.appendChild(node);
}

function hasSearchData() {
  return Boolean(baseSearchText());
}

function baseSearchText() {
  return [
    clean(els.partCode.value),
    clean(els.partName.value),
    clean(els.brand.value),
    clean(els.machine.value),
    selectedSegmentText(),
    ...visualSearchTerms()
  ].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
}

function purchaseSearchText() {
  const code = clean(els.partCode.value);
  if (code) {
    return [
      code,
      clean(els.brand.value),
      clean(els.machine.value)
    ].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
  }

  return [
    clean(els.partName.value) || clean(state.lastAiResult?.partName) || clean(state.lastAiResult?.partFamily),
    clean(els.brand.value),
    clean(els.machine.value),
    selectedSegmentText()
  ].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
}

function visualSearchTerms() {
  const result = state.lastAiResult || {};
  return [
    clean(result.partFamily),
    ...(Array.isArray(result.searchTerms) ? result.searchTerms.map(clean) : []),
    ...(Array.isArray(result.visualFeatures) ? result.visualFeatures.map(clean) : [])
  ]
    .filter(Boolean)
    .filter((item, index, list) => list.indexOf(item) === index)
    .slice(0, 4);
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
    `Aplicacao/modelo: ${clean(els.machine.value) || "nao informado"}`,
    `Segmento: ${selectedSegmentText() || "nao informado"}`,
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
  els.cameraInput.value = "";
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

function selectedSegmentText() {
  if (!els.segment || !els.segment.value) return "";
  const option = els.segment.options[els.segment.selectedIndex];
  return clean(option?.textContent || els.segment.value);
}

function selectedConditionText() {
  if (!els.partType || !els.partType.value) return "";
  const option = els.partType.options[els.partType.selectedIndex];
  return clean(option?.textContent || els.partType.value);
}

function selectedConditionTitle() {
  if (els.partType.value === "original") return "Peca original confirmada";
  if (els.partType.value === "paralela") return "Peca paralela confirmada";
  return "";
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
