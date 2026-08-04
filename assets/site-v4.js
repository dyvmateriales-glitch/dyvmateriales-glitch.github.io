(() => {
  'use strict';

  const WHATSAPP_NUMBER = '5493476606403';
  const SOURCE_PARTS = [
    '/assets/app.part0?v=8e7f4c5a2026',
    '/assets/app.part1?v=8e7f4c5a2026',
  ];

  const state = { products: [], category: 'Todos', query: '', sort: 'featured' };
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

  const decodeText = (value = '') => {
    const decoded = String(value)
      .replace(/\\n|\\r|\\t/g, ' ')
      .replace(/\\`/g, '`')
      .replace(/\\"/g, '"')
      .replace(/\\'/g, "'")
      .replace(/\\u([0-9a-f]{4})/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
      .replace(/\\x([0-9a-f]{2})/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
      .replace(/\\\//g, '/')
      .replace(/\\\\/g, '\\')
      .replace(/\s+/g, ' ')
      .trim();
    const textarea = document.createElement('textarea');
    textarea.innerHTML = decoded;
    return textarea.value;
  };

  const inferCategory = (text = '') => {
    const value = normalize(text);
    if (/(porcelanat|porcellanat)/.test(value)) return 'Porcelanatos';
    if (/(sanitari|inodoro|bidet|lavatori|bacha|bachon|mingitori|mochila|deposito|vanitory|pileta de lavar|asiento para)/.test(value)) return 'Sanitarios';
    if (/(grifer|canilla|monocomando|ducha|duchon|flor de ducha|mezclador|rociador|pico movil|llave de paso)/.test(value)) return 'Griferías';
    if (/(mueble|mesada|alacena|bajo mesada|despenser|organizador|cocina a medida|vanitory con)/.test(value)) return 'Muebles';
    if (/(exterior|adoquin|rustic|cesped|durmiente|quebracho|laja|travertino|atermic|loseta|deck|jardin|borde de pileta)/.test(value)) return 'Exterior';
    if (/(revest|wall panel|panel de pared|liston|3d|wave|piedra para pared|fachada|plaster|dur color)/.test(value)) return 'Revestimientos';
    return 'Pisos';
  };

  const parseCatalogObjects = (source) => {
    const string = '((?:\\\\.|[^`])*)';
    const pattern = new RegExp(
      `\\{id:\\\`${string}\\\`,name:\\\`${string}\\\`,brand:\\\`${string}\\\`,category:\\\`${string}\\\`,description:\\\`${string}\\\`,image:\\\`${string}\\\`,code:\\\`${string}\\\`,sectionId:\\\`${string}\\\`\\}`,
      'g',
    );
    const results = [];
    const seen = new Set();
    let match;

    while ((match = pattern.exec(source)) !== null) {
      const [, rawId, rawName, rawBrand, rawOriginalCategory, rawDescription, rawImage, rawCode, rawSection] = match;
      const id = decodeText(rawId);
      const name = decodeText(rawName);
      const brand = decodeText(rawBrand) || 'D&V Materiales';
      const originalCategory = decodeText(rawOriginalCategory);
      const description = decodeText(rawDescription);
      const image = decodeText(rawImage);
      const code = decodeText(rawCode);
      const sectionId = decodeText(rawSection);
      const key = id || `${name}|${image}`;

      if (!name || !image || seen.has(key)) continue;
      seen.add(key);

      const category = inferCategory(`${name} ${brand} ${originalCategory} ${description} ${sectionId}`);
      results.push({
        id: id || `product-${results.length + 1}`,
        title: name,
        brand,
        originalCategory,
        category,
        description,
        image,
        code,
        sectionId,
        order: results.length,
        search: normalize(`${name} ${brand} ${originalCategory} ${category} ${description} ${code} ${sectionId}`),
      });
    }
    return results;
  };

  const collectImages = (source) => {
    const clean = source.replace(/\\\//g, '/').replace(/\\u002f/gi, '/');
    const matches = clean.match(/(?:https?:\/\/[^"'`\s\\)]+|\/(?:images|assets)\/[^"'`\s\\)]+)\.(?:webp|png|jpe?g|avif)(?:\?[^"'`\s\\)]*)?/gi) || [];
    return [...new Set(matches.map((value) => value.replace(/[;,]+$/, '')))];
  };

  const fallbackProductsFromImages = (images) => images
    .filter((image) => !/(logo|favicon|icon|social-preview|instagram|whatsapp|avatar|loader|placeholder)/i.test(image))
    .map((image, index) => {
      const filename = decodeURIComponent(image.split('?')[0].split('/').pop() || `Producto ${index + 1}`)
        .replace(/\.(?:webp|png|jpe?g|avif)$/i, '')
        .replace(/[._-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      const title = filename || `Producto ${index + 1}`;
      const category = inferCategory(`${title} ${image}`);
      return {
        id: `image-${index + 1}`,
        title,
        brand: 'D&V Materiales',
        originalCategory: '',
        category,
        description: '',
        image,
        code: '',
        sectionId: '',
        order: index,
        search: normalize(`${title} ${category} ${image}`),
      };
    });

  const placeholderFor = (label) => {
    const safe = escapeHtml(label || 'D&V Materiales');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="675" viewBox="0 0 900 675"><rect width="900" height="675" fill="#efeee9"/><path d="M0 520 230 300l160 150 125-120 385 345H0z" fill="#d8d6cf"/><text x="450" y="180" text-anchor="middle" font-family="Arial" font-size="34" fill="#696861">${safe}</text></svg>`;
    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
  };

  const productMessage = (product) => encodeURIComponent(
    `Hola, quiero consultar por ${product.title}${product.brand ? ` (${product.brand})` : ''}${product.code ? `, código ${product.code}` : ''}.`,
  );

  const filteredProducts = () => {
    const query = normalize(state.query);
    let products = state.products.filter((product) => {
      const categoryMatches = state.category === 'Todos' || product.category === state.category;
      const queryMatches = !query || product.search.includes(query);
      return categoryMatches && queryMatches;
    });
    const collator = new Intl.Collator('es', { sensitivity: 'base' });
    if (state.sort === 'name') products = [...products].sort((a, b) => collator.compare(a.title, b.title));
    if (state.sort === 'brand') products = [...products].sort((a, b) => collator.compare(a.brand, b.brand) || collator.compare(a.title, b.title));
    if (state.sort === 'featured') products = [...products].sort((a, b) => a.order - b.order);
    return products;
  };

  const cardTemplate = (product) => `
    <article class="product-card">
      <button class="product-image-button" type="button" data-open-product="${escapeHtml(product.id)}" aria-label="Ver ${escapeHtml(product.title)}">
        <img class="product-image" src="${escapeHtml(product.image)}" alt="${escapeHtml(product.title)}" loading="lazy" decoding="async">
      </button>
      <div class="product-info">
        <p class="product-category">${escapeHtml(product.category)}</p>
        <h3 class="product-title">${escapeHtml(product.title)}</h3>
        <p class="product-brand">${escapeHtml(product.brand)}${product.code ? ` · ${escapeHtml(product.code)}` : ''}</p>
        <button class="product-action" type="button" data-open-product="${escapeHtml(product.id)}">Ver producto</button>
      </div>
    </article>`;

  const renderProducts = () => {
    const grid = $('#products-grid');
    const empty = $('#empty-state');
    const label = $('#results-label');
    if (!grid || !empty || !label) return;

    const products = filteredProducts();
    grid.innerHTML = products.map(cardTemplate).join('');
    grid.hidden = products.length === 0;
    empty.classList.toggle('is-visible', products.length === 0);
    label.textContent = `${products.length} ${products.length === 1 ? 'producto' : 'productos'}`;

    $$('.product-image', grid).forEach((image) => image.addEventListener('error', () => {
      if (image.dataset.fallbackApplied) return;
      image.dataset.fallbackApplied = 'true';
      image.src = placeholderFor(image.alt);
    }, { once: true }));
  };

  const updateActiveControls = () => {
    $$('[data-category]').forEach((button) => {
      const active = button.dataset.category === state.category;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    });
  };

  const selectCategory = (category) => {
    state.category = category || 'Todos';
    updateActiveControls();
    renderProducts();
    $('#mobile-category-panel')?.classList.remove('is-open');
    $('#mobile-category-toggle')?.setAttribute('aria-expanded', 'false');
  };

  const openProduct = (id) => {
    const product = state.products.find((item) => item.id === id);
    const modal = $('#product-modal');
    if (!product || !modal) return;

    $('#modal-image').src = product.image;
    $('#modal-image').alt = product.title;
    $('#modal-category').textContent = product.category;
    $('#modal-title').textContent = product.title;
    $('#modal-brand').textContent = `${product.brand}${product.code ? ` · ${product.code}` : ''}`;
    const copy = $('.modal-copy', modal);
    if (copy) copy.textContent = product.description || 'Consultanos para conocer modelos disponibles, medidas y opciones para tu obra.';
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

  const setHero = (source, products, allImages) => {
    const hero = $('#hero-image');
    const mobile = $('#hero-mobile-source');
    if (!hero) return;

    const scored = allImages
      .filter((image) => !/(logo|favicon|icon|instagram|whatsapp|avatar|loader|placeholder)/i.test(image))
      .map((image) => {
        const text = normalize(image);
        let score = 0;
        if (/(hero|banner|portada)/.test(text)) score += 100;
        if (/(exterior|jardin|patio|adoquin|cesped|durmiente)/.test(text)) score += 70;
        if (/social-preview/.test(text)) score += 20;
        return { image, score };
      })
      .sort((a, b) => b.score - a.score);

    const exteriorProduct = products.find((product) => product.category === 'Exterior');
    const candidate = scored.find((item) => item.score > 0)?.image || exteriorProduct?.image || products[0]?.image;
    if (!candidate) return;

    if (mobile) mobile.srcset = candidate;
    hero.src = candidate;
    hero.addEventListener('error', () => {
      const secondChoice = exteriorProduct?.image || products[0]?.image;
      if (secondChoice && hero.src !== new URL(secondChoice, location.href).href) hero.src = secondChoice;
    }, { once: true });
  };

  const setupInteractions = () => {
    const search = $('#catalog-search');
    const clear = $('#clear-search');
    const sort = $('#sort-products');
    const menuButton = $('#mobile-menu-button');
    const menu = $('#mobile-menu');
    const categoryToggle = $('#mobile-category-toggle');
    const categoryPanel = $('#mobile-category-panel');

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

    categoryToggle?.addEventListener('click', () => {
      const open = !categoryPanel?.classList.contains('is-open');
      categoryPanel?.classList.toggle('is-open', open);
      categoryToggle.setAttribute('aria-expanded', String(open));
    });

    $('#modal-close')?.addEventListener('click', closeProduct);
    $('#product-modal')?.addEventListener('click', (event) => {
      if (event.target.id === 'product-modal') closeProduct();
    });

    document.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return;
      closeProduct();
      menu?.classList.remove('is-open');
      menuButton?.setAttribute('aria-expanded', 'false');
      document.body.classList.remove('menu-open');
    });
  };

  const loadCatalog = async () => {
    const loading = $('#loading-state');
    const error = $('#catalog-error');
    const grid = $('#products-grid');

    try {
      const responses = await Promise.all(SOURCE_PARTS.map((path) => fetch(path, { cache: 'no-store' })));
      if (responses.some((response) => !response.ok)) throw new Error('No se pudieron leer los archivos del catálogo.');
      const source = (await Promise.all(responses.map((response) => response.text()))).join('\n');
      const allImages = collectImages(source);
      let products = parseCatalogObjects(source);
      if (products.length === 0) products = fallbackProductsFromImages(allImages);
      if (products.length === 0) throw new Error('El catálogo no contiene productos reconocibles.');

      state.products = products;
      setHero(source, products, allImages);
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
