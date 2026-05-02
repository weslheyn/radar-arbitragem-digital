const STORAGE_KEY = 'radar_arbitragem_produtos_v2_pro';
let products = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
let selectedProductId = null;
let deferredPrompt = null;

const $ = (id) => document.getElementById(id);
const money = (value) => Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const percent = (value) => `${Number(value || 0).toFixed(1)}%`;
const number = (value) => Number(String(value || 0).replace(',', '.'));

const SUPPLIER_BASE = [
  { key:'fone', name:'Fone Bluetooth Premium', cost:32, shipping:8, buy:'https://www.aliexpress.com/wholesale?SearchText=bluetooth+earbuds' },
  { key:'fone', name:'Fone Bluetooth Gamer LED', cost:45, shipping:10, buy:'https://shopee.com.br/search?keyword=fone%20bluetooth%20gamer' },
  { key:'smartwatch', name:'Smartwatch Tela Grande', cost:68, shipping:12, buy:'https://www.aliexpress.com/wholesale?SearchText=smartwatch' },
  { key:'relogio', name:'Smartwatch Esportivo', cost:72, shipping:12, buy:'https://shopee.com.br/search?keyword=smartwatch' },
  { key:'camera', name:'Mini Câmera Wi-Fi Segurança', cost:58, shipping:12, buy:'https://www.aliexpress.com/wholesale?SearchText=mini+wifi+camera' },
  { key:'mini camera', name:'Mini Câmera Wi-Fi 1080p', cost:62, shipping:12, buy:'https://shopee.com.br/search?keyword=mini%20camera%20wifi' },
  { key:'carregador', name:'Carregador Turbo USB-C', cost:18, shipping:6, buy:'https://shopee.com.br/search?keyword=carregador%20turbo%20usb%20c' },
  { key:'cabo', name:'Cabo Reforçado Tipo-C', cost:9, shipping:5, buy:'https://shopee.com.br/search?keyword=cabo%20tipo%20c%20reforcado' },
  { key:'suporte', name:'Suporte Veicular Magnético', cost:16, shipping:6, buy:'https://shopee.com.br/search?keyword=suporte%20veicular%20magnetico' },
  { key:'caixa', name:'Caixa de Som Bluetooth Portátil', cost:49, shipping:14, buy:'https://www.aliexpress.com/wholesale?SearchText=bluetooth+speaker' }
];

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
  if (shipping <= sale * 0.18) score += 1;
  if ((data.notes || '').length > 10) score += 1;
  score = Math.min(10, Math.max(0, score));
  const level = margin >= 30 && profit >= 20 ? 'excellent' : margin >= 15 && profit > 0 ? 'medium' : 'bad';
  const label = level === 'excellent' ? 'Excelente' : level === 'medium' ? 'Médio' : 'Ruim';
  const action = level === 'excellent' ? 'COMPRAR E ANUNCIAR' : level === 'medium' ? 'ANALISAR CONCORRÊNCIA' : 'NÃO COMPRAR AINDA';
  return { cost, sale, shipping, packing, risk, feePercent, feeValue, totalCost, profit, margin, roiOnSale, score, level, label, action };
}

function getFormData() {
  return { name:$('name').value.trim(), buyLink:$('buyLink').value.trim(), sellLink:$('sellLink').value.trim(), cost:$('cost').value, sale:$('sale').value, shipping:$('shipping').value, feePercent:$('feePercent').value, packing:$('packing').value, risk:$('risk').value, notes:$('notes').value.trim() };
}
function saveProducts(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(products)); }
function uid(){ return crypto.randomUUID ? crypto.randomUUID() : String(Date.now()+Math.random()); }

async function fetchMercadoLivre(query){
  const url = `https://api.mercadolibre.com/sites/MLB/search?q=${encodeURIComponent(query)}&limit=20`;
  const res = await fetch(url);
  if(!res.ok) throw new Error('Falha ao consultar Mercado Livre');
  const data = await res.json();
  return (data.results || []).filter(i => i.price).map(i => ({ title:i.title, price:Number(i.price), link:i.permalink, sold:i.sold_quantity || 0, condition:i.condition }));
}
function median(values){ const v=values.filter(Boolean).sort((a,b)=>a-b); if(!v.length) return 0; const mid=Math.floor(v.length/2); return v.length%2?v[mid]:(v[mid-1]+v[mid])/2; }
function supplierCandidates(query){
  const q=query.toLowerCase();
  let found = SUPPLIER_BASE.filter(s => q.includes(s.key) || s.name.toLowerCase().includes(q) || q.split(' ').some(w=>s.name.toLowerCase().includes(w)));
  if(!found.length) found = SUPPLIER_BASE.slice(0,5);
  return found;
}
async function runAutoRadar(){
  const query = $('autoQuery').value.trim();
  if(!query) return alert('Digite um nicho/produto para buscar.');
  const minMargin = number($('autoMinMargin').value);
  const minProfit = number($('autoMinProfit').value);
  const fee = number($('autoFee').value);
  $('autoStatus').textContent = 'Buscando preços reais no Mercado Livre...';
  try{
    const market = await fetchMercadoLivre(query);
    const marketMedian = median(market.map(i=>i.price));
    const topRef = market.sort((a,b)=>b.sold-a.sold || a.price-b.price)[0];
    const candidates = supplierCandidates(query);
    let created = [];
    candidates.forEach(s=>{
      const sale = Math.max(marketMedian * 0.96, s.cost * 1.75);
      const data = { name:s.name, buyLink:s.buy, sellLink: topRef?.link || `https://lista.mercadolivre.com.br/${encodeURIComponent(query)}`, cost:s.cost, sale:sale.toFixed(2), shipping:s.shipping, feePercent:fee, packing:2, risk:5, notes:`Gerado pelo radar automático. Preço médio ML: ${money(marketMedian)}. Referência: ${topRef?.title || query}. Validar estoque e prazo antes de comprar.` };
      const calc = calculate(data);
      if(calc.margin >= minMargin && calc.profit >= minProfit){
        created.push({ id:uid(), ...data, calc, source:'auto-ml', createdAt:new Date().toISOString(), status:'ativo' });
      }
    });
    products = [...created, ...products];
    saveProducts(); render();
    $('autoStatus').textContent = created.length ? `Radar concluído: ${created.length} oportunidade(s) criada(s). Preço médio analisado: ${money(marketMedian)}.` : `Nenhuma oportunidade passou nos filtros. Preço médio analisado: ${money(marketMedian)}. Reduza margem/lucro mínimo ou tente outro nicho.`;
  }catch(err){
    console.error(err);
    $('autoStatus').textContent = 'Não consegui consultar online agora. Carregando oportunidades exemplo para teste.';
    importDemo();
  }
}
function importDemo(){
  const demos = [
    {name:'Fone Bluetooth Premium', cost:32, sale:89, shipping:8, feePercent:13, packing:2, risk:5, buyLink:'https://shopee.com.br/search?keyword=fone%20bluetooth', sellLink:'https://lista.mercadolivre.com.br/fone-bluetooth', notes:'Exemplo: produto de giro rápido. Validar fornecedor antes da compra.'},
    {name:'Mini Câmera Wi-Fi 1080p', cost:58, sale:129, shipping:12, feePercent:13, packing:2, risk:5, buyLink:'https://shopee.com.br/search?keyword=mini%20camera%20wifi', sellLink:'https://lista.mercadolivre.com.br/mini-camera-wifi', notes:'Exemplo: produto com boa percepção de valor e margem.'},
    {name:'Carregador Turbo USB-C', cost:18, sale:49, shipping:6, feePercent:13, packing:2, risk:4, buyLink:'https://shopee.com.br/search?keyword=carregador%20turbo%20usb%20c', sellLink:'https://lista.mercadolivre.com.br/carregador-turbo-usb-c', notes:'Exemplo: baixo custo, fácil envio e venda recorrente.'}
  ].map(d=>({id:uid(), ...d, calc:calculate(d), source:'demo', createdAt:new Date().toISOString(), status:'ativo'}));
  products = [...demos, ...products]; saveProducts(); render(); $('autoStatus').textContent = `Foram carregadas ${demos.length} oportunidades exemplo.`;
}
function clearAll(){ if(confirm('Limpar todos os produtos do radar?')){ products=[]; selectedProductId=null; $('adText').value=''; saveProducts(); render(); }}

function updatePreview(){ const calc=calculate(getFormData()); const card=$('previewStatus'); card.className=`result-card ${calc.level}`; $('previewLabel').textContent=calc.label; $('previewProfit').textContent=money(calc.profit); $('previewMargin').textContent=`Margem ${percent(calc.margin)} | Taxa ${money(calc.feeValue)}`; $('previewScore').textContent=`${calc.score.toFixed(1)} / 10`; $('previewAction').textContent=calc.action; }
function addProduct(event){ event.preventDefault(); const data=getFormData(); const product={id:uid(), ...data, calc:calculate(data), createdAt:new Date().toISOString(), status:'ativo'}; products.unshift(product); saveProducts(); render(); $('productForm').reset(); $('shipping').value=0; $('feePercent').value=12; $('packing').value=2; $('risk').value=5; updatePreview(); }
function generateAd(product){ return `🔥 ${product.name}\n\nProduto novo, ótimo custo-benefício e pronto para envio conforme disponibilidade.\n\n✅ Qualidade selecionada\n✅ Atendimento direto pelo WhatsApp\n✅ Entrega/retirada a combinar\n✅ Poucas unidades disponíveis\n\nPreço: ${money(product.calc.sale)}\n\nChame agora para confirmar disponibilidade.\n\n${product.notes || ''}`; }
function selectProduct(id){ selectedProductId=id; const product=products.find(i=>i.id===id); if(!product) return; $('adText').value=generateAd(product); window.location.hash='adText'; }
function duplicateProduct(id){ const p=products.find(i=>i.id===id); if(!p)return; products.unshift({...p,id:uid(),name:`${p.name} (cópia)`,createdAt:new Date().toISOString()}); saveProducts(); render(); }
function deleteProduct(id){ if(!confirm('Deseja excluir este produto do radar?')) return; products=products.filter(i=>i.id!==id); if(selectedProductId===id){selectedProductId=null;$('adText').value='';} saveProducts(); render(); }
function renderStats(){ const active=products.length; const totalProfit=products.reduce((s,i)=>s+number(i.calc.profit),0); const excellent=products.filter(i=>i.calc.level==='excellent').length; const avg=active?products.reduce((s,i)=>s+number(i.calc.margin),0)/active:0; const best=active?Math.max(...products.map(i=>number(i.calc.score))):0; $('heroProfit').textContent=money(totalProfit); $('heroProducts').textContent=`${active} produtos ativos`; $('totalProducts').textContent=active; $('excellentCount').textContent=excellent; $('avgMargin').textContent=percent(avg); $('bestScore').textContent=best.toFixed(1); }
function renderProducts(){ const search=$('searchInput').value.toLowerCase(); const filter=$('filterSelect').value; const list=$('productsList'); let visible=products.filter(p=>p.name.toLowerCase().includes(search)); if(filter!=='all') visible=visible.filter(p=>p.calc.level===filter); visible.sort((a,b)=>b.calc.score-a.calc.score||b.calc.profit-a.calc.profit); if(!visible.length){ list.innerHTML=`<div class="product-card"><h3>Nenhum produto encontrado</h3><p>Use o Radar Automático acima ou cadastre uma oportunidade manual.</p></div>`; return; } list.innerHTML=visible.map(product=>`<article class="product-card"><span class="badge ${product.calc.level}">${product.calc.label} • Score ${product.calc.score.toFixed(1)} ${product.source==='auto-ml'?'• AUTO':''}</span><h3>${escapeHtml(product.name)}</h3><div class="metrics"><div class="metric"><span>Compra</span><strong>${money(product.calc.cost)}</strong></div><div class="metric"><span>Venda</span><strong>${money(product.calc.sale)}</strong></div><div class="metric"><span>Lucro</span><strong>${money(product.calc.profit)}</strong></div><div class="metric"><span>Margem</span><strong>${percent(product.calc.margin)}</strong></div></div><p>${escapeHtml(product.calc.action)}</p><div class="card-actions"><button class="small-btn" onclick="selectProduct('${product.id}')">Gerar anúncio</button>${product.buyLink?`<button class="small-btn" onclick="window.open('${safeUrl(product.buyLink)}','_blank')">Comprar</button>`:''}${product.sellLink?`<button class="small-btn" onclick="window.open('${safeUrl(product.sellLink)}','_blank')">Ver mercado</button>`:''}<button class="small-btn" onclick="duplicateProduct('${product.id}')">Duplicar</button><button class="small-btn danger" onclick="deleteProduct('${product.id}')">Excluir</button></div></article>`).join(''); }
function escapeHtml(text=''){ return String(text).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[c])); }
function safeUrl(url=''){ return String(url).replace(/'/g,'%27'); }
function render(){ renderStats(); renderProducts(); }
function copyAd(){ const text=$('adText').value.trim(); if(!text)return alert('Selecione um produto para gerar o anúncio.'); navigator.clipboard.writeText(text).then(()=>alert('Anúncio copiado.')); }
function openWhats(){ const text=encodeURIComponent($('adText').value||''); if(!text)return alert('Selecione um produto primeiro.'); window.open(`https://wa.me/?text=${text}`,'_blank'); }

window.addEventListener('beforeinstallprompt',(event)=>{event.preventDefault();deferredPrompt=event;$('installBanner').classList.remove('hidden');});
$('installBtn').addEventListener('click',async()=>{ if(!deferredPrompt)return; deferredPrompt.prompt(); await deferredPrompt.userChoice; deferredPrompt=null; $('installBanner').classList.add('hidden'); });
$('closeInstall').addEventListener('click',()=>$('installBanner').classList.add('hidden'));
$('runAutoRadar').addEventListener('click', runAutoRadar);
$('importDemo').addEventListener('click', importDemo);
$('clearAll').addEventListener('click', clearAll);
$('productForm').addEventListener('submit', addProduct);
$('clearBtn').addEventListener('click',()=>{$('productForm').reset();updatePreview();});
['name','cost','sale','shipping','feePercent','packing','risk','notes'].forEach(id=>$(id).addEventListener('input', updatePreview));
$('searchInput').addEventListener('input', renderProducts);
$('filterSelect').addEventListener('change', renderProducts);
$('copyAdBtn').addEventListener('click', copyAd);
$('openFacebookBtn').addEventListener('click',()=>window.open('https://www.facebook.com/marketplace/create/item','_blank'));
$('openOlxBtn').addEventListener('click',()=>window.open('https://www.olx.com.br/anunciar','_blank'));
$('openWhatsBtn').addEventListener('click', openWhats);
if('serviceWorker' in navigator) navigator.serviceWorker.register('service-worker.js');
updatePreview(); render();
