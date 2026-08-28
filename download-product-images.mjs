import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const source = await readFile('script.js', 'utf8');
const rawText = source.match(/const raw=(\[.*?\]);\r?\nconst verifiedImages/s)?.[1];
if (!rawText) throw new Error('Could not read the product list.');
const products = Function(`"use strict"; return (${rawText})`)();
await mkdir('product-images', { recursive: true });
const verified = {
  'Skittles Original': 'https://images.openfoodfacts.org/images/products/489/701/044/8016/front_en.11.400.jpg',
  "M&M's Milk Chocolate": 'https://images.openfoodfacts.org/images/products/500/015/956/1686/front_fr.3.400.jpg',
  "Reese's Peanut Butter Cups": 'https://www.pngplay.com/wp-content/uploads/15/Reeses-Peanut-Butter-Cups-PNG-Photos.png',
  'Twix Bar': 'https://pngset.com/images/candy-bars-twix-transparent-png-55110.png',
  'Wise Onion Rings': 'https://i5.peapod.com/c/UI/UIOPG.png'
};

const headers = { 'User-Agent': 'ShackShackSchoolMenu/1.0 (educational project)' };
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const safeBrand = name => name.split(' ')[0].replace(/[^a-z0-9'-]/gi, '').toLowerCase();

async function openFoodFactsImage(name) {
  const brand = safeBrand(name);
  const urls = [
    `https://world.openfoodfacts.org/api/v2/search?brands_tags=${encodeURIComponent(brand)}&page_size=20&sort_by=unique_scans_n&fields=product_name,image_front_url,image_url`,
    `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(name)}&search_simple=1&action=process&json=1&page_size=20&fields=product_name,image_front_url,image_url`
  ];
  for (const url of urls) {
    try {
      const response = await fetch(url, { headers });
      if (!response.ok) continue;
      const data = await response.json();
      const match = (data.products || []).find(item => item.image_front_url || item.image_url);
      if (match) return match.image_front_url || match.image_url;
    } catch {}
    await sleep(250);
  }
  return null;
}

const manifest = {};
for (let index = 0; index < products.length; index++) {
  const name = products[index][0];
  let imageUrl = verified[name] || products[index][4] || await openFoodFactsImage(name);
  if (!imageUrl) imageUrl = `https://tse1.mm.bing.net/th?q=${encodeURIComponent(name + ' product package')}&w=640&h=480&c=7&rs=1&p=0`;
  let response = await fetch(imageUrl, { headers, redirect: 'follow' });
  if (!response.ok) {
    imageUrl = `https://tse1.mm.bing.net/th?q=${encodeURIComponent(name + ' snack package')}&w=640&h=480&c=7&rs=1&p=0`;
    response = await fetch(imageUrl, { headers, redirect: 'follow' });
  }
  if (!response.ok) throw new Error(`No image for ${name}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  const filename = `${index + 1}.jpg`;
  await writeFile(path.join('product-images', filename), bytes);
  manifest[name] = { file: `product-images/${filename}`, source: imageUrl };
  process.stdout.write(`[${index + 1}/${products.length}] ${name}\n`);
  await sleep(220);
}
await writeFile('product-images/manifest.json', JSON.stringify(manifest, null, 2));
console.log(`Saved ${products.length} product pictures.`);
