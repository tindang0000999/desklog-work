(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const config = window.DESKLOG_CONFIG || {};
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(config.url || '') || !/^sb_publishable_[A-Za-z0-9_-]+$/.test(config.publishableKey || '') || !window.supabase?.createClient) {
    $('setupNotice').hidden = false;
    return;
  }
  const client = window.supabase.createClient(config.url, config.publishableKey);
  let sessionUser = null;
  let rows = [];
  let editingId = null;
  const fields = ['work_date', 'person_name', 'site', 'unit', 'category', 'title', 'notes', 'status'];
  const showError = (message) => { $('errorNotice').textContent = message; $('errorNotice').hidden = !message; };
  function showAuth(user) {
    sessionUser = user;
    $('loginPanel').hidden = Boolean(user);
    $('dashboard').hidden = !user;
    $('signout').hidden = !user;
    $('identity').textContent = user?.email || '';
    showError('');
    if (!user) { rows = []; render(); }
  }
  async function load() {
    if (!sessionUser) return;
    const { data, error } = await client.from('work_items').select('id,owner_id,work_date,person_name,site,unit,category,title,notes,status,created_at').order('work_date', { ascending: false }).limit(2000);
    if (error) { console.error('Load error:', error); showError('Lỗi tải: ' + (error.message || error.details || JSON.stringify(error))); return; }
    rows = data || [];
    render();
  }
  function filtered() {
    const q = $('search').value.trim().toLocaleLowerCase('vi');
    return rows.filter(item =>
      (!$('siteFilter').value || item.site === $('siteFilter').value) &&
      (!$('categoryFilter').value || item.category === $('categoryFilter').value) &&
      (!$('statusFilter').value || item.status === $('statusFilter').value) &&
      (!q || [item.title, item.notes, item.person_name, item.unit].join(' ').toLocaleLowerCase('vi').includes(q))
    );
  }
  function render() {
    const list = filtered(), n = list.length, done = list.filter(x => x.status === 'Hoàn thành').length;
    const hard = list.filter(x => x.category === 'Phần cứng').length;
    $('count').textContent = n;
    $('done').textContent = done;
    $('progress').textContent = list.filter(x => x.status === 'Đang xử lý').length;
    $('sites').textContent = new Set(list.map(x => x.site)).size;
    $('hard').textContent = hard;
    $('soft').textContent = n - hard;
    $('ring').dataset.total = n;
    $('ring').style.setProperty('--pct', `${n ? hard/n*100 : 0}%`);
    $('resultCount').textContent = `${n} mục`;
    const max = Math.max(1, ...['DBP','120HB','D2'].map(site => list.filter(x => x.site === site).length));
    $('siteChart').innerHTML = ['DBP','120HB','D2'].map((site,i) => {
      const value = list.filter(x => x.site === site).length;
      return `<div class="barrow"><span>${site}</span><div class="track"><div class="fill ${i===1?'gold':i===2?'blue':''}" style="width:${value/max*100}%"></div></div><b>${value}</b></div>`;
    }).join('');
    $('items').innerHTML = list.map(item => {
      const [y,m,d] = item.work_date.split('-');
      const statusClass = item.status === 'Hoàn thành' ? 'done' : item.status === 'Đang xử lý' ? 'progress' : 'new';
      return `<tr><td>${d}/${m}/${y}</td><td>${escapeHtml(item.person_name || 'Chưa ghi họ tên')}</td><td>${escapeHtml(item.unit)}</td><td><b>${escapeHtml(item.site)}</b></td><td><span class="tag ${item.category === 'Phần mềm' ? 'soft' : ''}">${escapeHtml(item.category)}</span></td><td><b>${escapeHtml(item.title)}</b><small>${escapeHtml(item.notes)}</small></td><td class="status ${statusClass}">${escapeHtml(item.status)}</td><td><div class="actions"><button type="button" data-edit="${item.id}" aria-label="Sửa">✎</button><button type="button" data-delete="${item.id}" aria-label="Xóa">×</button></div></td></tr>`;
    }).join('');
    $('empty').hidden = n > 0;
  }
  function openEditor(item) {
    editingId = item?.id || null;
    const form = $('itemForm');
    form.reset();
    const unitSelect = form.elements.unit;
    unitSelect.querySelectorAll('[data-legacy-option]').forEach(option => option.remove());
    if (item?.unit && !Array.from(unitSelect.options).some(option => option.value === item.unit)) {
      const option = new Option(`${item.unit} (đơn vị cũ)`, item.unit);
      option.dataset.legacyOption = 'true';
      unitSelect.add(option);
    }
    form.elements.work_date.value = item?.work_date || new Date().toLocaleDateString('en-CA');
    if (item) for (const key of fields.filter(x => x !== 'work_date')) form.elements[key].value = item[key] ?? '';
    $('editorTitle').textContent = item ? 'Sửa công việc' : 'Ghi công việc';
    $('formError').textContent = '';
    $('editor').showModal();
  }
  $('loginForm').addEventListener('submit', async event => {
    event.preventDefault();
    $('loginError').textContent = '';
    const email = event.target.elements.email.value.trim();
    const password = event.target.elements.password.value;
    const { error } = await client.auth.signInWithPassword({ email, password });
    event.target.elements.password.value = '';
    if (error) $('loginError').textContent = 'Đăng nhập chưa thành công. Kiểm tra email, mật khẩu hoặc xác nhận email.';
  });
  $('signout').onclick = async () => { await client.auth.signOut(); };
  $('add').onclick = () => openEditor();
  $('closeEditor').onclick = () => $('editor').close();
  $('itemForm').addEventListener('submit', async event => {
    event.preventDefault();
    if (!sessionUser) {
      $('formError').textContent = 'Phiên đăng nhập hết hạn. Vui lòng tải lại trang và đăng nhập lại.';
      return;
    }
    $('formError').textContent = '';
    const values = Object.fromEntries(new FormData(event.target));
    
    // Normalize fields
    const person = (values.requester_name || values.person_name || '').trim();
    values.person_name = person;
    values.requester_name = person;
    values.target_role = (values.target_role || 'Nhân viên').trim();
    values.title = (values.title || '').trim();
    values.notes = (values.notes || '').trim();

    if (!person || !values.title || !values.site || !values.unit || !values.category) {
      $('formError').textContent = 'Vui lòng điền đầy đủ các mục bắt buộc.';
      return;
    }

    const saveBtn = event.target.querySelector('button[type="submit"]');
    if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Đang lưu...'; }

    try {
      const payload = { ...values, owner_id: sessionUser.id };
      const query = editingId ? client.from('work_items').update(payload).eq('id', editingId) : client.from('work_items').insert(payload);
      const { data, error } = await query;
      if (error) {
        console.error('Save error:', error);
        $('formError').textContent = 'Lỗi lưu: ' + (error.message || JSON.stringify(error));
        return;
      }
      $('editor').close();
      await load();
    } catch (err) {
      console.error('Save exception:', err);
      $('formError').textContent = 'Lỗi hệ thống: ' + err.message;
    } finally {
      if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Lưu công việc'; }
    }
  });
  $('items').addEventListener('click', async event => {
    const edit = event.target.closest('[data-edit]');
    const del = event.target.closest('[data-delete]');
    if (edit) openEditor(rows.find(x => x.id === edit.dataset.edit));
    if (del && sessionUser && confirm('Xóa công việc này?')) {
      const { error } = await client.from('work_items').delete().eq('id', del.dataset.delete).eq('owner_id', sessionUser.id);
      if (error) showError('Không thể xóa. Kiểm tra quyền tài khoản.'); else await load();
    }
  });
  for (const id of ['search', 'siteFilter', 'categoryFilter', 'statusFilter']) $(id).addEventListener(id === 'search' ? 'input' : 'change', render);
  client.auth.onAuthStateChange((_event, session) => {
    showAuth(session?.user || null);
    if (session?.user) void load();
  });
  client.auth.getSession().then(({ data, error }) => {
    if (error) showError('Không thể kiểm tra phiên đăng nhập.');
    else { showAuth(data.session?.user || null); if (data.session?.user) void load(); }
  });
})();
