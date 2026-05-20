/* ===== 数据层 ===== */
const STORAGE_KEY = 'campus_express_orders';
const USER_KEY = 'campus_express_user';

function getOrders() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
  catch { return []; }
}
function saveOrders(orders) { localStorage.setItem(STORAGE_KEY, JSON.stringify(orders)); }

function getUser() {
  try { return JSON.parse(localStorage.getItem(USER_KEY)); }
  catch { return null; }
}
function saveUser(user) { localStorage.setItem(USER_KEY, JSON.stringify(user)); }

function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

function formatTime(ts) {
  const d = new Date(ts);
  const pad = n => String(n).padStart(2, '0');
  return `${d.getMonth()+1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/* ===== 用户 ===== */
function showLoginModal() { document.getElementById('loginModal').style.display = 'flex'; }
function hideLoginModal() { document.getElementById('loginModal').style.display = 'none'; }

function doLogin(e) {
  e.preventDefault();
  const name = document.getElementById('loginName').value.trim();
  const phone = document.getElementById('loginPhone').value.trim();
  if (!name || !phone) return;
  saveUser({ name, phone });
  refreshUserUI();
  hideLoginModal();
  toast(`欢迎，${name}！`);
}

function refreshUserUI() {
  const user = getUser();
  const el = document.getElementById('currentUser');
  const btn = document.getElementById('loginBtn');
  if (user) {
    el.textContent = user.name;
    btn.textContent = '退出';
    btn.onclick = doLogout;
    btn.className = 'btn btn-sm btn-outline';
  } else {
    el.textContent = '未登录';
    btn.textContent = '登录';
    btn.onclick = showLoginModal;
    btn.className = 'btn btn-sm btn-outline';
  }
}

function doLogout() {
  localStorage.removeItem(USER_KEY);
  refreshUserUI();
  toast('已退出登录');
}

function requireLogin() {
  if (!getUser()) { toast('请先登录'); showLoginModal(); return false; }
  return true;
}

/* ===== Toast ===== */
function toast(msg) {
  const el = document.createElement('div');
  el.className = 'toast'; el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2200);
}

/* ===== Tab ===== */
function switchTab(name) {
  document.querySelectorAll('.tab-content').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.getElementById('tab-' + name).classList.add('active');
  document.querySelector(`.tab[data-tab="${name}"]`).classList.add('active');
  if (name === 'list') renderOrderList();
  if (name === 'myorders') renderMyOrders();
}

let currentSubTab = 'published';
function switchSubTab(name) {
  currentSubTab = name;
  document.querySelectorAll('.sub-tab').forEach(t => t.classList.remove('active'));
  document.querySelector(`.sub-tab[data-sub="${name}"]`).classList.add('active');
  renderMyOrders();
}

/* ===== 发布订单 ===== */
function postOrder(e) {
  e.preventDefault();
  if (!requireLogin()) return;
  const user = getUser();
  const size = document.querySelector('input[name="size"]:checked').value;
  const order = {
    id: genId(),
    publisher: user.name,
    publisherPhone: user.phone,
    company: document.getElementById('expressCompany').value,
    pickupCode: document.getElementById('pickupCode').value.trim(),
    size,
    pickupLocation: document.getElementById('pickupLocation').value,
    deliverAddress: document.getElementById('deliverAddress').value.trim(),
    reward: parseFloat(document.getElementById('reward').value),
    remark: document.getElementById('remark').value.trim(),
    status: 'pending',        // pending → accepted → delivered → confirmed / cancelled
    createdAt: Date.now(),
    acceptedAt: null,
    deliveredAt: null,
    confirmedAt: null,
    cancelledAt: null,
    acceptor: null,
    acceptorPhone: null,
    timeline: [{ action: '发布订单', time: Date.now(), by: user.name }]
  };
  const orders = getOrders();
  orders.unshift(order);
  saveOrders(orders);
  document.getElementById('postForm').reset();
  toast('订单发布成功！');
  switchTab('myorders');
}

/* ===== 渲染订单列表 ===== */
function renderOrderList() {
  const loc = document.getElementById('filterLocation').value;
  const sz = document.getElementById('filterSize').value;
  const sort = document.getElementById('filterSort').value;

  let orders = getOrders().filter(o => o.status === 'pending');
  if (loc) orders = orders.filter(o => o.pickupLocation === loc);
  if (sz) orders = orders.filter(o => o.size === sz);
  if (sort === 'reward-high') orders.sort((a, b) => b.reward - a.reward);
  else if (sort === 'reward-low') orders.sort((a, b) => a.reward - b.reward);
  else orders.sort((a, b) => b.createdAt - a.createdAt);

  const container = document.getElementById('orderList');
  const empty = document.getElementById('emptyList');
  if (!orders.length) { container.innerHTML = ''; empty.style.display = ''; return; }
  empty.style.display = 'none';

  const user = getUser();
  container.innerHTML = orders.map(o => `
    <div class="order-card" onclick="showDetail('${o.id}')">
      <div class="order-header">
        <span class="order-company">${o.company}</span>
        <span class="order-reward">¥${o.reward.toFixed(1)}</span>
      </div>
      <div class="order-info">
        <span>📦 ${o.size}</span>
        <span>📍 ${o.pickupLocation}</span>
        <span>🏠 ${o.deliverAddress}</span>
      </div>
      <div class="order-footer">
        <span class="order-time">${formatTime(o.createdAt)}</span>
        ${user && user.name !== o.publisher
          ? `<button class="btn btn-accept btn-sm" onclick="event.stopPropagation();acceptOrder('${o.id}')">接单</button>`
          : ''}
      </div>
    </div>
  `).join('');
}

/* ===== 接单 ===== */
function acceptOrder(id) {
  if (!requireLogin()) return;
  const user = getUser();
  const orders = getOrders();
  const o = orders.find(x => x.id === id);
  if (!o || o.status !== 'pending') { toast('订单状态已变更'); return; }
  if (o.publisher === user.name) { toast('不能接自己发布的单'); return; }
  o.status = 'accepted';
  o.acceptor = user.name;
  o.acceptorPhone = user.phone;
  o.acceptedAt = Date.now();
  o.timeline.push({ action: '接单', time: Date.now(), by: user.name });
  saveOrders(orders);
  toast('接单成功！');
  renderOrderList();
}

/* ===== 我的订单 ===== */
function renderMyOrders() {
  const user = getUser();
  const container = document.getElementById('myOrderList');
  const empty = document.getElementById('emptyMyOrder');
  if (!user) { container.innerHTML = ''; empty.style.display = ''; return; }

  const all = getOrders();
  let orders;
  if (currentSubTab === 'published') {
    orders = all.filter(o => o.publisher === user.name);
  } else {
    orders = all.filter(o => o.acceptor === user.name);
  }
  orders.sort((a, b) => b.createdAt - a.createdAt);

  if (!orders.length) { container.innerHTML = ''; empty.style.display = ''; return; }
  empty.style.display = 'none';

  container.innerHTML = orders.map(o => `
    <div class="order-card" onclick="showDetail('${o.id}')" style="border-left-color:${statusColor(o.status)}">
      <div class="order-header">
        <span class="order-company">${o.company}</span>
        <span class="status-tag status-${o.status}">${statusText(o.status)}</span>
      </div>
      <div class="order-info">
        <span>📦 ${o.size}</span>
        <span>📍 ${o.pickupLocation}</span>
        <span>💰 ¥${o.reward.toFixed(1)}</span>
      </div>
      <div class="order-footer">
        <span class="order-time">${formatTime(o.createdAt)}</span>
        ${actionBtn(o)}
      </div>
    </div>
  `).join('');
}

function statusText(s) {
  return { pending:'待接单', accepted:'已接单', delivered:'已送达', confirmed:'已完成', cancelled:'已取消' }[s] || s;
}
function statusColor(s) {
  return { pending:'#f59e0b', accepted:'#3b82f6', delivered:'#22c55e', confirmed:'#94a3b8', cancelled:'#cbd5e1' }[s] || '#3b82f6';
}

function actionBtn(o) {
  const user = getUser();
  if (!user) return '';
  // 发布者操作
  if (o.publisher === user.name) {
    if (o.status === 'delivered') return `<button class="btn btn-confirm btn-sm" onclick="event.stopPropagation();confirmOrder('${o.id}')">确认收货</button>`;
    if (o.status === 'pending') return `<button class="btn btn-cancel btn-sm" onclick="event.stopPropagation();cancelOrder('${o.id}')">取消</button>`;
  }
  // 接单者操作
  if (o.acceptor === user.name) {
    if (o.status === 'accepted') return `<button class="btn btn-complete btn-sm" onclick="event.stopPropagation();deliverOrder('${o.id}')">确认送达</button>`;
  }
  return '';
}

/* ===== 订单流转 ===== */
function deliverOrder(id) {
  const orders = getOrders();
  const o = orders.find(x => x.id === id);
  if (!o || o.status !== 'accepted') return;
  o.status = 'delivered';
  o.deliveredAt = Date.now();
  o.timeline.push({ action: '确认送达', time: Date.now(), by: o.acceptor });
  saveOrders(orders);
  toast('已确认送达！');
  renderMyOrders();
}

function confirmOrder(id) {
  const orders = getOrders();
  const o = orders.find(x => x.id === id);
  if (!o || o.status !== 'delivered') return;
  o.status = 'confirmed';
  o.confirmedAt = Date.now();
  o.timeline.push({ action: '确认收货', time: Date.now(), by: o.publisher });
  saveOrders(orders);
  toast('订单已完成！');
  renderMyOrders();
}

function cancelOrder(id) {
  const orders = getOrders();
  const o = orders.find(x => x.id === id);
  if (!o || o.status !== 'pending') return;
  o.status = 'cancelled';
  o.cancelledAt = Date.now();
  o.timeline.push({ action: '取消订单', time: Date.now(), by: o.publisher });
  saveOrders(orders);
  toast('订单已取消');
  renderMyOrders();
}

/* ===== 订单详情 ===== */
function showDetail(id) {
  const o = getOrders().find(x => x.id === id);
  if (!o) return;
  const user = getUser();

  let actions = '';
  if (user) {
    if (o.publisher === user.name) {
      if (o.status === 'delivered') actions += `<button class="btn btn-confirm" onclick="confirmOrder('${o.id}');hideDetailModal();renderMyOrders();">确认收货</button>`;
      if (o.status === 'pending') actions += `<button class="btn btn-cancel" onclick="cancelOrder('${o.id}');hideDetailModal();renderMyOrders();">取消订单</button>`;
    }
    if (o.acceptor === user.name && o.status === 'accepted') {
      actions += `<button class="btn btn-complete" onclick="deliverOrder('${o.id}');hideDetailModal();renderMyOrders();">确认送达</button>`;
    }
    if (o.status === 'pending' && user.name !== o.publisher) {
      actions += `<button class="btn btn-accept" onclick="acceptOrder('${o.id}');hideDetailModal();renderOrderList();">接单</button>`;
    }
  }

  const timeline = o.timeline.map((t, i) =>
    `<div class="timeline-item ${i === o.timeline.length - 1 ? 'active' : ''}">
      <strong>${t.action}</strong> · ${t.by} · ${formatTime(t.time)}
    </div>`
  ).join('');

  document.getElementById('detailBody').innerHTML = `
    <h2 style="margin-bottom:16px">订单详情</h2>
    <div class="detail-row"><span class="detail-label">快递公司</span><span class="detail-value">${o.company}</span></div>
    <div class="detail-row"><span class="detail-label">取件码</span><span class="detail-value">${o.pickupCode}</span></div>
    <div class="detail-row"><span class="detail-label">大小</span><span class="detail-value">${o.size}</span></div>
    <div class="detail-row"><span class="detail-label">取件地点</span><span class="detail-value">${o.pickupLocation}</span></div>
    <div class="detail-row"><span class="detail-label">送达地址</span><span class="detail-value">${o.deliverAddress}</span></div>
    <div class="detail-row"><span class="detail-label">悬赏</span><span class="detail-value" style="color:var(--blue-600);font-weight:700">¥${o.reward.toFixed(1)}</span></div>
    <div class="detail-row"><span class="detail-label">备注</span><span class="detail-value">${o.remark || '无'}</span></div>
    <div class="detail-row"><span class="detail-label">发布者</span><span class="detail-value">${o.publisher}${o.status !== 'pending' ? ' · ' + o.publisherPhone : ''}</span></div>
    ${o.acceptor ? `<div class="detail-row"><span class="detail-label">接单者</span><span class="detail-value">${o.acceptor} · ${o.acceptorPhone}</span></div>` : ''}
    <div class="detail-row"><span class="detail-label">状态</span><span class="detail-value"><span class="status-tag status-${o.status}">${statusText(o.status)}</span></span></div>

    <h3 style="font-size:15px;color:var(--blue-800);margin-top:20px;margin-bottom:8px">流转记录</h3>
    <div class="detail-timeline">${timeline}</div>

    ${actions ? `<div class="detail-actions">${actions}</div>` : ''}
  `;
  document.getElementById('detailModal').style.display = 'flex';
}

function hideDetailModal() { document.getElementById('detailModal').style.display = 'none'; }

/* ===== 初始化 ===== */
refreshUserUI();
renderOrderList();
