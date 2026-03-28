// ══════════════════════════════════════
//   SHINE BIJOU — app.js
//   Con integración Supabase
// ══════════════════════════════════════

const WHATSAPP = '541141683864';
const ADMIN_USER = 'admin';
const ADMIN_PASS = 'shine2025';

const SUPABASE_URL = 'https://sftsomspmqqkksbqrmzz.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNmdHNvbXNwbXFxa2tzYnFybXp6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3MTY3NDgsImV4cCI6MjA5MDI5Mjc0OH0.dNmwgF7fdrsjm1eJ0G0LbZ9M0apcqnHs7q8pUqqo_OQ';

// ── Cliente Supabase liviano (fetch directo, sin SDK) ──
const db = {
  async get(table, order = 'id') {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?order=${order}`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
    });
    return res.json();
  },
  async insert(table, data) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
      method: 'POST',
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
      body: JSON.stringify(data)
    });
    return res.json();
  },
  async update(table, id, data) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, {
      method: 'PATCH',
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
      body: JSON.stringify(data)
    });
    return res.json();
  },
  async delete(table, id) {
    await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, {
      method: 'DELETE',
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
    });
  },
  async deleteWhere(table, col, val) {
    await fetch(`${SUPABASE_URL}/rest/v1/${table}?${col}=eq.${encodeURIComponent(val)}`, {
      method: 'DELETE',
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
    });
  }
};

// ══════════════════════════════════════
// ESTADO LOCAL (caché)
// ══════════════════════════════════════
let S = {
  categories: [],
  products: [],
  cart: {},
  selectedVariants: {},
  activeCat: 'Todo',
  searchQuery: '',
  adminLogged: false,
  coupons: [],
  appliedCoupon: null,
  pedidos: [],
  detailProductId: null,
  reviews: []
};

// ══════════════════════════════════════
// INIT
// ══════════════════════════════════════
async function init() {
  showLoading(true);
  try {
    const [cats, prods, coupons, pedidos, reviews] = await Promise.all([
      db.get('categories', 'name'),
      db.get('products', 'created_at'),
      db.get('coupons', 'id'),
      db.get('pedidos', 'created_at.desc'),
      db.get('reviews', 'id')
    ]);
    S.categories = cats.map(c => c.name);
    S.products = prods.map(p => ({ ...p, desc: p.description, variants: p.variants || [] }));
    S.coupons = coupons;
    S.pedidos = pedidos;
    S.reviews = reviews;
  } catch (e) {
    console.error('Error cargando datos:', e);
    showToast('Error conectando con la base de datos');
  }
  showLoading(false);
  showStore();
}

function showLoading(on) {
  let el = document.getElementById('loading-screen');
  if (!el) {
    el = document.createElement('div');
    el.id = 'loading-screen';
    el.style.cssText = 'position:fixed;inset:0;background:#0a0a0a;z-index:999;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:20px';
    el.innerHTML = '<div style="font-family:\'Cormorant Garamond\',serif;font-size:32px;letter-spacing:8px;color:#e8e8e8">SHINE</div><div style="font-size:9px;letter-spacing:4px;color:#555;text-transform:uppercase">Cargando...</div>';
    document.body.appendChild(el);
  }
  el.style.display = on ? 'flex' : 'none';
}

// ══════════════════════════════════════
// STORE
// ══════════════════════════════════════
function getFiltered() {
  let list = S.activeCat === 'Todo' ? [...S.products] : S.products.filter(p => p.cat === S.activeCat);
  if (S.searchQuery) {
    const q = S.searchQuery.toLowerCase();
    list = list.filter(p => p.name.toLowerCase().includes(q) || p.cat.toLowerCase().includes(q) || (p.desc || '').toLowerCase().includes(q));
  }
  const sf = document.getElementById('stock-filter');
  if (sf && sf.value === 'available') list = list.filter(p => p.stock > 0);
  const ss = document.getElementById('sort-select');
  if (ss) {
    if (ss.value === 'price-asc') list.sort((a, b) => a.price - b.price);
    else if (ss.value === 'price-desc') list.sort((a, b) => b.price - a.price);
    else if (ss.value === 'name-asc') list.sort((a, b) => a.name.localeCompare(b.name));
    else if (ss.value === 'featured') list.sort((a, b) => b.featured - a.featured);
  }
  return list;
}

function renderNavCats() {
  const c = document.getElementById('nav-cats');
  c.innerHTML = ['Todo', ...S.categories].map(cat =>
    `<button class="cat-btn ${cat === S.activeCat ? 'active' : ''}" onclick="filterCat('${cat}')">${cat}</button>`
  ).join('');
}

function filterCat(cat) {
  S.activeCat = cat;
  S.searchQuery = '';
  const si = document.getElementById('search-input');
  if (si) si.value = '';
  renderNavCats();
  renderProducts();
  document.getElementById('catalog-title').textContent = cat;
  showCatalog();
}

function doSearch(q) {
  S.searchQuery = q;
  S.activeCat = 'Todo';
  renderNavCats();
  renderProducts();
  document.getElementById('catalog-title').textContent = q ? `"${q}"` : 'Todo';
}

function renderProducts() {
  const grid = document.getElementById('products-grid');
  const list = getFiltered();
  document.getElementById('catalog-count').textContent = `${list.length} pieza${list.length !== 1 ? 's' : ''}`;
  if (!list.length) {
    grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:80px;font-family:'Cormorant Garamond',serif;font-style:italic;color:#888;font-size:20px">Sin resultados</div>`;
    return;
  }
  grid.innerHTML = list.map(p => {
    const inCart = S.cart[p.id] ? S.cart[p.id].qty : 0;
    return `<div class="product-card" onclick="openDetail(${p.id})">
      <div class="product-img">
        ${p.img ? `<img src="${p.img}" alt="${p.name}" onerror="this.parentElement.innerHTML='<div class=\\'product-img-ph\\'>${p.name[0]}</div>'">` : `<div class="product-img-ph">${p.name[0]}</div>`}
        <div class="product-badge">${p.cat}</div>
        ${p.featured ? `<div class="featured-badge">★ Destacado</div>` : ''}
        ${p.stock === 0 ? `<div class="out-overlay"><span>Sin stock</span></div>` : ''}
      </div>
      <div class="product-info">
        <div class="product-name">${p.name}</div>
        <div class="product-desc">${(p.desc || '').substring(0, 60)}...</div>
        <div class="product-footer">
          <div class="product-price">$${p.price.toLocaleString('es-AR')}</div>
          <button class="add-btn" onclick="event.stopPropagation();openDetail(${p.id})" ${p.stock === 0 ? 'disabled' : ''}>
            ${inCart > 0 ? `En carrito (${inCart})` : 'Ver'}
          </button>
        </div>
      </div>
    </div>`;
  }).join('');
}

function renderReviews() {
  document.getElementById('reviews-grid').innerHTML = S.reviews.map(r => `
    <div class="review-card">
      <div class="review-stars">${'★'.repeat(r.stars)}${'☆'.repeat(5 - r.stars)}</div>
      <div class="review-text">"${r.text}"</div>
      <div class="review-author">${r.author}</div>
      <div class="review-product">${r.product}</div>
    </div>`).join('');
}

// ══════════════════════════════════════
// PRODUCT DETAIL
// ══════════════════════════════════════
function openDetail(id) {
  const p = S.products.find(x => x.id === id);
  if (!p) return;
  S.detailProductId = id;
  document.getElementById('detail-cat').textContent = p.cat;
  document.getElementById('detail-name').textContent = p.name;
  document.getElementById('detail-price').textContent = `$${p.price.toLocaleString('es-AR')}`;
  document.getElementById('detail-desc').textContent = p.desc || '';
  const dab = document.getElementById('detail-add-btn');
  dab.disabled = p.stock === 0;
  dab.textContent = p.stock === 0 ? 'Sin stock disponible' : 'Agregar al carrito';
  const stockInfo = document.getElementById('detail-stock-info');
  stockInfo.textContent = p.stock > 0 ? `${p.stock} en stock` : 'Sin stock disponible';
  stockInfo.style.color = p.stock > 3 ? '#888' : p.stock > 0 ? '#aa8' : '#a55';
  const img = document.getElementById('detail-img');
  img.innerHTML = p.img ? `<img src="${p.img}" alt="${p.name}">` : `<div class="detail-img-ph">${p.name[0]}</div>`;
  const vw = document.getElementById('detail-variants-wrap');
  if (p.variants && p.variants.length) {
    if (!S.selectedVariants[id]) S.selectedVariants[id] = p.variants[0];
    vw.innerHTML = `<div class="detail-variants-label">Variante</div><div class="detail-variants">${p.variants.map(v => `<button class="variant-btn ${v === S.selectedVariants[id] ? 'active' : ''}" onclick="selectVariant(${id},'${v}')">${v}</button>`).join('')}</div>`;
  } else { vw.innerHTML = ''; }
  const related = S.products.filter(x => x.id !== id && x.cat === p.cat).slice(0, 4);
  document.getElementById('related-grid').innerHTML = related.length
    ? related.map(r => `<div class="product-card" onclick="openDetail(${r.id})"><div class="product-img">${r.img ? `<img src="${r.img}" alt="${r.name}">` : `<div class="product-img-ph">${r.name[0]}</div>`}${r.stock === 0 ? `<div class="out-overlay"><span>Sin stock</span></div>` : ''}</div><div class="product-info"><div class="product-name">${r.name}</div><div class="product-price">$${r.price.toLocaleString('es-AR')}</div></div></div>`).join('')
    : `<div style="color:#555;font-size:12px;letter-spacing:2px">No hay productos relacionados</div>`;
  document.getElementById('catalog-view').style.display = 'none';
  document.getElementById('product-detail').style.display = 'block';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function closeDetail() {
  document.getElementById('product-detail').style.display = 'none';
  document.getElementById('catalog-view').style.display = 'block';
}

function showCatalog() {
  document.getElementById('product-detail').style.display = 'none';
  document.getElementById('catalog-view').style.display = 'block';
}

function selectVariant(id, v) {
  S.selectedVariants[id] = v;
  openDetail(id);
}

function addFromDetail() {
  const id = S.detailProductId;
  const p = S.products.find(x => x.id === id);
  if (!p || p.stock === 0) return;
  const variant = S.selectedVariants[id] || null;
  if (!S.cart[id]) S.cart[id] = { qty: 0, variant };
  S.cart[id].qty++;
  updateCartCount();
  renderProducts();
  showToast(`${p.name} agregado al carrito`);
}

// ══════════════════════════════════════
// CART
// ══════════════════════════════════════
function updateCartCount() {
  const total = Object.values(S.cart).reduce((a, b) => a + b.qty, 0);
  const el = document.getElementById('cart-count');
  el.textContent = total;
  el.style.display = total > 0 ? 'flex' : 'none';
}

function toggleCart() {
  document.getElementById('cart-overlay').classList.toggle('open');
  document.getElementById('cart-sidebar').classList.toggle('open');
  renderCart();
}

function renderCart() {
  const items = document.getElementById('cart-items');
  const entries = Object.entries(S.cart).filter(([, v]) => v.qty > 0);
  if (!entries.length) {
    items.innerHTML = `<div class="cart-empty">Tu carrito está vacío</div>`;
    document.getElementById('cart-total').textContent = '$0';
    document.getElementById('discount-line').style.display = 'none';
    return;
  }
  let subtotal = 0;
  items.innerHTML = entries.map(([id, v]) => {
    const p = S.products.find(x => x.id === parseInt(id));
    if (!p) return '';
    subtotal += p.price * v.qty;
    return `<div class="cart-item">
      <div class="cart-item-img">${p.img ? `<img src="${p.img}" alt="${p.name}">` : p.name[0]}</div>
      <div class="cart-item-info">
        <div class="cart-item-name">${p.name}</div>
        ${v.variant ? `<div class="cart-item-variant">${v.variant}</div>` : ''}
        <div class="cart-item-price">$${p.price.toLocaleString('es-AR')} c/u</div>
        <div class="cart-item-qty">
          <button class="qty-btn" onclick="changeQty(${id}, -1)">−</button>
          <span class="qty-val">${v.qty}</span>
          <button class="qty-btn" onclick="changeQty(${id}, 1)">+</button>
        </div>
      </div>
    </div>`;
  }).join('');
  const dl = document.getElementById('discount-line');
  if (S.appliedCoupon) {
    const save = Math.round(subtotal * (S.appliedCoupon.discount / 100));
    dl.style.display = 'flex';
    document.getElementById('coupon-label-display').textContent = `Cupón ${S.appliedCoupon.code} (−${S.appliedCoupon.discount}%)`;
    document.getElementById('coupon-save-display').textContent = `−$${save.toLocaleString('es-AR')}`;
    document.getElementById('cart-total').textContent = `$${(subtotal - save).toLocaleString('es-AR')}`;
  } else {
    dl.style.display = 'none';
    document.getElementById('cart-total').textContent = `$${subtotal.toLocaleString('es-AR')}`;
  }
}

function changeQty(id, delta) {
  if (S.cart[id]) {
    S.cart[id].qty += delta;
    if (S.cart[id].qty <= 0) delete S.cart[id];
  }
  updateCartCount(); renderCart(); renderProducts();
}

function applyCoupon() {
  const code = document.getElementById('coupon-input').value.trim().toUpperCase();
  const msg = document.getElementById('coupon-msg');
  const c = S.coupons.find(x => x.code === code);
  if (c) {
    S.appliedCoupon = c;
    msg.style.color = '#6a6';
    msg.textContent = `✓ Cupón aplicado: ${c.discount}% de descuento`;
    renderCart();
  } else {
    S.appliedCoupon = null;
    msg.style.color = '#a55';
    msg.textContent = 'Código inválido';
    renderCart();
  }
}

async function sendToWhatsApp() {
  const entries = Object.entries(S.cart).filter(([, v]) => v.qty > 0);
  if (!entries.length) return showToast('El carrito está vacío');
  let msg = '¡Hola! Quiero hacer el siguiente pedido de *Shine Bijou*:\n\n';
  let subtotal = 0;
  entries.forEach(([id, v]) => {
    const p = S.products.find(x => x.id === parseInt(id));
    if (p) { msg += `• ${p.name}${v.variant ? ' (' + v.variant + ')' : ''} x${v.qty} – $${(p.price * v.qty).toLocaleString('es-AR')}\n`; subtotal += p.price * v.qty; }
  });
  if (S.appliedCoupon) {
    const save = Math.round(subtotal * (S.appliedCoupon.discount / 100));
    msg += `\n🏷️ Cupón ${S.appliedCoupon.code}: −$${save.toLocaleString('es-AR')}`;
    msg += `\n*Total: $${(subtotal - save).toLocaleString('es-AR')}*`;
  } else {
    msg += `\n*Total: $${subtotal.toLocaleString('es-AR')}*`;
  }
  const orderNum = String(S.pedidos.length + 1).padStart(3, '0');
  const newPedido = {
    order_id: `#${orderNum}`,
    items: entries.map(([id, v]) => { const p = S.products.find(x => x.id === parseInt(id)); return p ? `${p.name} x${v.qty}` : ''; }).join(', '),
    total: subtotal,
    date: new Date().toLocaleDateString('es-AR'),
    status: 'new'
  };
  try {
    const [saved] = await db.insert('pedidos', newPedido);
    S.pedidos.unshift(saved || newPedido);
  } catch (e) { S.pedidos.unshift(newPedido); }
  window.open(`https://wa.me/${WHATSAPP}?text=${encodeURIComponent(msg)}`, '_blank');
  showToast('Abriendo WhatsApp...');
}

// ══════════════════════════════════════
// ADMIN
// ══════════════════════════════════════
function showAdminLogin() {
  if (S.adminLogged) { showAdmin(); return; }
  document.getElementById('login-screen').style.display = 'flex';
}
function doLogin() {
  const u = document.getElementById('login-user').value;
  const p = document.getElementById('login-pass').value;
  if (u === ADMIN_USER && p === ADMIN_PASS) {
    S.adminLogged = true;
    document.getElementById('login-screen').style.display = 'none';
    showAdmin();
  } else { document.getElementById('login-error').style.display = 'block'; }
}
function logoutAdmin() { S.adminLogged = false; showStore(); }
function showStore() {
  document.getElementById('store-view').style.display = 'block';
  document.getElementById('admin-panel').style.display = 'none';
  renderNavCats(); renderProducts(); renderReviews();
}
function showAdmin() {
  document.getElementById('store-view').style.display = 'none';
  document.getElementById('admin-panel').style.display = 'block';
  renderAdminDashboard(); renderProductsTable(); renderCatsTable();
  renderStockTable(); renderPedidos(); renderCouponsTable();
  renderAdminCatSelect('np-cat');
}
function showAdminTab(tab, btn) {
  document.querySelectorAll('.admin-section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.admin-tab').forEach(b => b.classList.remove('active'));
  document.getElementById('tab-' + tab).classList.add('active');
  btn.classList.add('active');
}

function renderAdminDashboard() {
  document.getElementById('stats-grid').innerHTML = `
    <div class="stat-card"><div class="stat-value">${S.products.length}</div><div class="stat-label">Productos</div></div>
    <div class="stat-card"><div class="stat-value">${S.categories.length}</div><div class="stat-label">Categorías</div></div>
    <div class="stat-card"><div class="stat-value">${S.products.filter(p => p.stock === 0).length}</div><div class="stat-label">Sin stock</div></div>
    <div class="stat-card"><div class="stat-value">${S.pedidos.length}</div><div class="stat-label">Pedidos</div></div>`;
  const alerts = S.products.filter(p => p.stock <= 3);
  document.getElementById('low-stock-list').innerHTML = alerts.length
    ? alerts.map(p => `<div style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid #2a2a2a;font-size:12px"><span style="color:#c8c8c8">${p.name}</span><span class="stock-badge ${p.stock === 0 ? 'stock-out' : 'stock-low'}">${p.stock === 0 ? 'Sin stock' : p.stock}</span></div>`).join('')
    : `<div style="font-size:11px;color:#888;letter-spacing:2px">Todo con stock ✓</div>`;
}

function renderAdminCatSelect(id) {
  document.getElementById(id).innerHTML = S.categories.map(c => `<option value="${c}">${c}</option>`).join('');
}
function renderProductsTable() {
  document.getElementById('products-table').innerHTML = `
    <thead><tr><th>Nombre</th><th>Categoría</th><th>Precio</th><th>Stock</th><th>Dest.</th><th>Acciones</th></tr></thead>
    <tbody>${S.products.map(p => `<tr>
      <td style="color:#e8e8e8">${p.name}</td><td>${p.cat}</td>
      <td>$${p.price.toLocaleString('es-AR')}</td>
      <td><span class="stock-badge ${p.stock === 0 ? 'stock-out' : p.stock <= 3 ? 'stock-low' : 'stock-ok'}">${p.stock === 0 ? 'Sin stock' : p.stock <= 3 ? `Bajo (${p.stock})` : `OK (${p.stock})`}</span></td>
      <td>${p.featured ? `<span class="featured-dot"></span>` : ''}</td>
      <td style="display:flex;gap:7px"><button class="btn-edit" onclick="openEdit(${p.id})">Editar</button><button class="btn-danger" onclick="deleteProduct(${p.id})">Eliminar</button></td>
    </tr>`).join('')}</tbody>`;
}

async function addProduct() {
  const name = document.getElementById('np-name').value.trim();
  const cat = document.getElementById('np-cat').value;
  const price = parseInt(document.getElementById('np-price').value);
  const stock = parseInt(document.getElementById('np-stock').value) || 0;
  const description = document.getElementById('np-desc').value.trim();
  const img = document.getElementById('np-img').value.trim();
  const variants = document.getElementById('np-variants').value.split(',').map(v => v.trim()).filter(Boolean);
  const featured = document.getElementById('np-featured').checked;
  if (!name || !price) return showToast('Completá nombre y precio');
  showToast('Guardando...');
  try {
    const [saved] = await db.insert('products', { name, cat, price, stock, description, img, variants, featured });
    S.products.push({ ...saved, desc: saved.description });
    ['np-name', 'np-price', 'np-stock', 'np-desc', 'np-img', 'np-variants'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('np-featured').checked = false;
    document.getElementById('np-preview').innerHTML = '<span>Sin imagen</span>';
    renderProductsTable(); renderAdminDashboard(); renderStockTable();
    showToast('Producto guardado ✓');
  } catch (e) { showToast('Error guardando producto'); }
}

async function deleteProduct(id) {
  if (!confirm('¿Eliminar este producto?')) return;
  try {
    await db.delete('products', id);
    S.products = S.products.filter(p => p.id !== id);
    delete S.cart[id];
    updateCartCount();
    renderProductsTable(); renderAdminDashboard(); renderStockTable();
    showToast('Producto eliminado');
  } catch (e) { showToast('Error eliminando producto'); }
}

function openEdit(id) {
  const p = S.products.find(x => x.id === id);
  if (!p) return;
  document.getElementById('edit-id').value = p.id;
  document.getElementById('edit-name').value = p.name;
  document.getElementById('edit-price').value = p.price;
  document.getElementById('edit-desc').value = p.desc || '';
  document.getElementById('edit-img').value = p.img || '';
  document.getElementById('edit-variants').value = (p.variants || []).join(', ');
  document.getElementById('edit-featured').checked = !!p.featured;
  renderAdminCatSelect('edit-cat');
  document.getElementById('edit-cat').value = p.cat;
  previewImg(p.img || '', 'edit-preview');
  document.getElementById('edit-modal').classList.add('open');
}

async function saveEdit() {
  const id = parseInt(document.getElementById('edit-id').value);
  const p = S.products.find(x => x.id === id);
  if (!p) return;
  const data = {
    name: document.getElementById('edit-name').value.trim(),
    cat: document.getElementById('edit-cat').value,
    price: parseInt(document.getElementById('edit-price').value),
    description: document.getElementById('edit-desc').value.trim(),
    img: document.getElementById('edit-img').value.trim(),
    variants: document.getElementById('edit-variants').value.split(',').map(v => v.trim()).filter(Boolean),
    featured: document.getElementById('edit-featured').checked
  };
  try {
    await db.update('products', id, data);
    Object.assign(p, data, { desc: data.description });
    document.getElementById('edit-modal').classList.remove('open');
    renderProductsTable(); renderProducts(); renderStockTable();
    showToast('Producto actualizado ✓');
  } catch (e) { showToast('Error actualizando producto'); }
}

function renderCatsTable() {
  document.getElementById('cats-table').innerHTML = `
    <thead><tr><th>Nombre</th><th>Productos</th><th>Acción</th></tr></thead>
    <tbody>${S.categories.map(c => `<tr><td style="color:#e8e8e8">${c}</td><td>${S.products.filter(p => p.cat === c).length}</td><td><button class="btn-danger" onclick="deleteCategory('${c}')">Eliminar</button></td></tr>`).join('')}</tbody>`;
}
async function addCategory() {
  const name = document.getElementById('nc-name').value.trim();
  if (!name || S.categories.includes(name)) return showToast(name ? 'Ya existe' : '');
  try {
    await db.insert('categories', { name });
    S.categories.push(name);
    document.getElementById('nc-name').value = '';
    renderCatsTable(); renderNavCats(); renderAdminCatSelect('np-cat');
    showToast('Categoría creada ✓');
  } catch (e) { showToast('Error creando categoría'); }
}
async function deleteCategory(name) {
  if (S.products.some(p => p.cat === name)) return showToast('Hay productos en esta categoría');
  try {
    await db.deleteWhere('categories', 'name', name);
    S.categories = S.categories.filter(c => c !== name);
    renderCatsTable(); renderNavCats();
    showToast('Categoría eliminada');
  } catch (e) { showToast('Error eliminando categoría'); }
}

function renderStockTable() {
  document.getElementById('stock-table').innerHTML = `
    <thead><tr><th>Producto</th><th>Categoría</th><th>Stock</th><th>Ajustar</th></tr></thead>
    <tbody>${S.products.map(p => `<tr>
      <td style="color:#e8e8e8">${p.name}</td><td>${p.cat}</td>
      <td><span class="stock-badge ${p.stock === 0 ? 'stock-out' : p.stock <= 3 ? 'stock-low' : 'stock-ok'}">${p.stock}</span></td>
      <td style="display:flex;gap:7px;align-items:center">
        <button class="qty-btn" onclick="adjStock(${p.id},-1)">−</button>
        <span style="font-size:12px;min-width:22px;text-align:center">${p.stock}</span>
        <button class="qty-btn" onclick="adjStock(${p.id},1)">+</button>
        <input type="number" style="width:64px;background:#111;border:1px solid #2a2a2a;color:#f5f5f5;padding:5px 8px;font-size:11px;outline:none" placeholder="Set" id="si-${p.id}">
        <button class="btn-edit" onclick="setStk(${p.id})">Set</button>
      </td>
    </tr>`).join('')}</tbody>`;
}
async function adjStock(id, d) {
  const p = S.products.find(x => x.id === id);
  if (!p) return;
  const newStock = Math.max(0, p.stock + d);
  try { await db.update('products', id, { stock: newStock }); p.stock = newStock; renderStockTable(); renderAdminDashboard(); renderProducts(); }
  catch (e) { showToast('Error actualizando stock'); }
}
async function setStk(id) {
  const v = parseInt(document.getElementById(`si-${id}`).value);
  if (isNaN(v) || v < 0) return;
  const p = S.products.find(x => x.id === id);
  if (!p) return;
  try { await db.update('products', id, { stock: v }); p.stock = v; renderStockTable(); renderAdminDashboard(); renderProducts(); showToast('Stock actualizado ✓'); }
  catch (e) { showToast('Error actualizando stock'); }
}

function renderPedidos() {
  const el = document.getElementById('pedidos-list');
  if (!S.pedidos.length) {
    el.innerHTML = `<div style="font-size:14px;color:#888;font-style:italic;font-family:'Cormorant Garamond',serif;padding:40px 0">Aún no hay pedidos. Aparecen aquí cuando un cliente hace click en "Enviar por WhatsApp".</div>`;
    return;
  }
  el.innerHTML = S.pedidos.map(p => `
    <div class="pedido-card">
      <div class="pedido-header">
        <div style="display:flex;gap:12px;align-items:baseline"><div class="pedido-id">${p.order_id}</div><div class="pedido-date">${p.date}</div></div>
        <div style="display:flex;gap:10px;align-items:center">
          <span class="pedido-status ${p.status === 'new' ? 'status-new' : 'status-done'}">${p.status === 'new' ? 'Nuevo' : 'Completado'}</span>
          ${p.status === 'new' ? `<button class="btn-edit" onclick="markDone(${p.id})">Marcar completado</button>` : ''}
        </div>
      </div>
      <div class="pedido-items">${p.items}</div>
      <div class="pedido-total">$${p.total.toLocaleString('es-AR')}</div>
    </div>`).join('');
}
async function markDone(id) {
  try {
    await db.update('pedidos', id, { status: 'done' });
    const p = S.pedidos.find(x => x.id === id);
    if (p) p.status = 'done';
    renderPedidos(); showToast('Pedido completado ✓');
  } catch (e) { showToast('Error actualizando pedido'); }
}

function renderCouponsTable() {
  document.getElementById('coupons-table').innerHTML = `
    <thead><tr><th>Código</th><th>Descuento</th><th>Acción</th></tr></thead>
    <tbody>${S.coupons.map(c => `<tr><td style="color:#e8e8e8;letter-spacing:2px">${c.code}</td><td>${c.discount}%</td><td><button class="btn-danger" onclick="deleteCoupon(${c.id},'${c.code}')">Eliminar</button></td></tr>`).join('')}</tbody>`;
}
async function addCoupon() {
  const code = document.getElementById('nc-code').value.trim().toUpperCase();
  const disc = parseInt(document.getElementById('nc-disc').value);
  if (!code || !disc || disc < 1 || disc > 100) return showToast('Completá código y descuento válido');
  if (S.coupons.find(c => c.code === code)) return showToast('Ya existe ese código');
  try {
    const [saved] = await db.insert('coupons', { code, discount: disc });
    S.coupons.push(saved || { code, discount: disc });
    document.getElementById('nc-code').value = '';
    document.getElementById('nc-disc').value = '';
    renderCouponsTable(); showToast('Cupón creado ✓');
  } catch (e) { showToast('Error creando cupón'); }
}
async function deleteCoupon(id, code) {
  try {
    await db.delete('coupons', id);
    S.coupons = S.coupons.filter(c => c.code !== code);
    if (S.appliedCoupon && S.appliedCoupon.code === code) S.appliedCoupon = null;
    renderCouponsTable(); showToast('Cupón eliminado');
  } catch (e) { showToast('Error eliminando cupón'); }
}

function previewImg(url, id) {
  const el = document.getElementById(id);
  if (!url) { el.innerHTML = '<span>Sin imagen</span>'; return; }
  el.innerHTML = `<img src="${url}" onerror="this.parentElement.innerHTML='<span>URL inválida</span>'">`;
}
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2500);
}

// ARRANCAR
init();
