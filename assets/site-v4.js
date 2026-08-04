(() => {
  'use strict';

  const WHATSAPP_NUMBER = '5493476606403';
  const SOURCE_PARTS = [
    '/assets/app.part0?v=8e7f4c5a2026',
    '/assets/app.part1?v=8e7f4c5a2026',
  ];

  const state = {
    products: [],
    category: 'Todos',
    query: '',
    sort: 'featured',
  };

  const brands = [
    ['San Pietro', /san[-_\s]?pietro/i],
    ['San Lorenzo', /san[-_\s]?lorenzo/i],
    ['Formigres', /formigres/i],
    ['Premecol', /premecol/i],
    ['Hidromet', /hidromet/i],
    ['Peirano', /peirano/i],
    ['Alberdi', /alberdi/i],
    ['Lourdes', /lourdes/i],
    ['Ferrum', /ferrum/i],
    ['Unique', /unique/i],
    ['Mozart', /mozart/i],
    ['Piazza', /piazza/i],
    ['Atrim', /atrim/i],
    ['Allpa', /allpa/i],
    ['Scop', /scop/i],
    ['Roca', /(?:^|[-_/])roca(?:[-_/]|$)/i],
    ['FV', /(?:^|[-_/])fv(?:[-_/]|$)/i],
  ];

  const categoryRules = [
    ['Sanitarios', /(sanitari|inodoro|bidet|lavatori|bacha|bachon|mingitori|mochila|deposito|vanitory|pileta.*lavar|asiento)/i],
    ['Griferías', /(grifer|canilla|monocomando|ducha|duchon|flor.*ducha|mezclador|rociador|pico|llave.*paso)/i],
    ['Muebles', /(mueble|mesada|alacena|bajo.*mesada|despenser|organizador|cocina.*medida|vanitory.*mueble)/i],
    ['Exterior', /(exterior|adoquin|adoquín|rustic|cesped|césped|durmiente|quebracho|laja|travertino|pileta|atermic|atérmic|loseta|deck|jardin|jardín)/i],
    ['Porcelanatos', /(porcelanat|porcellanat|porcellanato)/i],
    ['Revestimientos', /(revest|wall.*panel|panel.*pared|liston|listón|3d|wave|piedra.*pared|fachada|plaster|dur.*color)/i],
    ['Pisos', /(ceramic|cerámic|piso|spc|click|clic|madera|parquet|baldosa)/i],
  ];

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  const normalize = (value = '') => String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

  const escapeHtml = (value = '') => String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

  const titleCase = (value = '') => value
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => {
      const lower = word.toLowerCase();
      if (['de', 'del', 'y', 'para', 'con', 'sin', 'a'].includes(lower)) return lower;
      if (lower === 'fv' || lower === 'spc' || lower === 'pvc') return lower.toUpperCase();
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(' ');

  const safeDecode = (value) => {
    try { return decodeURIComponent(value); } catch { return value; }
  };

  const cleanSource = (source) => source
    .replace(/\\\//g, '/')
    .replace(/\\u002f/gi, '/')
    .replace(/&quot;/g, '"');

  const collectImagePaths = (source) => {
    const clean = cleanSource(source);
    const regex = /(?:https?:\/\/[^"'`\s\\)]+|\/(?:images|assets)\/[^"'`\s\\)]+)\.(?:webp|png|jpe?g|avif)(?:\?[^"'`\s\\)]*)?/gi;
    const matches = clean.match(regex) || [];
    return [...new Set(matches.map((path) => safeDecode(path.replace(/[;,]+$/, ''))))];
  };

  const isDecorativeImage = (path) => /(logo|favicon|apple-touch|social-preview|instagram|whatsapp|icon|sprite|avatar|placeholder|loader|loading|qr|mapa|ubicacion|ubicación)/i.test(path);

  const chooseProductImages = (allImages) => {
    const explicit = allImages.filter((path) => /\/images\/(products?|productos?|catalogo|catálogo)\//i.test(path));
    if (explicit.length >= 20) return explicit;

    const broad = allImages.filter((path) => {
      if (isDecorativeImage(path)) return false;
      if (/(hero|banner|portada|showroom|social)/i.test(path)) return false;
      return /\/(images|assets)\//i.test(path);
    });
    return broad.length > explicit.length ? broad : explicit;
  };

  const findBrand = (text) => {
    const match = brands.find(([, pattern]) => pattern.test(text));
    return match ? match[0] : '';
  };

  const inferCategory = (text) => {
    const match = categoryRules.find(([, pattern]) => pattern.test(text));
    return match ? match[0] : 'Pisos';
  };

  const fileInfo = (url) => {
    const cleanUrl = url.split('?')[0].split('#')[0];
    const segments = cleanUrl.split('/').filter(Boolean);
    const filename = segments.pop() || '';
    const parent = segments.pop() || '';
    let stem = filename.replace(/\.(?:webp|png|jpe?g|avif)$/i, '');
    const originalStem = stem;
    stem = stem
      .replace(/(?:[-_](?:foto|img|image))?[-_](?:0?\d{1,2})$/i, '')
      .replace(/[-_]\d{2,4}x\d{2,4}$/i, '')
      .replace(/[-_](?:thumb|mini|small|large|desktop|mobile)$/i, '');
    if (/^(?:\d+|foto|img|image|principal|producto)$/i.test(stem)) stem = parent;
    return { cleanUrl, filename, parent, stem: stem || originalStem };
  };

  const productKey = (url) => {
    const info = fileInfo(url);
    const base = normalize(info.stem)
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    const parent = normalize(info.parent).replace(/[^a-z0-9]+/g, '-');
    return base.length > 2 ? `${parent}/${base}` : `${parent}/${normalize(info.filename)}`;
  };

  const friendlyTitle = (url, brand, category) => {
    const info = fileInfo(url);
    let raw = `${info.parent} ${info.stem}`
      .replace(/\b(products?|productos?|catalogo|catalog|imagenes?|images?|assets?|webp|jpg|jpeg|png)\b/gi, ' ')
      .replace(/\b(foto|img|image|principal|detalle|ambiente|producto)\b/gi, ' ')
      .replace(/\b\d{2,4}x\d{2,4}\b/g, ' ')
      .replace(/[._-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (brand) {
      const brandPattern = new RegExp(brand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '[-_\\s]*'), 'ig');
      raw = raw.replace(brandPattern, ' ').replace(/\s+/g, ' ').trim();
    }

    raw = raw
      .replace(/\b(?:v\d+|final|nuevo|nueva|stock|modelo)\b/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (!raw || raw.length < 3) raw = category;
    const titled = titleCase(raw);
    return titled.length > 75 ? `${titled.slice(0, 72).trim()}…` : titled;
  };

  const buildProducts = (imagePaths) => {
    const grouped = new Map();

    imagePaths.forEach((image) => {
      const key = productKey(image);
      if (!key || grouped.has(image)) return;
      const current = grouped.get(key) || [];
      if (!current.includes(image)) current.push(image);
      grouped.set(key, current);
    });

    return [...grouped.entries()].map(([key, images], index) => {
      const searchablePath = images.join(' ');
      const brand = findBrand(searchablePath);
      const category = inferCategory(searchablePath);
      const title = friendlyTitle(images[0], brand, category);
      const search = normalize(`${title} ${brand} ${category} ${searchablePath}`);
      return {
        id: `product-${index + 1}`,
        key,
        title,
        brand: brand || 'D&V Materiales',
        category,
        images,
        search,
        order: index,
      };
    }).filter((product) => product.title && product.images[0]);
  };

  const placeholderFor = (label) => {
    const text = escapeHtml(label || 'D&V Materiales');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="675" viewBox="0 0 900 675"><rect width="900" height="675" fill="#efeee9"/><path d="M0 520L230 300l160 150 125-120 385 345H0z" fill="#d8d6cf"/><text x="450" y="180" text-anchor="middle" font-family="Arial" font-size="34" fill="#696861">${text}</text></svg>`;
    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
  };

  const productMessage = (product) => encodeURIComponent(`Hola, quiero consultar por ${product.title}${product.brand ? ` (${product.brand})` : ''}.`);

  const filteredProducts = () => {
    const query = normalize(state.query);
    let items = state.products.filter((product) => {
      const categoryMatches = state.category === 'Todos' || product.category === state.category;
      const queryMatches = !query || product.search.includes(query);
      return categoryMatches && queryMatches;
    });

    const collator = new Intl.Collator('es', { sensitivity: 'base' });
    if (state.sort === 'name') items = [...items].sort((a, b) => collator.compare(a.title, b.title));
    if (state.sort === 'brand') items = [...items].sort((a, b) => collator.compare(a.brand, b.brand) || collator.compare(a.title, b.title));
    if (state.sort === 'featured') items = [...items].sort((a, b) => a.order - b.order);
    return items;
  };

  const productCard = (product) => `
    <article class="product-card" data-product-id="${escapeHtml(product.id)}">
      <button class="product-image-button" type="button" data-open-product="${escapeHtml(product.id)}" aria-label="Ver ${escapeHtml(product.title)}">
        <img class="product-image" src="${escapeHtml(product.images[0])}" alt="${escapeHtml(product.title)}" loading="lazy" decoding="async">
      </button>
      <div class="product-info">
        <p class="product-category">${escapeHtml(product.category)}</p>
        <h3 class="product-title">${escapeHtml(product.title)}</h3>
        <p class="product-brand">${escapeHtml(product.brand)}</p>
        <button class="product-action" type="button" data-open-product="${escapeHtml(product.id)}">Ver producto</button>
      </div>
    </article>`;

  const updateActiveControls = () => {
    $$('[data-category]').forEach((button) => {
      const active = button.dataset.category === state.category;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    });
  };

  const renderProducts = () => {
    const grid = $('#products-grid');
    const empty = $('#empty-state');
    const label = $('#results-label');
    if (!grid || !empty || !label) return;

    const items = filteredProducts();
    grid.innerHTML = items.map(productCard).join('');
    grid.hidden = items.length === 0;
    empty.classList.toggle('is-visible', items.length === 0);
    label.textContent = `${items.length} ${items.length === 1 ? 'producto' : 'productos'}`;

    $$('.product-image', grid).forEach((image) => {
      image.addEventListener('error', () => {
        if (image.dataset.fallbackApplied) return;
        image.dataset.fallbackApplied = 'true';
        image.src = placeholderFor(image.alt);
      }, { once: true });
    });
  };

  const selectCategory = (category) => {
    state.category = category || 'Todos';
    updateActiveControls();
    renderProducts();
    const mobilePanel = $('#mobile-category-panel');
    const mobileToggle = $('#mobile-category-toggle');
    if (mobilePanel?.classList.contains('is-open')) {
      mobilePanel.classList.remove('is-open');
      mobileToggle?.setAttribute('aria-expanded', 'false');
    }
  };

  const openProduct = (id) => {
    const product = state.products.find((item) => item.id === id);
    const modal = $('#product-modal');
    if (!product || !modal) return;

    $('#modal-image').src = product.images[0];
    $('#modal-image').alt = product.title;
    $('#modal-category').textContent = product.category;
    $('#modal-title').textContent = product.title;
    $('#modal-brand').textContent = product.brand;
    $('#modal-whatsapp').href = `https://wa.me/${WHATSAPP_NUMBER}?text=${productMessage(product)}`;
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');
    $('#modal-close')?.focus();
  };

  const closeProduct = () => {
    const modal = $('#product-modal');
    if (!modal) return;
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('modal-open');
  };

  const setupHeroFallback = (allImages, productImages) => {
    const hero = $('#hero-image');
    const mobileSource = $('#hero-mobile-source');
    if (!hero) return;

    const candidate = allImages.find((path) => /(hero|banner|portada).*(exterior|jardin|jardín)|(?:exterior|jardin|jardín).*(hero|banner|portada)/i.test(path))
      || productImages.find((path) => /(exterior|adoquin|adoquín|cesped|césped|jardin|jardín|durmiente)/i.test(path))
      || productImages[0];

    hero.addEventListener('error', () => {
      if (candidate && hero.src !== new URL(candidate, location.href).href) hero.src = candidate;
    }, { once: true });

    mobileSource?.addEventListener?.('error', () => {
      if (candidate) mobileSource.srcset = candidate;
    });
  };

  const setupInteractions = () => {
    const search = $('#catalog-search');
    const clear = $('#clear-search');
    const sort = $('#sort-products');
    const menuButton = $('#mobile-menu-button');
    const menu = $('#mobile-menu');
    const mobileCategoryToggle = $('#mobile-category-toggle');
    const mobileCategoryPanel = $('#mobile-category-panel');

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
      const categoryButton = event.target.closest('[data-category]');
      if (categoryButton) selectCategory(categoryButton.dataset.category);

      const productButton = event.target.closest('[data-open-product]');
      if (productButton) openProduct(productButton.dataset.openProduct);

      const menuLink = event.target.closest('#mobile-menu a');
      if (menuLink) {
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

    mobileCategoryToggle?.addEventListener('click', () => {
      const open = !mobileCategoryPanel?.classList.contains('is-open');
      mobileCategoryPanel?.classList.toggle('is-open', open);
      mobileCategoryToggle.setAttribute('aria-expanded', String(open));
    });

    $('#modal-close')?.addEventListener('click', closeProduct);
    $('#product-modal')?.addEventListener('click', (event) => {
      if (event.target.id === 'product-modal') closeProduct();
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        closeProduct();
        if (menu?.classList.contains('is-open')) {
          menu.classList.remove('is-open');
          menuButton?.setAttribute('aria-expanded', 'false');
          document.body.classList.remove('menu-open');
        }
      }
    });
  };

  const loadCatalog = async () => {
    const loading = $('#loading-state');
    const error = $('#catalog-error');
    const grid = $('#products-grid');

    try {
      const responses = await Promise.all(SOURCE_PARTS.map((path) => fetch(path, { cache: 'no-store' })));
      if (responses.some((response) => !response.ok)) throw new Error('No se pudieron leer los datos del catálogo.');
      const source = (await Promise.all(responses.map((response) => response.text()))).join('\n');
      const allImages = collectImagePaths(source);
      const productImages = chooseProductImages(allImages);
      const products = buildProducts(productImages);

      if (products.length < 1) throw new Error('No se encontraron imágenes de productos.');

      state.products = products;
      setupHeroFallback(allImages, productImages);
      loading?.remove();
      error?.classList.remove('is-visible');
      if (grid) grid.hidden = false;
      renderProducts();
    } catch (loadError) {
      console.error(loadError);
      loading?.remove();
      if (grid) grid.hidden = true;
      error?.classList.add('is-visible');
      $('#results-label').textContent = 'Catálogo';
    }
  };

  document.addEventListener('DOMContentLoaded', () => {
    setupInteractions();
    loadCatalog();
  });
})();
