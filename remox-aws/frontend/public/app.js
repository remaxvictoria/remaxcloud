const API_BASE = '/api';

window.allProperties = [];


window.addEventListener('scroll', function(){
  const navbar = document.querySelector('.navbar');
  if (navbar) navbar.classList.toggle('scrolled', window.scrollY > 50);
});


async function fetchAllProperties(){
  const results = document.getElementById('results');
  if (!results) return;

  results.innerHTML = '<p style="padding:20px;color:#666;">Cargando propiedades...</p>';

  try {
    const res = await fetch(`${API_BASE}/propiedades`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    let properties = Array.isArray(data) ? data : data.data || [];


    if (data.raw?.data?.prop_data) {
      const rawMap = {};
      data.raw.data.prop_data.forEach(r => {
        rawMap[r.propiedad_id] = {
          operacion: r.operacion,
          propuesta: ('propuesta' in r && (r.propuesta === '0' || r.propuesta === '1' || r.propuesta === 0 || r.propuesta === 1))
            ? String(r.propuesta) : null
        };
      });

      properties = properties.map(p => {
        const raw = rawMap[p.propiedad_id] || rawMap[p.id] || {};
        const propuesta = raw.propuesta !== null && raw.propuesta !== undefined
          ? raw.propuesta
          : (p.propuesta === '0' || p.propuesta === '1' ? p.propuesta : null);
        return { ...p, operacion: p.operacion || raw.operacion || '1', propuesta };
      });
    }

    window.allProperties = properties;

    if (!properties.length) {
      results.innerHTML = '<p style="padding:20px;color:#666;">No se encontraron propiedades.</p>';
      return;
    }

    if (typeof renderProperties === 'function') {
      renderProperties(properties);
    }

  } catch(e) {
    console.error('Error al cargar propiedades:', e);
    results.innerHTML = `<p style="padding:20px;color:#c00;">Error al cargar propiedades. Verifica que el servidor esté corriendo.<br><small>${e.message}</small></p>`;
  }
}


window.onload = fetchAllProperties;
