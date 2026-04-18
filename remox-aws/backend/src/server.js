const REMAX_BASE = "https://remax.com.mx";

const BROWSER_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  "Accept": "application/json, text/plain, */*",
  "Accept-Language": "es-MX,es;q=0.9,en;q=0.8",
  "Referer": "https://remax.com.mx/",
  "Origin": "https://remax.com.mx"
};

const ALLOWED_FIELDS = [
  "oficina_id", "moneda", "operacion", "tipo", "agente_id",
  "estado_id", "ciudad_id", "colonia_id", "municipio_id",
  "search", "preciodesde", "preciohasta",
  "maxLat", "minLat", "maxLng", "minLng"
];

function jsonResponse(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=UTF-8",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      ...extraHeaders
    }
  });
}

function redirectResponse(location, status = 302) {
  return new Response(null, {
    status,
    headers: {
      Location: location,
      "Access-Control-Allow-Origin": "*"
    }
  });
}

function pickAllowedFilters(searchParams, env) {
  const output = {};

  for (const field of ALLOWED_FIELDS) {
    const value = searchParams.get(field);
    if (value !== null && value !== "") {
      output[field] = String(value);
    }
  }

  if (!output.oficina_id) output.oficina_id = env.OFICINA_ID || "449";
  if (!output.moneda) output.moneda = "MXN";

  return output;
}

async function postForm(url, payload) {
  const body = new URLSearchParams(payload).toString();

  const upstream = await fetch(url, {
    method: "POST",
    headers: {
      ...BROWSER_HEADERS,
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8"
    },
    body
  });

  const text = await upstream.text();

  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }

  return {
    ok: upstream.ok,
    status: upstream.status,
    data: json
  };
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const pathname = url.pathname;

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type"
        }
      });
    }

    if (pathname === "/api/health" && request.method === "GET") {
      return jsonResponse({
        ok: true,
        service: "remox-proxy",
        ts: new Date().toISOString()
      });
    }

    if (pathname === "/api/propiedades" && request.method === "GET") {
      try {
        const payload = pickAllowedFilters(url.searchParams, env);
        const response = await postForm(`${REMAX_BASE}/map/FetchMapData`, payload);
        const propData = response?.data?.data?.prop_data || [];

        const normalized = propData.map((item) => {
          const imagePath = item?.imagenes?.[0]?.path || "";
          const imageUrl = imagePath
            ? `https://cdn.remax.com.mx/${imagePath}`
            : "https://cdn.remax.com.mx/properties/default_rebrand.jpg";

          return {
            id: item.propiedad_id,
            propiedad_id: item.propiedad_id,
            clave: item.clave,
            titulo: `${item.tipo_nombre || "Propiedad"} en ${item.colonia_nombre || item.ciudad_nombre || "N/D"}`,
            ubicacion: [item.colonia_nombre, item.ciudad_nombre, item.estado_nombre].filter(Boolean).join(", "),
            precio: Number(item.mxn_corriente || 0),
            moneda: item.moneda || "MXN",
            operacion: item.operacion,
            propuesta: item.propuesta ?? null,
            venta_pendiente: item.venta_pendiente ?? null,
            tipo: String(item.tipo_nombre || "").toLowerCase(),
            imagen: imageUrl,
            cuartos: item.cuartos || null,
            banos: item.banos || null,
            m2_terreno: item.m2_terreno || null,
            m2_construccion: item.m2_construccion || null,
            estacionamientos: item.numero_estacionamientos || null
          };
        });

        return jsonResponse({
          data: normalized,
          meta: {
            count: normalized.length,
            oficina_id: payload.oficina_id
          },
          raw: response.data
        }, response.status);
      } catch (error) {
        return jsonResponse({
          ok: false,
          error: "No se pudo consultar FetchMapData",
          detail: String(error?.message || error)
        }, 500);
      }
    }

    if (pathname.startsWith("/api/propiedad/") && request.method === "GET") {
      try {
        const id = String(pathname.split("/").pop() || "").trim();

        if (!/^\d+$/.test(id)) {
          return jsonResponse({ ok: false, error: "propiedad_id invalido" }, 400);
        }

        const response = await postForm(
          `${REMAX_BASE}/ajax/FetchPropiedadFlyerData/${encodeURIComponent(id)}`,
          {}
        );

        return jsonResponse(response.data, response.status);
      } catch (error) {
        return jsonResponse({
          ok: false,
          error: "No se pudo consultar FetchPropiedadFlyerData",
          detail: String(error?.message || error)
        }, 500);
      }
    }

    if (pathname.startsWith("/api/property/") && request.method === "GET") {
      const id = pathname.split("/").pop();
      return redirectResponse(`/api/propiedad/${id}`);
    }

    if (pathname.startsWith("/api/propiedades/") && request.method === "GET") {
      const id = pathname.split("/").pop();
      return redirectResponse(`/api/propiedad/${id}`);
    }

    return env.ASSETS.fetch(request);
  }
};
