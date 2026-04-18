const express = require("express");
const cors    = require("cors");
const path    = require("path");

const app  = express();
const PORT = Number(process.env.PORT || 3000);

const REMAX_BASE = "https://remax.com.mx";

app.use(cors({ origin: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, "../../frontend/public")));

const BROWSER_HEADERS = {
  "User-Agent"     : "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  "Accept"         : "application/json, text/plain, */*",
  "Accept-Language": "es-MX,es;q=0.9,en;q=0.8",
  "Referer"        : "https://remax.com.mx/",
  "Origin"         : "https://remax.com.mx",
};

const ALLOWED_FIELDS = [
  "oficina_id", "moneda", "operacion", "tipo", "agente_id",
  "estado_id", "ciudad_id", "colonia_id", "municipio_id",
  "search", "preciodesde", "preciohasta",
  "maxLat", "minLat", "maxLng", "minLng",
];

function pickAllowedFilters(source) {
  const output = {};
  for (const field of ALLOWED_FIELDS) {
    if (source[field] !== undefined && source[field] !== null && source[field] !== "") {
      output[field] = String(source[field]);
    }
  }
  if (!output.oficina_id) output.oficina_id = process.env.OFICINA_ID || "449";
  if (!output.moneda)     output.moneda     = "MXN";
  return output;
}

async function postForm(url, payload) {
  const body     = new URLSearchParams(payload).toString();
  const upstream = await fetch(url, {
    method : "POST",
    headers: {
      ...BROWSER_HEADERS,
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
    },
    body,
  });
  const text = await upstream.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }
  return { ok: upstream.ok, status: upstream.status, data: json };
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "remox-proxy", ts: new Date().toISOString() });
});

app.get("/api/propiedades", async (req, res) => {
  try {
    const payload  = pickAllowedFilters(req.query);
    const response = await postForm(`${REMAX_BASE}/map/FetchMapData`, payload);
    const propData = response?.data?.data?.prop_data || [];

    const normalized = propData.map((item) => {
      const imagePath = item?.imagenes?.[0]?.path || "";
      const imageUrl  = imagePath
        ? `https://cdn.remax.com.mx/${imagePath}`
        : "https://cdn.remax.com.mx/properties/default_rebrand.jpg";

      return {
        id              : item.propiedad_id,
        propiedad_id    : item.propiedad_id,
        clave           : item.clave,
        titulo          : `${item.tipo_nombre || "Propiedad"} en ${item.colonia_nombre || item.ciudad_nombre || "N/D"}`,
        ubicacion       : [item.colonia_nombre, item.ciudad_nombre, item.estado_nombre].filter(Boolean).join(", "),
        precio          : Number(item.mxn_corriente || 0),
        moneda          : item.moneda || "MXN",
        operacion       : item.operacion,
        propuesta       : item.propuesta       ?? null,
        venta_pendiente : item.venta_pendiente  ?? null,
        tipo            : String(item.tipo_nombre || "").toLowerCase(),
        imagen          : imageUrl,
        cuartos         : item.cuartos                    || null,
        banos           : item.banos                      || null,
        m2_terreno      : item.m2_terreno                 || null,
        m2_construccion : item.m2_construccion            || null,
        estacionamientos: item.numero_estacionamientos    || null,
      };
    });

    return res.status(response.status).json({
      data: normalized,
      meta: { count: normalized.length, oficina_id: payload.oficina_id },
      raw : response.data,
    });
  } catch (error) {
    return res.status(500).json({ ok: false, error: "No se pudo consultar FetchMapData", detail: error.message });
  }
});

app.get("/api/propiedad/:id", async (req, res) => {
  try {
    const id = String(req.params.id || "").trim();
    if (!/^\d+$/.test(id)) {
      return res.status(400).json({ ok: false, error: "propiedad_id invalido" });
    }
    const url      = `${REMAX_BASE}/ajax/FetchPropiedadFlyerData/${encodeURIComponent(id)}`;
    const response = await postForm(url, {});
    return res.status(response.status).json(response.data);
  } catch (error) {
    return res.status(500).json({ ok: false, error: "No se pudo consultar FetchPropiedadFlyerData", detail: error.message });
  }
});

app.get("/api/property/:id",    (req, res) => res.redirect(`/api/propiedad/${req.params.id}`));
app.get("/api/propiedades/:id", (req, res) => res.redirect(`/api/propiedad/${req.params.id}`));

app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "../../frontend/public/index.html"));
});

app.listen(PORT, () => {
  console.log(`Remox proxy running on http://localhost:${PORT}`);
});
