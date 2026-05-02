const STORAGE_KEY = 'radar_arbitragem_produtos_v1';
let products = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
let selectedProductId = null;
let deferredPrompt = null;

const $ = (id) => document.getElementById(id);
const money = (value) => Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const percent = (value) => `${Number(value || 0).toFixed(1)}%`;
const number = (value) => Number(value || 0);

function calculate(data) {
  const cost = number(data.cost);
  const sale = number(data.sale);
  const shipping = number(data.shipping);
  const packing = number(data.packing);
  const risk = number(data.risk);
  const feePercent = number(data.feePercent);
  const feeValue = sale * (feePercent / 100);
  const totalCost = cost + shipping + packing + risk + feeValue;
  const profit = sale - totalCost;
  const margin = cost > 0 ? (profit / cost) * 100 : 0;
  const roiOnSale = sale > 0 ? (profit / sale) * 100 : 0;
  let score = 0;
  if (profit > 0) score += 2;
  if (profit >= 20) score += 2;
  if (margin >= 25) score += 2;
  if (margin >= 40) score += 1;
  if (sale > cost * 1.6) score += 1;
  if (shipping <= sale * 0.15) score += 1;
  if ((data.notes || '').length > 10) score += 1;
  score = Math.min(10, Math.max(0, score));
  const level = margin >= 30 && profit >= 20 ? 'excellent' : margin >= 15 && profit > 0 ? 'medium' : 'bad';
  const label = level === 'excellent' ? 'Excelente' : level === 'medium' ? 'Médio' : 'Ruim';
  const action = level === 'excellent' ? 'COMPRAR E ANUNCIAR' : level === 'medium' ? 'ANALISAR CONCORRÊNCIA' : 'NÃO COMPRAR AINDA';
  return { cost, sale, shipping, packing, risk, feePercent, feeValue, totalCost, profit, margin, roiOnSale, score, level, label, action };
}

function getFormData() {
  return {
    name: $('name').value.trim(),
    buyLink: $('buyLink').value.trim(),
    sellLink: $('sellLink').value.trim(),
    cost: $('cost').value,
    sale: $('sale').value,
    shipping: $('shipping').value,
    feePercent: $('feePercent').value,
    packing: $('packing').value,
    risk: $('risk').value,
    notes: $('notes').value.trim()
  };
}

function saveProducts() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(products));
}

function updatePreview() {
  const data = getFormData();
  const calc = calculate(data);
  const card = $('previewStatus');
  card.className = `result-card ${calc.level}`;
  $('previewLabel').textContent = calc.label;
  $('previewProfit').textContent = money(calc.profit);
  $('previewMargin').textContent = `Margem ${percent(calc.margin)} | Taxa ${money(calc.feeValue)}`;
  $('previewScore').textContent = `${calc.score.toFixed(1)} / 10`;
  $('previewAction').textContent = calc.action;
}

function addProduct(event) {
  event.preventDefault();
  const data = getFormData();
  const calc = calculate(data);
  const product = {
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
    ...data,
    calc,
    createdAt: new Date().toISOString(),
    status: 'ativo'
  };
  products.unshift(product);
  saveProducts();
  render();
  $('productForm').reset();
  $('shipping').value = 0;
  $('feePercent').value = 12;
  $('packing').value = 2;
  $('risk').value = 5;
  updatePreview();
}

function generateAd(product) {
  const sale = money(product.calc.sale);
  return `🔥 ${product.name}\n\nProduto com ótima qualidade, pronto para envio e ideal para quem busca praticidade no dia a dia.\n\n✅ Produto novo\n✅ Entrega rápida conforme disponibilidade\n✅ Ótimo custo-benefício\n✅ Atendimento direto pelo WhatsApp\n\nPreço: ${sale}\n\nTenho poucas unidades disponíveis. Chame agora para confirmar disponibilidade.\n\nObservação: ${product.notes || 'Produto selecionado com base em oportunidade de mercado.'}`;
}

function selectProduct(id) {
  selectedProductId = id;
  const product = products.find((item) => item.id === id);
  if (!product) return;
  $('adText').value = generateAd(product);
  window.location.hash = 'adText';
}

function duplicateProduct(id) {
  const product = products.find((item) => item.id === id);
  if (!product) return;
  const copy = { ...product, id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()), name: `${product.name} (cópia)`, createdAt: new Date().toISOString() };
  products.unshift(copy);
  saveProducts();
  render();
}

function deleteProduct(id) {
  if (!confirm('Deseja excluir este produto do radar?')) return;
  products = products.filter((item) => item.id !== id);
  if (selectedProductId === id) {
    selectedProductId = null;
    $('adText').value = '';
  }
  saveProducts();
  render();
}

function renderStats(filtered = products) {
  const active = products.length;
  const totalProfit = products.reduce((sum, item) => sum + number(item.calc.profit), 0);
  const excellent = products.filter((item) => item.calc.level === 'excellent').length;
  const avgMargin = active ? products.reduce((sum, item) => sum + number(item.calc.margin), 0) / active : 0;
  const best = active ? Math.max(...products.map((item) => number(item.calc.score))) : 0;
  $('heroProfit').textContent = money(totalProfit);
  $('heroProducts').textContent = `${active} produtos ativos`;
  $('totalProducts').textContent = active;
  $('excellentCount').textContent = excellent;
  $('avgMargin').textContent = percent(avgMargin);
  $('bestScore').textContent = best.toFixed(1);
}

function renderProducts() {
  const search = $('searchInput').value.toLowerCase();
  const filter = $('filterSelect').value;
  const list = $('productsList');
  let visible = products.filter((product) => product.name.toLowerCase().includes(search));
  if (filter !== 'all') visible = visible.filter((product) => product.calc.level === filter);
  visible.sort((a, b) => b.calc.score - a.calc.score || b.calc.profit - a.calc.profit);

  if (!visible.length) {
    list.innerHTML = `<div class="product-card"><h3>Nenhum produto encontrado</h3><p>Cadastre uma oportunidade para começar o radar.</p></div>`;
    return;
  }

  list.innerHTML = visible.map((product) => `
    <article class="product-card">
      <span class="badge ${product.calc.level}">${product.calc.label} • Score ${product.calc.score.toFixed(1)}</span>
      <h3>${escapeHtml(product.name)}</h3>
      <div class="metrics">
        <div class="metric"><span>Compra</span><strong>${money(product.calc.cost)}</strong></div>
        <div class="metric"><span>Venda</span><strong>${money(product.calc.sale)}</strong></div>
        <div class="metric"><span>Lucro</span><strong>${money(product.calc.profit)}</strong></div>
        <div class="metric"><span>Margem</span><strong>${percent(product.calc.margin)}</strong></div>
      </div>
      <p>${escapeHtml(product.calc.action)}</p>
      <div class="card-actions">
        <button class="small-btn" onclick="selectProduct('${product.id}')">Gerar anúncio</button>
        ${product.buyLink ? `<button class="small-btn" onclick="window.open('${safeUrl(product.buyLink)}','_blank')">Comprar</button>` : ''}
        ${product.sellLink ? `<button class="small-btn" onclick="window.open('${safeUrl(product.sellLink)}','_blank')">Ver referência</button>` : ''}
        <button class="small-btn" onclick="duplicateProduct('${product.id}')">Duplicar</button>
        <button class="small-btn danger" onclick="deleteProduct('${product.id}')">Excluir</button>
      </div>
    </article>`).join('');
}

function escapeHtml(text = '') {
  return text.replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;' }[char]));
}
function safeUrl(url = '') { return String(url).replace(/'/g, '%27'); }

function render() {
  renderStats();
  renderProducts();
}

function copyAd() {
  const text = $('adText').value.trim();
  if (!text) return alert('Selecione um produto para gerar o anúncio.');
  navigator.clipboard.writeText(text).then(() => alert('Anúncio copiado.'));
}

function openWhats() {
  const text = encodeURIComponent($('adText').value || '');
  if (!text) return alert('Selecione um produto primeiro.');
  window.open(`https://wa.me/?text=${text}`, '_blank');
}

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  deferredPrompt = event;
  $('installBanner').classList.remove('hidden');
});

$('installBtn').addEventListener('click', async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;
  $('installBanner').classList.add('hidden');
});
$('closeInstall').addEventListener('click', () => $('installBanner').classList.add('hidden'));

$('productForm').addEventListener('submit', addProduct);
$('clearBtn').addEventListener('click', () => { $('productForm').reset(); updatePreview(); });
['name','cost','sale','shipping','feePercent','packing','risk','notes'].forEach((id) => $(id).addEventListener('input', updatePreview));
$('searchInput').addEventListener('input', renderProducts);
$('filterSelect').addEventListener('change', renderProducts);
$('copyAdBtn').addEventListener('click', copyAd);
$('openFacebookBtn').addEventListener('click', () => window.open('https://www.facebook.com/marketplace/create/item', '_blank'));
$('openOlxBtn').addEventListener('click', () => window.open('https://www.olx.com.br/anunciar', '_blank'));
$('openWhatsBtn').addEventListener('click', openWhats);

if ('serviceWorker' in navigator) navigator.serviceWorker.register('service-worker.js');
updatePreview();
render();
