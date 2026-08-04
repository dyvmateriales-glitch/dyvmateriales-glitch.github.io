(() => {
  'use strict';

  const WHATSAPP_NUMBER = '5493476606403';
  const SOURCE_PARTS = ['/assets/app.part0?v=original-20260804', '/assets/app.part1?v=original-20260804'];
  const state = {
    products: [],
    groups: [],
    parent: 'Todos',
    child: 'Todos',
    query: '',
    sort: 'featured',
  };

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const normalize = (value = '') => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  const escapeHtml = (value = '') => String(value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#039;');

  const decodeText = (value = '') => {
    const decoded = String(value)
      .replace(/\\n|\\r|\\t/g, ' ')
      .replace(/\\`/g, '`').replace(/\\"/g, '"').replace(/\\'/g, "'")
      .replace(/\\u([0-9a-f]{4})/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
      .replace(/\\x([0-9a-f]{2})/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
      .replace(/\\\//g, '/').replace(/\\\\/g, '\\').replace(/\s+/g, ' ').trim();
    const textarea = document.createElement('textarea');
    textarea.innerHTML = decoded;
    return textarea.value;
  };

  function extractObjects(source) {
    const objects = [];
    let start = -1;
    let depth = 0;
    let quote = '';
    let escaped = false;
    for (let i = 0; i < source.length; i += 1) {
      const char = source[i];
      if (quote) {
        if (escaped) escaped = false;
        else if (char === '\\') escaped = true;
        else if (char === quote) quote = '';
        continue;
      }
      if (char === '"' || char === "'" || char === '`') {
        quote = char;
        continue;
      }
      if (char === '{') {
        if (depth === 0) start = i;
        depth += 1;
      } else if (char === '}' && depth > 0) {
        depth -= 1;
        if (depth === 0 && start >= 0) {
          objects.push(source.slice(start, i + 1));
          start = -1;
        }
      }
    }
    return objects;
  }

  function readField(objectText, key) {
    const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const expression = new RegExp(`(?:^|[,\\s{])(?:["']?${escapedKey}["']?)\\s*:\\s*(?:\\`((?:\\\\.|[^\\`])*)\\`|"((?:\\\\.|[^"])*)"|'((?:\\\\.|[^'])*)')`);
    const match = objectText.match(expression);
    return match ? decodeText(match[1] ?? match[2] ?? match[3] ?? '') : '';
  }

  function parseSources(sources) {
    const objectTexts = sources.flatMap(extractObjects);
    const sectionLabels = new Map();

    objectTexts.forEach((objectText) => {
      const image = readField(objectText, 'image');
      if (image) return;
      const id = readField(objectText, 'id') || readField(objectText, 'sectionId');
      const label = readField(objectText, 'title') || readField(objectText, 'name') || readField(objectText, 'label');
      if (id && label && label.length < 90 && !sectionLabels.has(id)) sectionLabels.set(id, label);
    });

    const products = [];
    const seen = new Set();
    let rawProductObjects = 0;
    let duplicates = 0;
    let malformed = 0;

    objectTexts.forEach((objectText) => {
      const name = readField(objectText, 'name');
      const image = readField(objectText, 'image');
      if (!name && !image) return;
      rawProductObjects += 1;
      if (!name || !image) {
        malformed += 1;
        return;
      }

      const id = readField(objectText, 'id');
      const brand = readField(objectText, 'brand');
      const originalCategory = readField(objectText, 'category');
      const description = readField(objectText, 'description');
      const code = readField(objectText, 'code');
      const sectionId = readField(objectText, 'sectionId');
      const identity = id || `${name}|${image}`;
      if (seen.has(identity)) {
        duplicates += 1;
        return;
      }
      seen.add(identity);

      const sectionLabel = sectionLabels.get(sectionId) || '';
      const parent = sectionLabel || originalCategory || 'Otros productos';
      const child = originalCategory && normalize(originalCategory) !== normalize(parent) ? originalCategory : '';
      products.push({
        id: id || `producto-${products.length + 1}`,
        title: name,
        brand,
        originalCategory,
        parent,
        child,
        description,
        image,
        code,
        sectionId,
        order: products.length,
        search: normalize(`${name} ${brand} ${originalCategory} ${parent} ${description} ${code}`),
      });
    });

    const groupsMap = new Map();
    products.forEach((product) => {
      if (!groupsMap.has(product.parent)) groupsMap.set(product.parent, { name: product.parent, count: 0, children: new Map() });
      const group = groupsMap.get(product.parent);
      group.count += 1;
      if (product.child) group.children.set(product.child, (group.children.get(product.child) || 0) + 1);
    });
    const groups = [...groupsMap.values()].map((group) => ({
      ...group,
      children: [...group.children.entries()].map(([name, count]) => ({ name, count })),
    }));

    console.group('Auditoría del catálogo original D&V');
    console.table({
      objetos_de_producto_detectados: rawProductObjects,
      productos_validos_y_unicos: products.length,
      duplicados_exactos_omitidos: duplicates,
      registros_incompletos: malformed,
      categorias_originales: groups.length,
    });
    console.groupEnd();

    return { products, groups, audit: { rawProductObjects, duplicates, malformed } };
  }

  function injectLayoutStyles() {
    if ($('#catalog-original-layout')) return;
    const style = document.createElement('style');
    style.id = 'catalog-original-layout';
    style.textContent = `
      .chips,.mobile-category-toggle,.mobile-category-panel{display:none!important}
      .catalog-layout{display:grid!important;grid-template-columns:minmax(255px,300px) minmax(0,1fr)!important;gap:28px!important;align-items:start!important}
      .sidebar{display:block!important;position:sticky!important;top:92px!important;max-height:calc(100vh - 112px)!important;overflow:auto!important;background:#fff!important;border:1px solid #dededb!important;border-radius:12px!important}
      .sidebar-title{margin:0!important;padding:20px 18px!important;border-bottom:1px solid #dededb!important;font-size:18px!important}
      .sidebar-list{display:block!important}
      .catalog-parent{border-bottom:1px solid #e5e5e2!important}
      .catalog-parent summary{list-style:none;cursor:pointer;display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:52px;padding:0 17px;font-size:12px;font-weight:700}
      .catalog-parent summary::-webkit-details-marker{display:none}
      .catalog-parent summary span:last-child{font-size:16px;font-weight:400;transition:transform .18s}
      .catalog-parent[open] summary{background:#f3f3f1}
      .catalog-parent[open] summary span:last-child{transform:rotate(45deg)}
      .catalog-parent-choose,.catalog-child,.catalog-all-products{width:100%;border:0;cursor:pointer;text-align:left;background:#fff;color:#333;min-height:43px;padding:9px 18px;font-size:11px}
      .catalog-all-products{border-bottom:1px solid #e5e5e2;font-weight:750;min-height:50px}
      .catalog-parent-choose{font-weight:700;background:#fafaf8}
      .catalog-child{padding-left:30px;color:#5e5e5a}
      .catalog-parent-choose:hover,.catalog-child:hover,.catalog-all-products:hover,.catalog-parent-choose.is-active,.catalog-child.is-active,.catalog-all-products.is-active{background:#292826;color:#fff}
      .catalog-count{opacity:.62;float:right;font-size:9px}
      .products-panel{min-width:0!important}
      @media(max-width:760px){
        .catalog-layout{grid-template-columns:1fr!important;gap:18px!important}
        .sidebar{position:static!important;top:auto!important;max-height:none!important;overflow:visible!important;border-radius:10px!important}
        .sidebar-help{display:none!important}
        .catalog-parent summary{min-height:50px!important}
        .catalog-top{align-items:stretch!important}
      }
    `;
    document.head.appendChild(style);
  }

  const productMessage = (product) => encodeURIComponent(`Hola, quiero consultar por ${product.title}${product.brand ? ` (${product.brand})` : ''}${product.code ? `, código ${product.code}` : ''}.`);

  function filteredProducts() {
    const query = normalize(state.query);
    let products = state.products.filter((product) => {
      const parentMatches = state.parent === 'Todos' || product.parent === state.parent;
      const childMatches = state.child === 'Todos' || product.child === state.child || product.originalCategory === state.child;
      return parentMatches && childMatches && (!query || product.search.includes(query));
    });
    const collator = new Intl.Collator('es', { sensitivity: 'base' });
    if (state.sort === 'name') products = [...products].sort((a, b) => collator.compare(a.title, b.title));
    else if (state.sort === 'brand') products = [...products].sort((a, b) => collator.compare(a.brand, b.brand) || collator.compare(a.title, b.title));
    else products = [...products].sort((a, b) => a.order - b.order);
    return products;
  }

  function placeholderFor(label) {
    const safe = escapeHtml(label || 'D&V Materiales');
    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="900" height="675"><rect width="900" height="675" fill="#efeee9"/><text x="450" y="338" text-anchor="middle" font-family="Arial" font-size="32" fill="#696861">${safe}</text></svg>`)}`;
  }

  function cardTemplate(product) {
    return `<article class="product-card">
      <button class="product-image-button" type="button" data-open-product="${escapeHtml(product.id)}" aria-label="Ver ${escapeHtml(product.title)}">
        <img class="product-image" src="${escapeHtml(product.image)}" alt="${escapeHtml(product.title)}" loading="lazy" decoding="async">
      </button>
      <div class="product-info">
        <p class="product-category">${escapeHtml(product.originalCategory || product.parent)}</p>
        <h3 class="product-title">${escapeHtml(product.title)}</h3>
        ${product.brand || product.code ? `<p class="product-brand">${escapeHtml(product.brand)}${product.code ? ` · ${escapeHtml(product.code)}` : ''}</p>` : ''}
        <button class="product-action" type="button" data-open-product="${escapeHtml(product.id)}">Ver producto</button>
      </div>
    </article>`;
  }

  function renderProducts() {
    const grid = $('#products-grid');
    const empty = $('#empty-state');
    const label = $('#results-label');
    if (!grid || !empty || !label) return;
    const products = filteredProducts();
    grid.innerHTML = products.map(cardTemplate).join('');
    grid.hidden = products.length === 0;
    empty.classList.toggle('is-visible', products.length === 0);
    const scope = state.child !== 'Todos' ? state.child : state.parent;
    label.textContent = `${products.length} ${products.length === 1 ? 'producto' : 'productos'}${scope !== 'Todos' ? ` en ${scope}` : ''}`;
    $$('.product-image', grid).forEach((image) => image.addEventListener('error', () => {
      if (image.dataset.fallbackApplied) return;
      image.dataset.fallbackApplied = 'true';
      image.src = placeholderFor(image.alt);
    }, { once: true }));
  }

  function renderSidebar() {
    const sidebar = $('.sidebar-list');
    if (!sidebar) return;
    sidebar.innerHTML = `<button class="catalog-all-products is-active" type="button" data-parent="Todos">Todos los productos <span class="catalog-count">${state.products.length}</span></button>` + state.groups.map((group) => `
      <details class="catalog-parent">
        <summary><span>${escapeHtml(group.name)} <small class="catalog-count">${group.count}</small></span><span>+</span></summary>
        <button class="catalog-parent-choose" type="button" data-parent="${escapeHtml(group.name)}">Ver todos</button>
        ${group.children.map((child) => `<button class="catalog-child" type="button" data-parent="${escapeHtml(group.name)}" data-child="${escapeHtml(child.name)}">${escapeHtml(child.name)} <span class="catalog-count">${child.count}</span></button>`).join('')}
      </details>`).join('');
  }

  function selectCatalog(parent = 'Todos', child = 'Todos') {
    state.parent = parent;
    state.child = child;
    $$('[data-parent]').forEach((button) => button.classList.toggle('is-active', button.dataset.parent === parent && (button.dataset.child || 'Todos') === child));
    renderProducts();
  }

  function openProduct(id) {
    const product = state.products.find((item) => item.id === id);
    const modal = $('#product-modal');
    if (!product || !modal) return;
    $('#modal-image').src = product.image;
    $('#modal-image').alt = product.title;
    $('#modal-category').textContent = product.originalCategory || product.parent;
    $('#modal-title').textContent = product.title;
    $('#modal-brand').textContent = `${product.brand}${product.code ? ` · ${product.code}` : ''}`;
    const copy = $('.modal-copy', modal);
    if (copy) copy.textContent = product.description || 'Consultanos para conocer modelos disponibles, medidas y opciones para tu obra.';
    $('#modal-whatsapp').href = `https://wa.me/${WHATSAPP_NUMBER}?text=${productMessage(product)}`;
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');
  }

  function closeProduct() {
    const modal = $('#product-modal');
    if (!modal) return;
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('modal-open');
  }

  function setupInteractions() {
    const search = $('#catalog-search');
    const clear = $('#clear-search');
    const sort = $('#sort-products');
    const menuButton = $('#mobile-menu-button');
    const menu = $('#mobile-menu');

    search?.addEventListener('input', () => {
      state.query = search.value;
      clear?.classList.toggle('is-visible', Boolean(search.value));
      renderProducts();
    });
    clear?.addEventListener('click', () => {
      search.value = '';
      state.query = '';
      clear.classList.remove('is-visible');
      renderProducts();
      search.focus();
    });
    sort?.addEventListener('change', () => {
      state.sort = sort.value;
      renderProducts();
    });
    document.addEventListener('click', (event) => {
      const categoryButton = event.target.closest('[data-parent]');
      if (categoryButton) selectCatalog(categoryButton.dataset.parent || 'Todos', categoryButton.dataset.child || 'Todos');
      const productButton = event.target.closest('[data-open-product]');
      if (productButton) openProduct(productButton.dataset.openProduct);
      if (event.target.closest('#mobile-menu a')) {
        menu?.classList.remove('is-open');
        menuButton?.setAttribute('aria-expanded', 'false');
        document.body.classList.remove('menu-open');
      }
    });
    menuButton?.addEventListener('click', () => {
      const open = !menu?.classList.contains('is-open');
      menu?.classList.toggle('is-open', open);
      menuButton.setAttribute('aria-expanded', String(open));
      document.body.classList.toggle('menu-open', open);
    });
    $('#modal-close')?.addEventListener('click', closeProduct);
    $('#product-modal')?.addEventListener('click', (event) => { if (event.target.id === 'product-modal') closeProduct(); });
    document.addEventListener('keydown', (event) => { if (event.key === 'Escape') closeProduct(); });
  }

  async function loadCatalog() {
    const loading = $('#loading-state');
    const error = $('#catalog-error');
    try {
      const responses = await Promise.all(SOURCE_PARTS.map((url) => fetch(url, { cache: 'no-store' })));
      if (responses.some((response) => !response.ok)) throw new Error('No se pudieron leer los archivos originales');
      const sources = await Promise.all(responses.map((response) => response.text()));
      const parsed = parseSources(sources);
      if (!parsed.products.length) throw new Error('No se encontraron productos válidos');
      state.products = parsed.products;
      state.groups = parsed.groups;
      renderSidebar();
      renderProducts();
      loading?.classList.remove('is-visible');
      error?.classList.remove('is-visible');
    } catch (catalogError) {
      console.error('Error al cargar el catálogo original:', catalogError);
      loading?.classList.remove('is-visible');
      error?.classList.add('is-visible');
      $('#results-label').textContent = 'Catálogo temporalmente no disponible';
    }
  }

  injectLayoutStyles();
  setupInteractions();
  loadCatalog();
})();
