const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");

const PORT = Number(process.env.PORT || 3000);
const ROOT = __dirname;
loadEnvFile(path.join(ROOT, ".env"));
const RAW_OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const OPENAI_API_KEY = RAW_OPENAI_API_KEY.includes("coloque_sua_chave") ? "" : RAW_OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-5.5";
const APP_VERSION = "v2.3.0-busca-servidor";
const MARKETPLACE_API = "https://api.mercadolibre.com/sites/MLB/search";
const MAX_BODY_BYTES = 8 * 1024 * 1024;

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml"
};

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);

    if (req.method === "GET" && url.pathname === "/health") {
      sendJson(res, 200, {
        ok: true,
        version: APP_VERSION,
        aiConfigured: Boolean(OPENAI_API_KEY),
        model: OPENAI_MODEL
      });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/analyze-image") {
      await handleAnalyzeImage(req, res);
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/search-offers") {
      await handleSearchOffers(url, res);
      return;
    }

    if (req.method === "GET" || req.method === "HEAD") {
      serveStatic(req, res, url.pathname);
      return;
    }

    sendJson(res, 405, { ok: false, error: "Metodo nao permitido." });
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Erro interno: ${error.message}`);
    sendJson(res, 500, { ok: false, error: "Erro interno.", detail: error.message });
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Radar Pecas ${APP_VERSION} rodando em http://localhost:${PORT}`);
  console.log(OPENAI_API_KEY ? `IA ativa com modelo ${OPENAI_MODEL}` : "IA sem chave: configure OPENAI_API_KEY.");
});

async function handleAnalyzeImage(req, res) {
  const startedAt = Date.now();
  console.log(`[${new Date().toISOString()}] IA: chamada recebida em /api/analyze-image`);

  if (!OPENAI_API_KEY) {
    console.log(`[${new Date().toISOString()}] IA: OPENAI_API_KEY nao configurada`);
    sendJson(res, 503, { ok: false, error: "OPENAI_API_KEY nao configurada." });
    return;
  }

  const body = await readJsonBody(req);
  const imageDataUrl = String(body.imageDataUrl || "");

  if (!/^data:image\/(jpeg|jpg|png|webp);base64,/i.test(imageDataUrl)) {
    console.log(`[${new Date().toISOString()}] IA: imagem invalida ou vazia`);
    sendJson(res, 400, { ok: false, error: "Imagem invalida." });
    return;
  }

  try {
    const result = await callVisionModel({
      imageDataUrl,
      fileName: String(body.fileName || ""),
      context: body.context || {}
    });

    console.log(`[${new Date().toISOString()}] IA: sucesso em ${Date.now() - startedAt}ms | peca=${result.partName || "sem nome"} | familia=${result.partFamily || "sem familia"} | confianca=${result.confidence}`);
    sendJson(res, 200, { ok: true, result });
  } catch (error) {
    console.error(`[${new Date().toISOString()}] IA: falhou - ${error.message}`);
    sendJson(res, 502, { ok: false, error: "IA indisponivel.", detail: error.message });
  }
}

async function handleSearchOffers(url, res) {
  const query = String(url.searchParams.get("q") || "").trim();
  const limit = Math.max(1, Math.min(50, Number(url.searchParams.get("limit") || 30)));

  if (!query) {
    sendJson(res, 400, { ok: false, error: "Consulta vazia." });
    return;
  }

  try {
    const apiUrl = `${MARKETPLACE_API}?q=${encodeURIComponent(query)}&limit=${limit}`;
    console.log(`[${new Date().toISOString()}] Busca: ${query}`);
    const response = await fetch(apiUrl, {
      headers: {
        "Accept": "application/json",
        "User-Agent": "RadarPecas/2.3"
      }
    });

    const data = await response.json();
    if (!response.ok) {
      const detail = data?.message || data?.error || "Falha ao buscar ofertas.";
      console.error(`[${new Date().toISOString()}] Busca: falhou - ${detail}`);
      sendJson(res, 502, { ok: false, error: detail, results: [] });
      return;
    }

    const results = (data.results || [])
      .map(item => ({
        title: item.title || "",
        price: Number(item.price || 0),
        url: item.permalink || "",
        condition: item.condition || "",
        thumbnail: item.thumbnail || ""
      }))
      .filter(offer => offer.title && offer.price > 0 && offer.url);

    console.log(`[${new Date().toISOString()}] Busca: ${results.length} oferta(s) para "${query}"`);
    sendJson(res, 200, { ok: true, results });
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Busca: erro - ${error.message}`);
    sendJson(res, 502, { ok: false, error: error.message, results: [] });
  }
}

async function callVisionModel({ imageDataUrl, fileName, context }) {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      input: [
        {
          role: "system",
          content: [
            "Voce e uma IA especialista em reconhecimento visual de pecas para compra e cotacao.",
            "Sua prioridade numero 1 e identificar que objeto/peca aparece na foto, mesmo quando nao existe codigo visivel.",
            "Nunca deixe o nome visual da peca vazio. Se nao tiver certeza, informe o melhor palpite visual e reduza a confianca.",
            "Depois procure codigos, marca, etiqueta, QR/barcode, aplicacao e sinais de condicao.",
            "Classifique o segmento somente entre: automotiva, moto, caminhao, maquina, eletrodomestico, industrial, eletrica, eletronica ou hidraulica. Se nao couber bem, use null.",
            "Quando nao houver codigo, informe o nome visual provavel da peca, a familia visual e termos de busca uteis.",
            "Nao invente codigo, marca ou modelo. Para codigo/marca/modelo use null quando nao estiver visivel.",
            "Para nome da peca, use o melhor palpite visual e reduza a confianca se estiver incerto. Exemplos uteis: bico injetor, sensor de rotacao, rolamento, placa eletronica, modulo eletronico, bomba hidraulica, valvula solenoide, filtro, mangueira, engrenagem, conector, fonte, motor eletrico.",
            "Responda em portugues do Brasil."
          ].join(" ")
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: buildPrompt(fileName, context)
            },
            {
              type: "input_image",
              image_url: imageDataUrl,
              detail: "high"
            }
          ]
        }
      ],
      text: {
        format: {
          type: "json_schema",
          name: "radar_pecas_vision",
          strict: true,
          schema: partSchema()
        }
      }
    })
  });

  const data = await response.json();

  if (!response.ok) {
    const message = [
      data?.error?.message || "Falha na IA.",
      data?.error?.type ? `tipo=${data.error.type}` : "",
      data?.error?.code ? `codigo=${data.error.code}` : ""
    ].filter(Boolean).join(" | ");
    throw new Error(message);
  }

  return normalizeAiResult(parseModelJson(data));
}

function buildPrompt(fileName, context) {
  return [
    "Analise a imagem da peca e extraia os dados para busca de compra.",
    "Primeiro identifique visualmente o que e a peca: formato, material, conectores, furos, engrenagens, placa, carcaca, bico, bomba, sensor, valvula, filtro, rolamento, mangueira, motor, fonte, modulo ou outro objeto.",
    "O campo partName deve sempre ter um melhor palpite visual em portugues, mesmo com baixa confianca.",
    "O campo partFamily deve sempre ter uma categoria curta, por exemplo sensor, placa, bico, bomba, valvula, filtro, rolamento, mangueira, modulo, motor, conector, engrenagem ou peca desconhecida.",
    "Depois procure codigos gravados, etiqueta, QR/barcode, marca, nome da peca, aplicacao/modelo e segmento.",
    "Se nao existir codigo legivel, monte searchTerms com nome visual da peca, familia, segmento e caracteristicas visiveis.",
    "Classifique a condicao apenas se houver sinal claro: original, paralela, usada ou remanufaturada.",
    "Se for uma foto sem codigo legivel, ainda assim identifique a peca provavel pela aparencia e reduza a confianca.",
    "",
    `Arquivo: ${fileName || "nao informado"}`,
    `Dados ja informados pelo usuario: ${JSON.stringify(context || {})}`
  ].join("\n");
}

function partSchema() {
  return {
    type: "object",
    additionalProperties: false,
    required: [
      "partCode",
      "alternativeCodes",
      "partName",
      "partFamily",
      "visualDescription",
      "visualFeatures",
      "brand",
      "applicationModel",
      "segment",
      "condition",
      "confidence",
      "searchTerms",
      "visibleText",
      "notes"
    ],
    properties: {
      partCode: { type: ["string", "null"], description: "Codigo principal da peca, se visivel." },
      alternativeCodes: {
        type: "array",
        items: { type: "string" },
        description: "Outros codigos ou referencias visiveis."
      },
      partName: { type: "string", description: "Melhor palpite visual da peca, mesmo sem codigo. Ex: bico injetor, sensor, rolamento, placa eletronica, filtro, bomba, valvula. Se incerto, use algo como peca mecanica nao identificada." },
      partFamily: { type: "string", description: "Familia ou categoria visual da peca. Ex: sensor, bico, bomba, placa, filtro, rolamento, mangueira, modulo, motor, conector ou peca desconhecida." },
      visualDescription: { type: "string", description: "Descricao curta do que aparece fisicamente na imagem." },
      visualFeatures: {
        type: "array",
        items: { type: "string" },
        description: "Caracteristicas visiveis uteis para busca, como formato, conectores, furos, cor, material, etiqueta ou encaixes."
      },
      brand: { type: ["string", "null"], description: "Marca da peca ou fabricante, se visivel." },
      applicationModel: { type: ["string", "null"], description: "Modelo/aplicacao compativel, se visivel ou inferido com confianca." },
      segment: {
        type: ["string", "null"],
        enum: ["automotiva", "moto", "caminhao", "maquina", "eletrodomestico", "industrial", "eletrica", "eletronica", "hidraulica", null]
      },
      condition: {
        type: ["string", "null"],
        enum: ["original", "paralela", "usada", "remanufaturada", null]
      },
      confidence: { type: "number", minimum: 0, maximum: 100 },
      searchTerms: {
        type: "array",
        items: { type: "string" },
        description: "Termos objetivos para buscar fornecedores e anuncios."
      },
      visibleText: { type: ["string", "null"], description: "Texto lido na imagem." },
      notes: { type: ["string", "null"], description: "Observacao curta sobre confianca ou limitacao da leitura." }
    }
  };
}

function parseModelJson(data) {
  if (data.output_text) return JSON.parse(data.output_text);

  const text = (data.output || [])
    .flatMap(item => item.content || [])
    .map(content => content.text || "")
    .join("")
    .trim();

  if (!text) throw new Error("IA nao retornou texto.");
  return JSON.parse(text);
}

function normalizeAiResult(result) {
  return {
    partCode: cleanNullable(result.partCode),
    alternativeCodes: Array.isArray(result.alternativeCodes) ? result.alternativeCodes.map(String).filter(Boolean).slice(0, 8) : [],
    partName: cleanNullable(result.partName),
    partFamily: cleanNullable(result.partFamily),
    visualDescription: cleanNullable(result.visualDescription),
    visualFeatures: Array.isArray(result.visualFeatures) ? result.visualFeatures.map(String).filter(Boolean).slice(0, 8) : [],
    brand: cleanNullable(result.brand),
    applicationModel: cleanNullable(result.applicationModel),
    segment: cleanNullable(result.segment),
    condition: cleanNullable(result.condition),
    confidence: Math.max(0, Math.min(100, Number(result.confidence || 0))),
    searchTerms: Array.isArray(result.searchTerms) ? result.searchTerms.map(String).filter(Boolean).slice(0, 8) : [],
    visibleText: cleanNullable(result.visibleText),
    notes: cleanNullable(result.notes)
  };
}

function cleanNullable(value) {
  const text = String(value || "").trim();
  return text || null;
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let total = 0;
    const chunks = [];

    req.on("data", chunk => {
      total += chunk.length;
      if (total > MAX_BODY_BYTES) {
        reject(new Error("Imagem muito grande."));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });

    req.on("end", () => {
      try {
        const text = Buffer.concat(chunks).toString("utf8");
        resolve(text ? JSON.parse(text) : {});
      } catch {
        reject(new Error("JSON invalido."));
      }
    });

    req.on("error", reject);
  });
}

function serveStatic(req, res, pathname) {
  const requested = pathname === "/" ? "/index.html" : pathname;
  const decoded = decodeURIComponent(requested);
  const filePath = path.normalize(path.join(ROOT, decoded));

  if (!filePath.startsWith(ROOT)) {
    sendText(res, 403, "Acesso negado.");
    return;
  }

  fs.readFile(filePath, (error, content) => {
    if (error) {
      sendText(res, 404, "Arquivo nao encontrado.");
      return;
    }

    const type = MIME_TYPES[path.extname(filePath).toLowerCase()] || "application/octet-stream";
    res.writeHead(200, {
      "Content-Type": type,
      "Cache-Control": "no-store"
    });

    if (req.method !== "HEAD") res.end(content);
    else res.end();
  });
}

function sendJson(res, status, payload) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(JSON.stringify(payload));
}

function sendText(res, status, text) {
  res.writeHead(status, { "Content-Type": "text/plain; charset=utf-8" });
  res.end(text);
}

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;

  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  lines.forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;

    const index = trimmed.indexOf("=");
    if (index === -1) return;

    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim().replace(/^["']|["']$/g, "");
    if (key && !process.env[key]) process.env[key] = value;
  });
}
