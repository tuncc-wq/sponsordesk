// ============================================================
// SUPABASE CONFIG — replace these two values after you set up
// your Supabase project (instructions in README.md)
// ============================================================
const SUPABASE_URL = 'https://hzzwncxttglzzlzppbwt.supabase.com';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6enduY3h0dGdsenpsenBwYnd0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0Njg2MzIsImV4cCI6MjA5MjA0NDYzMn0.6Cofr8bg4L-hN8uW8Uji-0-JXJIGryEx-cmbt9HoXJM';

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ============================================================
// STATE
// ============================================================
let deals = [];
let currentFilter = 'all';
let editingId = null;
let detailId = null;
let isSignUp = false;
let currentUser = null;

// ============================================================
// AUTH
// ============================================================
async function init() {
  const { data: { session } } = await sb.auth.getSession();
  if (session) {
    currentUser = session.user;
    await showApp();
  } else {
    showAuth();
  }

  sb.auth.onAuthStateChange(async (_event, session) => {
    if (session) {
      currentUser = session.user;
      await showApp();
    } else {
      currentUser = null;
      showAuth();
    }
  });
}

function showAuth() {
  document.getElementById('auth-screen').style.display = 'flex';
  document.getElementById('app-shell').style.display = 'none';
}

async function showApp() {
  document.getElementById('auth-screen').style.display = 'none';
  document.getElementById('app-shell').style.display = 'grid';
  const name = currentUser.user_metadata?.channel_name || currentUser.email.split('@')[0];
  document.getElementById('sidebar-name').textContent = name;
  document.getElementById('sidebar-avatar').textContent = name.slice(0,2).toUpperCase();
  setGreeting();
  await loadDeals();
  render();
}

async function handleAuth() {
  const email = document.getElementById('auth-email').value.trim();
  const password = document.getElementById('auth-password').value;
  const errEl = document.getElementById('auth-error');
  errEl.textContent = '';

  if (!email || !password) { errEl.textContent = 'Please fill in all fields.'; return; }

  if (isSignUp) {
    const name = document.getElementById('auth-name').value.trim();
    const { error } = await sb.auth.signUp({
      email, password,
      options: { data: { channel_name: name || email.split('@')[0] } }
    });
    if (error) { errEl.textContent = error.message; }
    else { errEl.style.color = 'var(--accent)'; errEl.textContent = 'Check your email to confirm your account!'; }
  } else {
    const { error } = await sb.auth.signInWithPassword({ email, password });
    if (error) { errEl.textContent = error.message; }
  }
}

function toggleAuthMode() {
  isSignUp = !isSignUp;
  const nameField = document.getElementById('auth-name');
  const btn = document.getElementById('auth-submit-btn');
  const toggle = document.querySelector('.auth-toggle');
  nameField.style.display = isSignUp ? 'block' : 'none';
  btn.textContent = isSignUp ? 'Create account' : 'Sign in';
  toggle.innerHTML = isSignUp
    ? 'Already have an account? <span onclick="toggleAuthMode()">Sign in</span>'
    : "Don't have an account? <span onclick=\"toggleAuthMode()\">Sign up</span>";
}

async function signOut() {
  await sb.auth.signOut();
}

// ============================================================
// DATA — SUPABASE CRUD
// ============================================================
async function loadDeals() {
  const { data, error } = await sb
    .from('deals')
    .select('*')
    .eq('user_id', currentUser.id)
    .order('created_at', { ascending: false });
  if (!error) deals = data || [];
}

async function saveDeal() {
  const brand = document.getElementById('f-brand').value.trim();
  if (!brand) { alert('Brand name is required'); return; }

  const payload = {
    user_id: currentUser.id,
    brand,
    category: document.getElementById('f-category').value.trim() || 'Other',
    amount: parseFloat(document.getElementById('f-amount').value) || 0,
    status: document.getElementById('f-status').value,
    email: document.getElementById('f-email').value.trim(),
    followup: document.getElementById('f-followup').value || null,
    notes: document.getElementById('f-notes').value.trim(),
  };

  if (editingId) {
    const { error } = await sb.from('deals').update(payload).eq('id', editingId);
    if (error) { alert('Error saving: ' + error.message); return; }
  } else {
    const { error } = await sb.from('deals').insert(payload);
    if (error) { alert('Error saving: ' + error.message); return; }
  }

  closeModal();
  await loadDeals();
  render();
}

async function deleteDeal(id) {
  if (!confirm('Delete this deal?')) return;
  await sb.from('deals').delete().eq('id', id);
  closeDetail();
  await loadDeals();
  render();
}

// ============================================================
// RENDER
// ============================================================
function render() {
  renderStats();
  renderRecentDeals();
  renderUpcoming();
  renderAllDeals();
  renderPipeline();
}

function setGreeting() {
  const h = new Date().getHours();
  const g = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  const name = currentUser.user_metadata?.channel_name || '';
  document.getElementById('greeting').textContent = name ? `${g}, ${name}` : g;
}

function renderStats() {
  const total = deals.length;
  const active = deals.filter(d => !['Paid','Declined'].includes(d.status)).length;
  const earned = deals.filter(d => d.status === 'Paid').reduce((s,d) => s + Number(d.amount||0), 0);
  const pipeline = deals.filter(d => !['Paid','Declined'].includes(d.status)).reduce((s,d) => s + Number(d.amount||0), 0);

  document.getElementById('stats-grid').innerHTML = `
    <div class="stat-card">
      <div class="stat-label">Total deals</div>
      <div class="stat-value">${total}</div>
      <div class="stat-change">All time</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Active</div>
      <div class="stat-value">${active}</div>
      <div class="stat-change">In progress</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Earned</div>
      <div class="stat-value green">$${earned.toLocaleString()}</div>
      <div class="stat-change">Paid deals</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Pipeline</div>
      <div class="stat-value">$${pipeline.toLocaleString()}</div>
      <div class="stat-change">Potential value</div>
    </div>
  `;
}

function badgeClass(s) {
  return { Outreach:'badge-outreach', Negotiating:'badge-negotiating', Signed:'badge-signed',
    Delivered:'badge-delivered', Paid:'badge-paid', Declined:'badge-declined' }[s] || 'badge-outreach';
}

function fmt(d) {
  if (!d) return '—';
  const [y,m,day] = d.split('-');
  return `${day}/${m}/${y}`;
}

function fmtAmt(a) {
  if (!a && a !== 0) return '—';
  return '$' + Number(a).toLocaleString();
}

function tableHeader() {
  return `<div class="table-header">
    <span>Brand</span><span>Amount</span><span>Follow-up</span><span>Status</span><span>Actions</span>
  </div>`;
}

function dealRowHTML(d) {
  return `<div class="deal-row" onclick="openDetail('${d.id}')">
    <div class="brand-cell">
      <span class="brand-name">${d.brand}</span>
      <span class="brand-cat">${d.category}</span>
    </div>
    <div class="deal-amount">${fmtAmt(d.amount)}</div>
    <div class="deal-date">${fmt(d.followup)}</div>
    <div><span class="badge ${badgeClass(d.status)}">${d.status}</span></div>
    <div class="deal-actions" onclick="event.stopPropagation()">
      <button class="action-sm" onclick="openEditModal('${d.id}')">Edit</button>
    </div>
  </div>`;
}

function renderRecentDeals() {
  const recent = deals.slice(0, 5);
  const el = document.getElementById('recent-deals');
  if (!recent.length) {
    el.innerHTML = '<div class="empty-state"><div class="empty-icon">◇</div>No deals yet. Add your first sponsorship!</div>';
    return;
  }
  el.innerHTML = tableHeader() + recent.map(dealRowHTML).join('');
}

function renderUpcoming() {
  const today = new Date();
  const weekEnd = new Date(today); weekEnd.setDate(today.getDate() + 7);
  const upcoming = deals.filter(d => {
    if (!d.followup) return false;
    const fd = new Date(d.followup);
    return fd >= today && fd <= weekEnd;
  }).sort((a,b) => new Date(a.followup) - new Date(b.followup));

  const el = document.getElementById('upcoming-list');
  if (!upcoming.length) {
    el.innerHTML = '<div style="color:var(--text3);font-size:12px;padding:1rem 0;">No follow-ups this week.</div>';
    return;
  }
  el.innerHTML = upcoming.map(d => `
    <div class="followup-item" onclick="openDetail('${d.id}')" style="cursor:pointer;">
      <div>
        <div class="followup-brand">${d.brand}</div>
        <div class="followup-note">${d.notes ? d.notes.slice(0,60) + (d.notes.length > 60 ? '...' : '') : d.category}</div>
      </div>
      <div class="followup-date">${fmt(d.followup)}</div>
    </div>
  `).join('');
}

function renderAllDeals() {
  const filtered = currentFilter === 'all' ? deals : deals.filter(d => d.status === currentFilter);
  document.getElementById('deals-count').textContent = `${filtered.length} deal${filtered.length !== 1 ? 's' : ''}`;
  const el = document.getElementById('all-deals-table');
  if (!filtered.length) {
    el.innerHTML = '<div class="empty-state"><div class="empty-icon">◇</div>No deals match this filter.</div>';
    return;
  }
  el.innerHTML = tableHeader() + filtered.map(dealRowHTML).join('');
}

function renderPipeline() {
  const stages = ['Outreach','Negotiating','Signed','Delivered','Paid'];
  document.getElementById('pipeline-board').innerHTML = stages.map(stage => {
    const cards = deals.filter(d => d.status === stage);
    const total = cards.reduce((s,d) => s + Number(d.amount||0), 0);
    return `<div class="pipeline-col">
      <div class="pipeline-col-header">
        <span class="pipeline-col-title">${stage}</span>
        <span class="pipeline-col-count">${cards.length}</span>
      </div>
      ${cards.map(d => `
        <div class="pipeline-card" onclick="openDetail('${d.id}')">
          <div class="pipeline-brand">${d.brand}</div>
          <div class="pipeline-amount">${fmtAmt(d.amount)}</div>
          ${d.followup ? `<div class="pipeline-followup">↻ ${fmt(d.followup)}</div>` : ''}
        </div>
      `).join('')}
      ${cards.length ? `<div class="pipeline-total">$${total.toLocaleString()} total</div>` : ''}
    </div>`;
  }).join('');
}

// ============================================================
// NAV
// ============================================================
function switchView(name) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('view-' + name).classList.add('active');
  event.currentTarget.classList.add('active');
}

function filterDeals(val) {
  currentFilter = val;
  renderAllDeals();
}

// ============================================================
// ADD / EDIT MODAL
// ============================================================
function openModal() {
  editingId = null;
  document.getElementById('modal-heading').textContent = 'New deal';
  ['f-brand','f-category','f-amount','f-email','f-followup','f-notes'].forEach(id => {
    document.getElementById(id).value = '';
  });
  document.getElementById('f-status').value = 'Outreach';
  document.getElementById('modal-overlay').classList.add('open');
}

function openEditModal(id) {
  editingId = id;
  const d = deals.find(x => String(x.id) === String(id));
  if (!d) return;
  document.getElementById('modal-heading').textContent = 'Edit deal';
  document.getElementById('f-brand').value = d.brand;
  document.getElementById('f-category').value = d.category;
  document.getElementById('f-amount').value = d.amount;
  document.getElementById('f-status').value = d.status;
  document.getElementById('f-email').value = d.email || '';
  document.getElementById('f-followup').value = d.followup || '';
  document.getElementById('f-notes').value = d.notes || '';
  document.getElementById('modal-overlay').classList.add('open');
}

function closeModal() { document.getElementById('modal-overlay').classList.remove('open'); }
function closeModalOutside(e) { if (e.target === document.getElementById('modal-overlay')) closeModal(); }

// ============================================================
// DETAIL MODAL
// ============================================================
function openDetail(id) {
  detailId = id;
  const d = deals.find(x => String(x.id) === String(id));
  if (!d) return;
  document.getElementById('d-brand').textContent = d.brand;
  document.getElementById('d-body').innerHTML = `
    <div class="detail-section">
      <div class="detail-section-title">Deal info</div>
      <div class="detail-grid">
        <div class="detail-item">
          <div class="detail-item-label">Amount</div>
          <div class="detail-item-value" style="color:var(--accent)">${fmtAmt(d.amount)}</div>
        </div>
        <div class="detail-item">
          <div class="detail-item-label">Status</div>
          <div class="detail-item-value"><span class="badge ${badgeClass(d.status)}">${d.status}</span></div>
        </div>
        <div class="detail-item">
          <div class="detail-item-label">Category</div>
          <div class="detail-item-value">${d.category}</div>
        </div>
        <div class="detail-item">
          <div class="detail-item-label">Follow-up</div>
          <div class="detail-item-value">${fmt(d.followup)}</div>
        </div>
      </div>
    </div>
    ${d.email ? `<div class="detail-section">
      <div class="detail-section-title">Contact</div>
      <div class="detail-item"><div class="detail-item-label">Email</div><div class="detail-item-value">${d.email}</div></div>
    </div>` : ''}
    ${d.notes ? `<div class="detail-notes">${d.notes}</div>` : ''}
  `;
  document.getElementById('detail-overlay').classList.add('open');
}

function closeDetail() { document.getElementById('detail-overlay').classList.remove('open'); }
function closeDetailOutside(e) { if (e.target === document.getElementById('detail-overlay')) closeDetail(); }
function editFromDetail() { closeDetail(); openEditModal(detailId); }
function deleteFromDetail() { deleteDeal(detailId); }

// ============================================================
// BOOT
// ============================================================
init();
