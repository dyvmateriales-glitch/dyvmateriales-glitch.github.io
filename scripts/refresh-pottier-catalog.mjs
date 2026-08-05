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
  return routes;
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
      products.push({
        id: `catalog-${String(product.codigo).trim()}`,
        title: String(product.descri).trim(),
        image: product.foto
          ? `https://revestimientospottier.com.ar/fotos/${encodeURIComponent(product.foto).replace(/%2F/gi, '/')}`
          : '',
        brand: String(product.marca || '').trim(),
        description: `Código ${String(product.codigo).trim()} · Unidad: ${String(product.unidad || '').trim()} · Presentación: ${String(product.envase || '').trim()}`,
        code: String(product.codigo).trim(),
        parent: route.parent,
        child: route.child,
        displayCategory: route.sectionLabel,
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
