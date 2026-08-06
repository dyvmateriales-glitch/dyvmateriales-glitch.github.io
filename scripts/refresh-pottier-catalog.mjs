import { execFile } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const source = (await Promise.all([
  readFile(new URL('../assets/app.part0', import.meta.url), 'utf8'),
  readFile(new URL('../assets/app.part1', import.meta.url), 'utf8'),
])).join('');

function decode(value = '') {
  return String(value)
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
}

function field(object, key) {
  const safe = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const head = new RegExp(`(?:^|[,\\s{])(?:["']?${safe}["']?)\\s*:`, 'g');
  const match = head.exec(object);
  if (!match) return '';
  let index = match.index + match[0].length;
  while (/\s/.test(object[index] || '')) index += 1;
  const quote = object[index];
  if (quote !== '"' && quote !== "'" && quote.charCodeAt(0) !== 96) return '';
  let value = '';
  let escaped = false;
  index += 1;
  for (; index < object.length; index += 1) {
    const character = object[index];
    if (escaped) {
      value += `\\${character}`;
      escaped = false;
    } else if (character === '\\') {
      escaped = true;
    } else if (character === quote) {
      break;
    } else {
      value += character;
    }
  }
  return decode(value);
}

function objectsFrom(body) {
  const objects = [];
  let start = -1;
  let depth = 0;
  let quote = '';
  let escaped = false;
  for (let index = 0; index < body.length; index += 1) {
    const character = body[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === quote) quote = '';
      continue;
    }
    if (character === '"' || character === "'" || character.charCodeAt(0) === 96) {
      quote = character;
      continue;
    }
    if (character === '{') {
      if (depth === 0) start = index;
      depth += 1;
    } else if (character === '}' && depth && --depth === 0) {
      objects.push(body.slice(start, index + 1));
    }
  }
  return objects;
}

function allObjectsFrom(body) {
  const objects = [];
  const stack = [];
  let quote = '';
  let escaped = false;
  for (let index = 0; index < body.length; index += 1) {
    const character = body[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === quote) quote = '';
      continue;
    }
    if (character === '"' || character === "'" || character.charCodeAt(0) === 96) {
      quote = character;
      continue;
    }
    if (character === '{') stack.push(index);
    else if (character === '}' && stack.length) {
      const start = stack.pop();
      objects.push(body.slice(start, index + 1));
    }
  }
  return objects;
}

function catalogRoutes() {
  const familyLabels = {
    Pisos: 'Pisos y revestimientos',
    Baño: 'Baño y cocina',
    Muebles: 'Muebles',
    Obra: 'Productos para obra',
    Terminaciones: 'Terminaciones',
    Exterior: 'Exterior',
  };
  const marker = source.indexOf('],b=[{id:`ceramicos`');
  if (marker < 0) throw new Error('No se encontró la definición de categorías.');
  const start = source.indexOf('[', marker + 3);
  let depth = 0;
  let quote = '';
  let escaped = false;
  let end = -1;
  for (let index = start; index < source.length; index += 1) {
    const character = source[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === quote) quote = '';
      continue;
    }
    if (character === '"' || character === "'" || character.charCodeAt(0) === 96) {
      quote = character;
      continue;
    }
    if (character === '[') depth += 1;
    else if (character === ']' && --depth === 0) {
      end = index;
      break;
    }
  }
  if (end < 0) throw new Error('La definición de categorías está incompleta.');

  const routes = [];
  for (const category of objectsFrom(source.slice(start + 1, end))) {
    if (field(category, 'source') !== 'catalog') continue;
    const rubro = field(category, 'pottierRubro');
    const child = field(category, 'label');
    const parent = familyLabels[field(category, 'group')];
    if (!rubro || !parent || !child) continue;
    for (const section of allObjectsFrom(category)) {
      const subrubro = field(section, 'pottierSubrubro');
      const sectionLabel = field(section, 'label');
      if (!subrubro || !sectionLabel) continue;
      routes.push({ rubro, subrubro, parent, child, sectionLabel });
    }
  }
  const bathroomAccessoryRoutes = [
    { rubro: '000004', subrubro: '000007', sectionLabel: 'Barrales de seguridad' },
    { rubro: '000004', subrubro: '000012', sectionLabel: 'Duchas y duchadores' },
    { rubro: '000004', subrubro: '000082', sectionLabel: 'Flexibles' },
    { rubro: '000004', subrubro: '000011', sectionLabel: 'Juegos de accesorios' },
    { rubro: '000004', subrubro: '000010', sectionLabel: 'Organizadores' },
    { rubro: '000004', subrubro: '000009', sectionLabel: 'Rejillas' },
    { rubro: '000004', subrubro: '000015', sectionLabel: 'Instalación y ventilación' },
  ];

  for (const route of bathroomAccessoryRoutes) {
    if (!routes.some(item => item.rubro === route.rubro && item.subrubro === route.subrubro)) {
      routes.push({ ...route, parent: 'Accesorios para baño', child: route.sectionLabel });
    }
  }

  return routes.map(route => {
    const normalized = { ...route, child: route.sectionLabel };
    if (route.rubro === '000001') normalized.parent = 'Cerámicos';
    else if (route.rubro === '000002') {
      normalized.parent = 'Porcelanatos';
      normalized.child = route.sectionLabel.replace(/^Porcellanatos/i, 'Porcelanatos');
      normalized.sectionLabel = normalized.child;
    } else if (route.rubro === '000011') normalized.parent = 'Pisos SPC Click';
    else if (route.rubro === '000010') normalized.parent = 'Revestimientos';
    else if (route.rubro === '000007') normalized.parent = route.subrubro === '000028' ? 'Revestimientos' : 'Terminaciones';
    else if (route.rubro === '000003') normalized.parent = 'Griferías';
    else if (route.rubro === '000005') normalized.parent = 'Sanitarios';
    else if (route.rubro === '000004') normalized.parent = 'Accesorios para baño';
    else if (route.rubro === '000006') {
      normalized.parent = ['000024', '000072'].includes(route.subrubro) ? 'Accesorios para baño' : 'Muebles';
    } else if (route.rubro === '000008') {
      normalized.parent = 'Productos para obra';
      if (route.subrubro === '000030') normalized.child = normalized.sectionLabel = 'Pastinas';
      if (route.subrubro === '000029') normalized.child = normalized.sectionLabel = 'Pegamentos';
    } else if (route.rubro === '000009') {
      normalized.parent = route.subrubro === '000031' ? 'Productos para obra' : 'Terminaciones';
      if (normalized.sectionLabel === 'Terminaciones') normalized.child = normalized.sectionLabel = 'Perfiles y terminaciones';
      if (normalized.sectionLabel === 'Listellos') normalized.child = normalized.sectionLabel = 'Listelos';
    }
    return normalized;
  });
}

function includeProduct(product, route) {
  if (route.rubro !== '000004' || route.subrubro !== '000015') return true;
  const code = String(product.codigo || '').trim();
  const constructionCodes = new Set([
    '2335', '569', '2331', '2333', '1007',
    '1652', '2619',
    '4333', '4421',
    '4027', '4029', '4546', '4547', '4028',
    '4030', '4229', '4548', '4031', '4032',
  ]);
  return constructionCodes.has(code);
}

async function requestJson(url, attempt = 1) {
  try {
    const { stdout } = await execFileAsync('curl', [
      '-L', '--fail', '--max-time', '30', '-sS', url,
    ], { maxBuffer: 20 * 1024 * 1024 });
    return JSON.parse(stdout);
  } catch (error) {
    if (attempt < 3) return requestJson(url, attempt + 1);
    throw error;
  }
}

async function fetchRoute(route) {
  const products = [];
  for (let page = 0; page < 100; page += 1) {
    const query = new URLSearchParams({
      rubro: route.rubro,
      subrubro: route.subrubro,
      page: String(page),
    });
    const data = await requestJson(`https://revestimientospottier.com.ar/productos/json/?${query}`);
    for (const product of data.productos || []) {
      if (!product.codigo || !product.descri) continue;
      if (!includeProduct(product, route)) continue;
      const title = String(product.descri).trim();
      const isAdhesive = /\b(adhesivo|profix)\b/i.test(title);
      products.push({
        id: `catalog-${String(product.codigo).trim()}`,
        title,
        image: product.foto
          ? `https://revestimientospottier.com.ar/fotos/${encodeURIComponent(product.foto).replace(/%2F/gi, '/')}`
          : '',
        brand: String(product.marca || '').trim(),
        description: `Código ${String(product.codigo).trim()} · Unidad: ${String(product.unidad || '').trim()} · Presentación: ${String(product.envase || '').trim()}`,
        code: String(product.codigo).trim(),
        parent: isAdhesive ? 'Productos para obra' : route.parent,
        child: isAdhesive ? 'Adhesivos' : route.child,
        displayCategory: isAdhesive ? 'Adhesivos' : route.sectionLabel,
      });
    }
    if (!data.has_more) break;
  }
  return products;
}

const routes = catalogRoutes();
const collected = [];
let cursor = 0;

async function worker() {
  while (cursor < routes.length) {
    const route = routes[cursor++];
    collected.push(...await fetchRoute(route));
  }
}

await Promise.all(Array.from({ length: 6 }, worker));

const productsById = new Map();
for (const product of collected) {
  if (!productsById.has(product.id)) productsById.set(product.id, product);
}

const catalog = [...productsById.values()].map((product, order) => ({ ...product, order }));
await writeFile(
  new URL('../assets/pottier-current.json', import.meta.url),
  `${JSON.stringify({ generatedAt: new Date().toISOString(), products: catalog })}\n`,
  'utf8',
);

console.log(`Catálogo Pottier actualizado: ${catalog.length} productos en ${routes.length} subcategorías.`);
