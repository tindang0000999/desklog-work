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
  let selectedIds = new Set();
  let currentRoleTab = '';
  let replyingItem = null;
  const ZALO_AUTH_TEMPLATE = "Bạn có thể vào tài khoản xác thực được rồi. Xem video xác thực nhé. Bạn không cần xác thực thêm phương thức số điện thoại. https://youtu.be/UITCdK_jOXM";
  const fields = ['work_date', 'target_role', 'person_name', 'site', 'unit', 'category', 'title', 'notes', 'status'];
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
    const { data, error } = await client.from('work_items').select('id,owner_id,work_date,person_name,target_role,site,unit,category,title,notes,status,created_at').order('work_date', { ascending: false }).limit(2000);
    if (error) { console.error('Load error:', error); showError('Lỗi tải: ' + (error.message || error.details || JSON.stringify(error))); return; }
    rows = data || [];
    render();
  }
  function getDateRange() {
    const preset = $('datePreset')?.value;
    const now = new Date();
    const fmt = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    
    if (preset === 'today') {
      const today = fmt(now);
      return { start: today, end: today };
    }
    if (preset === 'yesterday') {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      const yStr = fmt(y);
      return { start: yStr, end: yStr };
    }
    if (preset === '7days') {
      const past = new Date(now);
      past.setDate(past.getDate() - 6);
      return { start: fmt(past), end: fmt(now) };
    }
    if (preset === '30days') {
      const past = new Date(now);
      past.setDate(past.getDate() - 29);
      return { start: fmt(past), end: fmt(now) };
    }
    if (preset === 'this_month') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      return { start: fmt(start), end: fmt(end) };
    }
    if (preset === 'last_month') {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0);
      return { start: fmt(start), end: fmt(end) };
    }
    if (preset === 'custom') {
      return {
        start: $('startDate')?.value || null,
        end: $('endDate')?.value || null
      };
    }
    return { start: null, end: null };
  }

  function extractThreadId(notes) {
    const m = String(notes || '').match(/thread=([^\s;]+)/);
    return m ? m[1] : '';
  }

  function filtered() {
    const q = $('search').value.trim().toLocaleLowerCase('vi');
    const roleVal = currentRoleTab || $('roleFilter')?.value;
    const dateRange = getDateRange();

    return rows.filter(item => {
      if (roleVal && item.target_role !== roleVal) return false;
      if ($('siteFilter').value && item.site !== $('siteFilter').value) return false;
      if ($('categoryFilter').value && item.category !== $('categoryFilter').value) return false;
      if ($('statusFilter').value && item.status !== $('statusFilter').value) return false;
      
      if (dateRange.start && item.work_date < dateRange.start) return false;
      if (dateRange.end && item.work_date > dateRange.end) return false;

      if (q) {
        const text = [item.title, item.notes, item.person_name, item.target_role, item.unit, item.site, item.category].join(' ').toLocaleLowerCase('vi');
        if (!text.includes(q)) return false;
      }
      return true;
    });
  }
  function render() {
    // Update Role Tab Badges (based on all rows before target_role filtering)
    if ($('badgeAll')) $('badgeAll').textContent = rows.length;
    if ($('badgeStudent')) $('badgeStudent').textContent = rows.filter(x => x.target_role === 'Sinh viên').length;
    if ($('badgeTeacher')) $('badgeTeacher').textContent = rows.filter(x => x.target_role === 'Giảng viên').length;
    if ($('badgeStaff')) $('badgeStaff').textContent = rows.filter(x => x.target_role === 'Nhân viên').length;

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

    // Update bulk action bar
    const selectedInList = list.filter(x => selectedIds.has(x.id)).length;
    if ($('bulkActions')) {
      $('bulkActions').hidden = selectedIds.size === 0;
      $('selectedCount').textContent = selectedIds.size;
    }
    if ($('selectAll')) {
      $('selectAll').checked = n > 0 && selectedInList === n;
      $('selectAll').indeterminate = selectedInList > 0 && selectedInList < n;
    }

    $('items').innerHTML = list.map(item => {
      const [y,m,d] = item.work_date.split('-');
      const isDone = item.status === 'Hoàn thành';
      const statusClass = isDone ? 'done' : item.status === 'Đang xử lý' ? 'progress' : 'new';
      const isChecked = selectedIds.has(item.id) ? 'checked' : '';
      const isStudent = item.target_role === 'Sinh viên';
      const threadId = extractThreadId(item.notes);
      
      const toggleBtn = isDone 
        ? `<button type="button" class="btn-status-toggle done" data-toggle-status="${item.id}" title="Đã hoàn thành. Bấm để đổi sang Đang xử lý">✔ Hoàn thành</button>`
        : `<button type="button" class="btn-status-toggle pending" data-toggle-status="${item.id}" title="Bấm 1-chạm để chuyển Hoàn thành">⏳ ${escapeHtml(item.status || 'Chưa xong')}</button>`;

      const quickDoneBtn = !isDone 
        ? `<button type="button" class="btn-complete" data-mark-done="${item.id}" title="Hoàn thành ngay ca này">✔ Xong</button>` 
        : '';

      const zaloBtn = isStudent 
        ? `<button type="button" class="btn-zalo-reply" data-reply-zalo="${item.id}" title="${threadId ? 'Gửi tin phản hồi từ Zalo Hotline' : 'Gửi tin hoặc sao chép mẫu'}">💬 Gửi Zalo</button>` 
        : '';

      return `<tr class="${isChecked ? 'row-selected' : ''}">
        <td style="text-align:center"><input type="checkbox" data-select-row="${item.id}" ${isChecked} aria-label="Chọn dòng"></td>
        <td>${d}/${m}/${y}</td>
        <td>${escapeHtml(item.person_name || 'Chưa ghi họ tên')}</td>
        <td>${escapeHtml(item.target_role || 'Chưa ghi')}</td>
        <td>${escapeHtml(item.unit)}</td>
        <td><b>${escapeHtml(item.site)}</b></td>
        <td><span class="tag ${item.category === 'Phần mềm' ? 'soft' : ''}">${escapeHtml(item.category)}</span></td>
        <td><b>${escapeHtml(item.title)}</b><small>${escapeHtml(item.notes)}</small></td>
        <td>${toggleBtn}</td>
        <td>
          <div class="actions">
            ${quickDoneBtn}
            ${zaloBtn}
            <button type="button" data-edit="${item.id}" aria-label="Sửa" title="Sửa">✎</button>
            <button type="button" class="btn-delete" data-delete="${item.id}" aria-label="Xóa" title="Xóa">🗑</button>
          </div>
        </td>
      </tr>`;
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
    if (item) {
      for (const key of fields.filter(x => x !== 'work_date')) {
        if (form.elements[key]) {
          form.elements[key].value = item[key] ?? '';
        }
      }
      // Populate person_name from either field if present
      if (form.elements.person_name) {
        form.elements.person_name.value = item.person_name || item.requester_name || '';
      }
      if (form.elements.target_role) {
        form.elements.target_role.value = item.target_role || 'Nhân viên';
      }
    }
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
  $('exportExcel').addEventListener('click', () => {
    const XLSX = window.XLSX;
    if (!XLSX?.utils?.json_to_sheet || !XLSX?.utils?.book_new || !XLSX?.utils?.book_append_sheet || !XLSX?.writeFile) {
      showError('Không tải được thư viện Excel. Kiểm tra kết nối mạng rồi tải lại trang.');
      return;
    }
    const list = filtered();
    if (!list.length) { showError('Không có công việc đang lọc để xuất.'); return; }
    showError('');
    const exportRows = list.map(item => ({
      'Ngày': item.work_date || '',
      'Họ tên người được hỗ trợ': item.person_name || '',
      'Đối tượng': item.target_role || '',
      'Đơn vị': item.unit || '',
      'Cơ sở': item.site || '',
      'Loại hỗ trợ': item.category || '',
      'Tiêu đề công việc': item.title || '',
      'Ghi chú': item.notes || '',
      'Trạng thái': item.status || ''
    }));
    try {
      const worksheet = XLSX.utils.json_to_sheet(exportRows);
      worksheet['!cols'] = [{wch:14},{wch:28},{wch:16},{wch:36},{wch:10},{wch:16},{wch:32},{wch:42},{wch:18}];
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Nhật ký hỗ trợ');
      XLSX.writeFile(workbook, `desklog-${new Date().toISOString().slice(0,10)}.xlsx`, { bookType: 'xlsx', compression: true });
    } catch (error) {
      console.error('Export error:', error);
      showError('Không thể tạo file Excel. Vui lòng thử lại.');
    }
  });
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
    values.person_name = (values.person_name || '').trim();
    values.target_role = (values.target_role || '').trim();
    values.title = (values.title || '').trim();
    values.notes = (values.notes || '').trim();

    if (!values.person_name || !values.target_role || !values.title || !values.site || !values.unit || !values.category) {
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
    const toggle = event.target.closest('[data-toggle-status]');
    const edit = event.target.closest('[data-edit]');
    const del = event.target.closest('[data-delete]');

    if (toggle && sessionUser) {
      const item = rows.find(x => x.id === toggle.dataset.toggleStatus);
      if (!item) return;
      const nextStatus = item.status === 'Hoàn thành' ? 'Đang xử lý' : 'Hoàn thành';
      toggle.disabled = true;
      toggle.textContent = '...';
      const { error } = await client.from('work_items').update({ status: nextStatus }).eq('id', item.id);
      if (error) {
        showError('Không thể đổi trạng thái: ' + error.message);
      } else {
        item.status = nextStatus;
        await load();
      }
      return;
    }

    const markDone = event.target.closest('[data-mark-done]');
    if (markDone && sessionUser) {
      const item = rows.find(x => x.id === markDone.dataset.markDone);
      if (!item) return;
      markDone.disabled = true;
      markDone.textContent = '...';
      const { error } = await client.from('work_items').update({ status: 'Hoàn thành' }).eq('id', item.id);
      if (error) {
        showError('Lỗi cập nhật hoàn thành: ' + error.message);
      } else {
        item.status = 'Hoàn thành';
        await load();
      }
      return;
    }

    const replyZalo = event.target.closest('[data-reply-zalo]');
    if (replyZalo) {
      const item = rows.find(x => x.id === replyZalo.dataset.replyZalo);
      if (item) openReplyDialog(item);
      return;
    }

    if (edit) openEditor(rows.find(x => x.id === edit.dataset.edit));
    if (del && sessionUser) {
      const item = rows.find(x => x.id === del.dataset.delete);
      const name = item ? `"${item.title || item.person_name}"` : 'mục này';
      if (confirm(`Anh có chắc chắn muốn xóa ${name}? Thao tác này không thể hoàn tác.`)) {
        del.disabled = true;
        del.textContent = '...';
        const { error } = await client.from('work_items').delete().eq('id', del.dataset.delete).eq('owner_id', sessionUser.id);
        if (error) {
          showError('Không thể xóa. Kiểm tra quyền tài khoản: ' + error.message);
          del.disabled = false;
          del.textContent = '🗑';
        } else {
          selectedIds.delete(del.dataset.delete);
          await load();
        }
      }
    }
  });

  // Bulk complete handler
  $('completeBulk').addEventListener('click', async () => {
    if (!sessionUser || selectedIds.size === 0) return;
    const count = selectedIds.size;
    if (!confirm(`Đánh dấu Hoàn thành cho ${count} mục đã chọn?`)) return;
    const btn = $('completeBulk');
    btn.disabled = true;
    btn.textContent = 'Đang xử lý...';
    try {
      const ids = Array.from(selectedIds);
      const { error } = await client.from('work_items').update({ status: 'Hoàn thành' }).in('id', ids).eq('owner_id', sessionUser.id);
      if (error) {
        showError('Lỗi cập nhật hoàn thành: ' + error.message);
      } else {
        selectedIds.clear();
        await load();
      }
    } catch (err) {
      showError('Lỗi hệ thống: ' + err.message);
    } finally {
      btn.disabled = false;
      btn.textContent = '✔ Đánh dấu Hoàn thành';
    }
  });

  // Reply Dialog Handlers
  function openReplyDialog(item) {
    replyingItem = item;
    const threadId = extractThreadId(item.notes);
    $('replyRecipient').innerHTML = `Người nhận: <b>${escapeHtml(item.person_name || 'Sinh viên')}</b> • Thread: <code>${escapeHtml(threadId || 'Chưa gắn thread Zalo')}</code>`;
    $('replyMessageText').value = ZALO_AUTH_TEMPLATE;
    $('replyStatusMsg').textContent = '';
    $('replyStatusMsg').style.color = '#ac4338';
    $('replyDialog').showModal();
  }

  function closeReplyDialog() {
    $('replyDialog').close();
    replyingItem = null;
  }

  $('closeReplyDialog').onclick = closeReplyDialog;
  $('cancelReplyDialog').onclick = closeReplyDialog;
  $('btnReplyTpl').onclick = () => { $('replyMessageText').value = ZALO_AUTH_TEMPLATE; };
  $('btnReplyCopy').onclick = () => {
    navigator.clipboard.writeText($('replyMessageText').value);
    $('replyStatusMsg').style.color = '#15803d';
    $('replyStatusMsg').textContent = '✔ Đã sao chép nội dung tin nhắn vào bộ nhớ đệm.';
  };

  $('sendReplyBtn').addEventListener('click', async () => {
    if (!replyingItem) return;
    const msg = $('replyMessageText').value.trim();
    if (!msg) {
      $('replyStatusMsg').style.color = '#ac4338';
      $('replyStatusMsg').textContent = 'Vui lòng nhập nội dung tin nhắn.';
      return;
    }
    const threadId = extractThreadId(replyingItem.notes);
    if (!threadId) {
      $('replyStatusMsg').style.color = '#ac4338';
      $('replyStatusMsg').textContent = 'Ca này chưa có thông tin thread Zalo (chỉ có thể bấm Sao chép để gửi thủ công).';
      return;
    }

    if (!confirm(`Gửi tin nhắn từ Zalo Hotline đến "${replyingItem.person_name || 'sinh viên'}"?`)) return;

    const btn = $('sendReplyBtn');
    btn.disabled = true;
    btn.textContent = '⏳ Đang gửi qua Hotline (8766)...';
    $('replyStatusMsg').textContent = '';

    try {
      const res = await fetch('http://127.0.0.1:8766/api/send-reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          thread_id: threadId,
          message: msg,
          item_id: replyingItem.id
        })
      });
      const r = await res.json();
      if (r.ok) {
        $('replyStatusMsg').style.color = '#15803d';
        $('replyStatusMsg').textContent = '✅ Đã gửi tin Zalo thành công và đánh dấu Hoàn thành!';
        setTimeout(async () => {
          closeReplyDialog();
          await load();
        }, 1000);
      } else {
        $('replyStatusMsg').style.color = '#ac4338';
        $('replyStatusMsg').textContent = '⚠️ Lỗi gửi: ' + (r.error || 'Kiểm tra phiên đăng nhập Hotline');
      }
    } catch (e) {
      $('replyStatusMsg').style.color = '#ac4338';
      $('replyStatusMsg').textContent = '⚠️ Không kết nối được bộ gửi Hotline cổng 8766. Hãy bấm "Sao chép" để dán gửi Zalo thủ công.';
    } finally {
      btn.disabled = false;
      btn.textContent = '🚀 Gửi ngay từ Zalo Hotline';
    }
  });

  // Role Tab Switching
  $('roleTabs').addEventListener('click', event => {
    const tabBtn = event.target.closest('[data-role-tab]');
    if (!tabBtn) return;
    document.querySelectorAll('.role-tab').forEach(b => b.classList.remove('active'));
    tabBtn.classList.add('active');
    currentRoleTab = tabBtn.dataset.roleTab;
    if ($('roleFilter')) $('roleFilter').value = currentRoleTab;
    render();
  });

  if ($('roleFilter')) {
    $('roleFilter').addEventListener('change', () => {
      const val = $('roleFilter').value;
      currentRoleTab = val;
      document.querySelectorAll('.role-tab').forEach(b => {
        b.classList.toggle('active', b.dataset.roleTab === val);
      });
      render();
    });
  }
  $('items').addEventListener('change', event => {
    const cb = event.target.closest('[data-select-row]');
    if (!cb) return;
    const id = cb.dataset.selectRow;
    if (cb.checked) {
      selectedIds.add(id);
    } else {
      selectedIds.delete(id);
    }
    const list = filtered();
    const selectedInList = list.filter(x => selectedIds.has(x.id)).length;
    $('bulkActions').hidden = selectedIds.size === 0;
    $('selectedCount').textContent = selectedIds.size;
    $('selectAll').checked = list.length > 0 && selectedInList === list.length;
    $('selectAll').indeterminate = selectedInList > 0 && selectedInList < list.length;
    const tr = cb.closest('tr');
    if (tr) tr.classList.toggle('row-selected', cb.checked);
  });

  $('selectAll').addEventListener('change', event => {
    const isChecked = event.target.checked;
    const list = filtered();
    if (isChecked) {
      list.forEach(x => selectedIds.add(x.id));
    } else {
      list.forEach(x => selectedIds.delete(x.id));
    }
    render();
  });

  $('clearSelect').addEventListener('click', () => {
    selectedIds.clear();
    render();
  });

  $('deleteBulk').addEventListener('click', async () => {
    if (!sessionUser || selectedIds.size === 0) return;
    const count = selectedIds.size;
    if (!confirm(`CẢNH BÁO: Anh có chắc chắn muốn xóa vĩnh viễn ${count} mục đã chọn?\nDữ liệu đã xóa sẽ không thể phục hồi.`)) {
      return;
    }
    const btn = $('deleteBulk');
    btn.disabled = true;
    btn.textContent = 'Đang xóa...';
    try {
      const idsToDelete = Array.from(selectedIds);
      const { error } = await client.from('work_items').delete().in('id', idsToDelete).eq('owner_id', sessionUser.id);
      if (error) {
        showError('Lỗi xóa hàng loạt: ' + error.message);
      } else {
        selectedIds.clear();
        await load();
      }
    } catch (err) {
      showError('Lỗi hệ thống: ' + err.message);
    } finally {
      btn.disabled = false;
      btn.textContent = '🗑 Xóa các mục đã chọn';
    }
  });

  $('datePreset').addEventListener('change', () => {
    const isCustom = $('datePreset').value === 'custom';
    $('customDateRange').hidden = !isCustom;
    if (isCustom && !$('startDate').value) {
      const now = new Date().toISOString().slice(0, 10);
      $('startDate').value = now;
      $('endDate').value = now;
    }
    render();
  });

  for (const id of ['search', 'roleFilter', 'siteFilter', 'categoryFilter', 'statusFilter', 'startDate', 'endDate']) {
    const el = $(id);
    if (el) el.addEventListener(id === 'search' ? 'input' : 'change', render);
  }
  client.auth.onAuthStateChange((_event, session) => {
    showAuth(session?.user || null);
    if (session?.user) void load();
  });
  client.auth.getSession().then(({ data, error }) => {
    if (error) showError('Không thể kiểm tra phiên đăng nhập.');
    else { showAuth(data.session?.user || null); if (data.session?.user) void load(); }
  });
})();
