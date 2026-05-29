(function () {
  const STORAGE_KEY = 'nail_admin_pwd';
  const STATUSES = ['待联系', '已确认', '已完成', '已取消'];
  const STATUS_CLASS = {
    待联系: 'status-pending',
    已确认: 'status-confirmed',
    已完成: 'status-done',
    已取消: 'status-cancelled',
  };
  const POLL_INTERVAL_MS = 15000;
  const MAX_WORK_IMAGE_WIDTH = 1400;
  const WORK_IMAGE_QUALITY = 0.85;
  let password = sessionStorage.getItem(STORAGE_KEY) || '';
  let pollTimer = null;
  let knownBookingIds = null;
  let worksCache = [];
  let servicesCache = [];
  let pendingWorkImage = null;
  let shouldClearWorkImage = false;
  const toast = document.getElementById('toast');
  const notificationStatus = document.getElementById('notification-status');
  const notificationBtn = document.getElementById('btn-enable-notification');
  const workIdInput = document.getElementById('work-id');
  const workTitleInput = document.getElementById('work-title');
  const workTagInput = document.getElementById('work-tag');
  const workDescriptionInput = document.getElementById('work-description');
  const workSortInput = document.getElementById('work-sort');
  const workImageInput = document.getElementById('work-image-input');
  const workActiveInput = document.getElementById('work-active');
  const worksList = document.getElementById('works-list');
  const worksEmpty = document.getElementById('works-empty');
  const btnWorkReset = document.getElementById('btn-work-reset');
  const btnWorkSave = document.getElementById('btn-work-save');
  const btnWorkClearImage = document.getElementById('btn-work-clear-image');
  const settingStoreName = document.getElementById('setting-store-name');
  const settingHeroBadge = document.getElementById('setting-hero-badge');
  const settingHeroTitle = document.getElementById('setting-hero-title');
  const settingHeroSubtitle = document.getElementById('setting-hero-subtitle');
  const settingHeroDesc = document.getElementById('setting-hero-desc');
  const settingBookingNotice = document.getElementById('setting-booking-notice');
  const settingBookingSuccess = document.getElementById('setting-booking-success');
  const settingWorksIntro = document.getElementById('setting-works-intro');
  const settingSpecialOpen = document.getElementById('setting-special-open');
  const settingContactTitle = document.getElementById('setting-contact-title');
  const settingContactWechat = document.getElementById('setting-contact-wechat');
  const settingContactPhone = document.getElementById('setting-contact-phone');
  const settingContactNote = document.getElementById('setting-contact-note');
  const settingContactQr = document.getElementById('setting-contact-qr');
  const settingRules = document.getElementById('setting-rules');
  const btnSettingReload = document.getElementById('btn-setting-reload');
  const btnSettingSave = document.getElementById('btn-setting-save');
  const serviceIdInput = document.getElementById('service-id');
  const serviceCategoryInput = document.getElementById('service-category');
  const serviceNameInput = document.getElementById('service-name');
  const servicePriceInput = document.getElementById('service-price');
  const serviceSuffixInput = document.getElementById('service-suffix');
  const serviceSortInput = document.getElementById('service-sort');
  const serviceActiveInput = document.getElementById('service-active');
  const servicesList = document.getElementById('services-list');
  const servicesEmpty = document.getElementById('services-empty');
  const btnServiceReset = document.getElementById('btn-service-reset');
  const btnServiceSave = document.getElementById('btn-service-save');

  function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
  }

  async function parseJsonResponse(res) {
    const text = await res.text();
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      try {
        return JSON.parse(text);
      } catch {
        throw new Error('服务器返回格式异常');
      }
    }
    if (text.trimStart().startsWith('<!DOCTYPE') || text.trimStart().startsWith('<html')) {
      throw new Error('接口不可用，请重启服务后重试（node server.js）');
    }
    throw new Error(text.slice(0, 120) || `请求失败 (${res.status})`);
  }

  function showAdmin() {
    document.getElementById('login-section').classList.add('hidden');
    document.getElementById('admin-section').classList.remove('hidden');
    refreshNotificationUi();
    loadBookings({ notifyNew: false });
    loadServices();
    loadWorks();
    loadSiteSettings();
    startPolling();
  }

  function showLogin() {
    document.getElementById('login-section').classList.remove('hidden');
    document.getElementById('admin-section').classList.add('hidden');
    sessionStorage.removeItem(STORAGE_KEY);
    password = '';
    knownBookingIds = null;
    worksCache = [];
    servicesCache = [];
    resetWorkForm();
    stopPolling();
  }

  function startPolling() {
    stopPolling();
    pollTimer = setInterval(() => {
      loadBookings({ notifyNew: true, silent: true });
    }, POLL_INTERVAL_MS);
  }

  function stopPolling() {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  }

  function refreshNotificationUi() {
    if (!notificationBtn || !notificationStatus) return;
    if (!('Notification' in window)) {
      notificationStatus.textContent = '当前浏览器不支持桌面提醒，会保留页面内提示';
      notificationBtn.hidden = true;
      return;
    }
    if (Notification.permission === 'granted') {
      notificationStatus.textContent = '浏览器提醒已开启，有新预约会弹出通知';
      notificationBtn.textContent = '提醒已开启';
      notificationBtn.disabled = true;
    } else if (Notification.permission === 'denied') {
      notificationStatus.textContent = '浏览器提醒已被阻止，可在浏览器地址栏权限中重新开启';
      notificationBtn.textContent = '已被阻止';
      notificationBtn.disabled = true;
    } else {
      notificationStatus.textContent = '后台打开时会自动检查新预约';
      notificationBtn.textContent = '开启提醒';
      notificationBtn.disabled = false;
    }
  }

  function notifyNewBookings(bookings) {
    if (!bookings.length) return;
    const first = bookings[0];
    const message =
      bookings.length === 1
        ? `新预约：${first.date} ${first.time}，微信 ${first.wechat}`
        : `收到 ${bookings.length} 条新预约，请及时查看`;
    showToast(message);
    document.title = `(${bookings.length}) 新预约 · 奶油指尖`;

    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('奶油指尖新预约', {
        body: message,
        tag: 'nail-new-booking',
      });
    }
  }

  function formatDateTimeText(dateText, timeText) {
    if (!dateText) return timeText || '';
    return `${dateText} ${timeText || ''}`.trim();
  }

  function resetWorkForm() {
    if (!workIdInput) return;
    workIdInput.value = '';
    workTitleInput.value = '';
    workTagInput.value = '';
    workDescriptionInput.value = '';
    workSortInput.value = '0';
    workActiveInput.checked = true;
    pendingWorkImage = null;
    shouldClearWorkImage = false;
    if (workImageInput) workImageInput.value = '';
    if (btnWorkClearImage) btnWorkClearImage.style.display = 'none';
    if (btnWorkSave) btnWorkSave.textContent = '保存作品';
  }

  async function compressImageToDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          let width = img.width;
          let height = img.height;
          if (width > MAX_WORK_IMAGE_WIDTH) {
            height = Math.round((height * MAX_WORK_IMAGE_WIDTH) / width);
            width = MAX_WORK_IMAGE_WIDTH;
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          const isPng = file.type === 'image/png' || /\.png$/i.test(file.name);
          const mime = isPng ? 'image/png' : 'image/jpeg';
          resolve(canvas.toDataURL(mime, isPng ? undefined : WORK_IMAGE_QUALITY));
        };
        img.onerror = () => reject(new Error('图片解析失败'));
        img.src = e.target.result;
      };
      reader.onerror = () => reject(new Error('图片读取失败'));
      reader.readAsDataURL(file);
    });
  }

  function renderWorks() {
    if (!worksList || !worksEmpty) return;
    worksList.innerHTML = '';
    if (!worksCache.length) {
      worksEmpty.classList.remove('hidden');
      return;
    }
    worksEmpty.classList.add('hidden');

    worksCache.forEach((work) => {
      const card = document.createElement('article');
      card.className = 'work-admin-card';
      const imageHtml = work.image
        ? `<img src="${escapeHtml(work.image)}" alt="${escapeHtml(work.title)}" loading="lazy" />`
        : '<div class="work-admin-empty">无图片</div>';
      card.innerHTML = `
        <div class="work-admin-cover">${imageHtml}</div>
        <div class="work-admin-body">
          <div class="work-admin-top">
            <h3>${escapeHtml(work.title)}</h3>
            <span class="status-badge ${work.active ? 'status-done' : 'status-cancelled'}">${work.active ? '上架中' : '已下架'}</span>
          </div>
          <p class="work-admin-meta">${escapeHtml(work.tag || '未设置标签')} · 排序 ${work.sort_order}</p>
          <p class="work-admin-desc">${escapeHtml(work.description || '暂无介绍')}</p>
          <p class="work-admin-meta">创建于 ${formatDateTimeText(work.created_at, '')}</p>
          <div class="contact-actions">
            <button type="button" class="btn-contact" data-work-action="edit" data-id="${work.id}">编辑</button>
            <button type="button" class="btn-contact" data-work-action="toggle" data-id="${work.id}">${work.active ? '下架' : '上架'}</button>
            <button type="button" class="btn-delete" data-work-action="delete" data-id="${work.id}">删除</button>
          </div>
        </div>
      `;
      worksList.appendChild(card);
    });

    worksList.querySelectorAll('[data-work-action]').forEach((btn) => {
      btn.addEventListener('click', () => handleWorkAction(btn));
    });
  }

  async function loadWorks() {
    try {
      const res = await fetch(`/api/admin/works?password=${encodeURIComponent(password)}`);
      const data = await parseJsonResponse(res);
      if (!res.ok) throw new Error(data.error || '作品加载失败');
      worksCache = Array.isArray(data) ? data : [];
      renderWorks();
    } catch (e) {
      showToast(e.message || '作品加载失败');
      if (e.message === '密码错误') showLogin();
    }
  }

  function fillWorkForm(work) {
    workIdInput.value = String(work.id);
    workTitleInput.value = work.title || '';
    workTagInput.value = work.tag || '';
    workDescriptionInput.value = work.description || '';
    workSortInput.value = String(work.sort_order || 0);
    workActiveInput.checked = Boolean(work.active);
    pendingWorkImage = null;
    shouldClearWorkImage = false;
    if (workImageInput) workImageInput.value = '';
    if (btnWorkClearImage) btnWorkClearImage.style.display = work.image ? '' : 'none';
    if (btnWorkSave) btnWorkSave.textContent = '更新作品';
  }

  async function saveWork() {
    const title = workTitleInput.value.trim();
    if (!title) {
      showToast('请填写作品名称');
      return;
    }
    const id = Number(workIdInput.value);
    const payload = {
      title,
      tag: workTagInput.value.trim(),
      description: workDescriptionInput.value.trim(),
      active: workActiveInput.checked,
      sortOrder: Number(workSortInput.value || 0),
    };
    if (pendingWorkImage) payload.image = pendingWorkImage;
    else if (shouldClearWorkImage) payload.image = '';

    const isEdit = Number.isInteger(id) && id > 0;
    const url = isEdit
      ? `/api/admin/works/${id}?password=${encodeURIComponent(password)}`
      : `/api/admin/works?password=${encodeURIComponent(password)}`;
    const method = isEdit ? 'PATCH' : 'POST';

    btnWorkSave.disabled = true;
    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await parseJsonResponse(res);
      if (!res.ok) throw new Error(data.error || '保存失败');
      showToast(isEdit ? '作品已更新' : '作品已新增');
      resetWorkForm();
      loadWorks();
    } catch (e) {
      showToast(e.message || '保存失败');
    } finally {
      btnWorkSave.disabled = false;
    }
  }

  function resetServiceForm() {
    if (!serviceIdInput) return;
    serviceIdInput.value = '';
    serviceCategoryInput.value = '';
    serviceNameInput.value = '';
    servicePriceInput.value = '';
    serviceSuffixInput.value = '';
    serviceSortInput.value = '0';
    serviceActiveInput.checked = true;
    btnServiceSave.textContent = '保存项目';
  }

  function fillServiceForm(item) {
    serviceIdInput.value = String(item.id);
    serviceCategoryInput.value = item.category || '';
    serviceNameInput.value = item.name || '';
    servicePriceInput.value = item.price || '';
    serviceSuffixInput.value = item.suffix || '';
    serviceSortInput.value = String(item.sort_order || 0);
    serviceActiveInput.checked = Boolean(item.active);
    btnServiceSave.textContent = '更新项目';
  }

  function renderServices() {
    if (!servicesList || !servicesEmpty) return;
    servicesList.innerHTML = '';
    if (!servicesCache.length) {
      servicesEmpty.classList.remove('hidden');
      return;
    }
    servicesEmpty.classList.add('hidden');

    servicesCache.forEach((item) => {
      const card = document.createElement('article');
      card.className = 'work-admin-card service-admin-card';
      card.innerHTML = `
        <div class="work-admin-body" style="grid-column: 1 / -1">
          <div class="work-admin-top">
            <h3>${escapeHtml(item.category)} · ${escapeHtml(item.name)}</h3>
            <span class="status-badge ${item.active ? 'status-done' : 'status-cancelled'}">${item.active ? '展示中' : '已隐藏'}</span>
          </div>
          <p class="work-admin-meta">价格 ¥${escapeHtml(item.price)}${escapeHtml(item.suffix || '')} · 排序 ${item.sort_order}</p>
          <div class="contact-actions">
            <button type="button" class="btn-contact" data-service-action="edit" data-id="${item.id}">编辑</button>
            <button type="button" class="btn-contact" data-service-action="toggle" data-id="${item.id}">${item.active ? '隐藏' : '展示'}</button>
            <button type="button" class="btn-delete" data-service-action="delete" data-id="${item.id}">删除</button>
          </div>
        </div>
      `;
      servicesList.appendChild(card);
    });

    servicesList.querySelectorAll('[data-service-action]').forEach((btn) => {
      btn.addEventListener('click', () => handleServiceAction(btn));
    });
  }

  async function loadServices() {
    if (!servicesList) return;
    try {
      const res = await fetch(`/api/admin/services?password=${encodeURIComponent(password)}`);
      const data = await parseJsonResponse(res);
      if (!res.ok) throw new Error(data.error || '项目加载失败');
      servicesCache = Array.isArray(data) ? data : [];
      renderServices();
    } catch (e) {
      showToast(e.message || '项目加载失败');
    }
  }

  async function saveService() {
    const category = serviceCategoryInput.value.trim();
    const name = serviceNameInput.value.trim();
    const price = servicePriceInput.value.trim();
    if (!category || !name || !price) {
      showToast('请填写分类、项目和价格');
      return;
    }
    const id = Number(serviceIdInput.value);
    const payload = {
      category,
      name,
      price,
      suffix: serviceSuffixInput.value.trim(),
      active: serviceActiveInput.checked,
      sortOrder: Number(serviceSortInput.value || 0),
    };
    const isEdit = Number.isInteger(id) && id > 0;
    const url = isEdit
      ? `/api/admin/services/${id}?password=${encodeURIComponent(password)}`
      : `/api/admin/services?password=${encodeURIComponent(password)}`;
    const method = isEdit ? 'PATCH' : 'POST';
    btnServiceSave.disabled = true;
    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await parseJsonResponse(res);
      if (!res.ok) throw new Error(data.error || '保存失败');
      showToast(isEdit ? '项目已更新' : '项目已新增');
      resetServiceForm();
      loadServices();
    } catch (e) {
      showToast(e.message || '保存失败');
    } finally {
      btnServiceSave.disabled = false;
    }
  }

  async function handleServiceAction(btn) {
    const id = Number(btn.dataset.id);
    const action = btn.dataset.serviceAction;
    const item = servicesCache.find((s) => s.id === id);
    if (!item) return;
    if (action === 'edit') {
      fillServiceForm(item);
      serviceCategoryInput?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    if (action === 'toggle') {
      try {
        const res = await fetch(
          `/api/admin/services/${id}?password=${encodeURIComponent(password)}`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              category: item.category,
              name: item.name,
              price: item.price,
              suffix: item.suffix,
              active: !item.active,
              sortOrder: item.sort_order,
            }),
          }
        );
        const data = await parseJsonResponse(res);
        if (!res.ok) throw new Error(data.error || '更新失败');
        showToast(!item.active ? '项目已展示' : '项目已隐藏');
        loadServices();
      } catch (e) {
        showToast(e.message || '更新失败');
      }
      return;
    }
    if (action === 'delete') {
      if (!confirm('确定删除这个项目？')) return;
      try {
        const res = await fetch(
          `/api/admin/services/${id}?password=${encodeURIComponent(password)}`,
          { method: 'DELETE' }
        );
        const data = await parseJsonResponse(res);
        if (!res.ok) throw new Error(data.error || '删除失败');
        if (Number(serviceIdInput.value) === id) resetServiceForm();
        showToast('项目已删除');
        loadServices();
      } catch (e) {
        showToast(e.message || '删除失败');
      }
    }
  }

  function fillSiteSettingsForm(data) {
    if (!settingStoreName) return;
    settingStoreName.value = data.store_name || '';
    settingHeroBadge.value = data.hero_badge || '';
    settingHeroTitle.value = data.hero_title || '';
    settingHeroSubtitle.value = data.hero_subtitle || '';
    settingHeroDesc.value = data.hero_desc || '';
    settingBookingNotice.value = data.booking_notice || '';
    settingBookingSuccess.value = data.booking_success || '';
    settingWorksIntro.value = data.works_intro || '';
    settingSpecialOpen.value = Array.isArray(data.special_open)
      ? data.special_open
          .map((s) => `${s.date} ${s.start}-${s.end}`)
          .join('\n')
      : '';
    if (settingContactTitle) settingContactTitle.value = data.contact_title || '';
    if (settingContactWechat) settingContactWechat.value = data.contact_wechat || '';
    if (settingContactPhone) settingContactPhone.value = data.contact_phone || '';
    if (settingContactNote) settingContactNote.value = data.contact_note || '';
    if (settingContactQr) settingContactQr.value = '';
    settingRules.value = Array.isArray(data.rules) ? data.rules.join('\n') : '';
  }

  function parseSpecialOpenLines(text) {
    const lines = text
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
    const valid = [];
    const invalid = [];
    lines.forEach((line, idx) => {
      const normalized = line.replace(/：/g, ':').replace(/～|—|–/g, '-');
      const m = normalized.match(/^(\d{4}-\d{2}-\d{2})\s+(\d{1,2}:\d{1,2})\s*-\s*(\d{1,2}:\d{1,2})$/);
      if (!m) {
        invalid.push(`第${idx + 1}行`);
        return;
      }
      valid.push({ date: m[1], start: m[2], end: m[3] });
    });
    return { valid, invalid };
  }

  async function loadSiteSettings() {
    if (!settingStoreName) return;
    try {
      const res = await fetch(`/api/admin/site-settings?password=${encodeURIComponent(password)}`);
      const data = await parseJsonResponse(res);
      if (!res.ok) throw new Error(data.error || '设置加载失败');
      fillSiteSettingsForm(data);
    } catch (e) {
      showToast(e.message || '设置加载失败');
    }
  }

  async function saveSiteSettings() {
    if (!settingStoreName) return;
    const rules = settingRules.value
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
    const parsedSpecial = parseSpecialOpenLines(settingSpecialOpen.value || '');
    if (parsedSpecial.invalid.length) {
      showToast(`${parsedSpecial.invalid.join('、')}格式不对，请用 YYYY-MM-DD HH:MM-HH:MM`);
      return;
    }
    const specialOpen = parsedSpecial.valid;
    let contactQrImage = '';
    if (settingContactQr?.files?.[0]) {
      contactQrImage = await compressImageToDataUrl(settingContactQr.files[0]);
    }
    const payload = {
      store_name: settingStoreName.value.trim(),
      hero_badge: settingHeroBadge.value.trim(),
      hero_title: settingHeroTitle.value.trim(),
      hero_subtitle: settingHeroSubtitle.value.trim(),
      hero_desc: settingHeroDesc.value.trim(),
      booking_notice: settingBookingNotice.value.trim(),
      booking_success: settingBookingSuccess.value.trim(),
      works_intro: settingWorksIntro.value.trim(),
      special_open: specialOpen,
      contact_title: settingContactTitle?.value?.trim() || '',
      contact_wechat: settingContactWechat?.value?.trim() || '',
      contact_phone: settingContactPhone?.value?.trim() || '',
      contact_note: settingContactNote?.value?.trim() || '',
      contact_qr_image: contactQrImage || undefined,
      rules,
    };
    btnSettingSave.disabled = true;
    try {
      const res = await fetch(
        `/api/admin/site-settings?password=${encodeURIComponent(password)}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      );
      const data = await parseJsonResponse(res);
      if (!res.ok) throw new Error(data.error || '设置保存失败');
      fillSiteSettingsForm(data);
      showToast('店铺设置已保存');
    } catch (e) {
      showToast(e.message || '设置保存失败');
    } finally {
      btnSettingSave.disabled = false;
    }
  }

  async function handleWorkAction(btn) {
    const id = Number(btn.dataset.id);
    const action = btn.dataset.workAction;
    const work = worksCache.find((item) => item.id === id);
    if (!work) return;

    if (action === 'edit') {
      fillWorkForm(work);
      workTitleInput?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }

    if (action === 'toggle') {
      try {
        const res = await fetch(
          `/api/admin/works/${id}?password=${encodeURIComponent(password)}`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              title: work.title,
              tag: work.tag,
              description: work.description,
              active: !work.active,
              sortOrder: work.sort_order,
            }),
          }
        );
        const data = await parseJsonResponse(res);
        if (!res.ok) throw new Error(data.error || '更新失败');
        showToast(!work.active ? '作品已上架' : '作品已下架');
        loadWorks();
      } catch (e) {
        showToast(e.message || '更新失败');
      }
      return;
    }

    if (action === 'delete') {
      if (!confirm('确定删除这条作品？')) return;
      try {
        const res = await fetch(
          `/api/admin/works/${id}?password=${encodeURIComponent(password)}`,
          { method: 'DELETE' }
        );
        const data = await parseJsonResponse(res);
        if (!res.ok) throw new Error(data.error || '删除失败');
        if (Number(workIdInput.value) === id) resetWorkForm();
        showToast('作品已删除');
        loadWorks();
      } catch (e) {
        showToast(e.message || '删除失败');
      }
    }
  }

  async function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return;
    }
    const input = document.createElement('textarea');
    input.value = text;
    input.setAttribute('readonly', '');
    input.style.position = 'fixed';
    input.style.left = '-9999px';
    document.body.appendChild(input);
    input.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(input);
    if (!ok) throw new Error('复制失败，请手动复制');
  }

  function buildContactMessage(booking) {
    const serviceNames = booking.services.map((s) => s.label).join('、');
    return `你好呀，我是奶油指尖美甲工作室，收到你 ${booking.date} ${booking.time} 的预约啦（${serviceNames}）。请问这个时间方便确认吗？`;
  }

  async function loadBookings(options = {}) {
    const { notifyNew = false, silent = false } = options;
    try {
      const res = await fetch(`/api/bookings?password=${encodeURIComponent(password)}`);
      const data = await parseJsonResponse(res);
      if (!res.ok) throw new Error(data.error);

      const currentIds = new Set(data.map((b) => b.id));
      if (knownBookingIds && notifyNew) {
        const newBookings = data.filter(
          (b) => !knownBookingIds.has(b.id) && b.status !== '已取消'
        );
        notifyNewBookings(newBookings);
      }
      knownBookingIds = currentIds;

      const today = new Date().toISOString().split('T')[0];
      const filterDate = document.getElementById('filter-date').value;

      document.getElementById('stat-total').textContent = data.length;
      document.getElementById('stat-today').textContent = data.filter((b) => b.date === today).length;

      let filtered = data;
      if (filterDate) {
        filtered = data.filter((b) => b.date === filterDate);
      }

      const list = document.getElementById('bookings-list');
      const empty = document.getElementById('empty-state');
      list.innerHTML = '';

      if (filtered.length === 0) {
        empty.classList.remove('hidden');
        return;
      }
      empty.classList.add('hidden');

      filtered.forEach((b) => {
        const card = document.createElement('div');
        card.className = 'booking-record';
        const services = b.services
          .map((s) => `<span class="service-tag">${s.label} ¥${s.price}</span>`)
          .join('');
        const imgs = b.images || [];
        const imagesHtml = imgs.length
          ? `<div class="record-images">
              <p class="record-images-label">参考图</p>
              <div class="record-images-grid">
                ${imgs
                  .map(
                    (src, i) =>
                      `<button type="button" class="record-image-thumb" data-src="${escapeHtml(src)}" aria-label="查看参考图 ${i + 1}">
                        <img src="${escapeHtml(src)}" alt="参考图 ${i + 1}" loading="lazy" />
                      </button>`
                  )
                  .join('')}
              </div>
            </div>`
          : '';
        const status = STATUSES.includes(b.status) ? b.status : '待联系';
        const statusClass = STATUS_CLASS[status] || 'status-pending';
        const statusBtns = STATUSES.map(
          (s) =>
            `<button type="button" class="status-btn ${s === status ? 'is-active' : ''}" data-id="${b.id}" data-status="${s}" ${s === status ? 'disabled' : ''}>${s}</button>`
        ).join('');

        card.innerHTML = `
          <div class="record-header">
            <div class="record-header-left">
              <span class="record-date">${formatDate(b.date)}</span>
              <span class="record-time">${b.time}</span>
            </div>
            <span class="status-badge ${statusClass}">${status}</span>
          </div>
          <div class="record-services">${services}</div>
          <div class="record-meta">
            <p><strong>微信：</strong>${escapeHtml(b.wechat)}</p>
            ${b.notes ? `<p style="margin-top:6px"><strong>备注：</strong>${escapeHtml(b.notes)}</p>` : ''}
            <p style="margin-top:6px;color:var(--text-muted);font-size:0.72rem">提交于 ${b.created_at}</p>
          </div>
          <div class="contact-actions">
            <button type="button" class="btn-contact" data-copy="wechat" data-wechat="${escapeHtml(
              b.wechat
            )}">复制微信号</button>
            <button type="button" class="btn-contact" data-copy="message" data-id="${b.id}">复制联系话术</button>
          </div>
          ${imagesHtml}
          <div class="status-actions">
            <span class="status-actions-label">切换状态</span>
            <div class="status-actions-btns">${statusBtns}</div>
          </div>
          <button type="button" class="btn-delete" data-id="${b.id}">删除记录</button>
        `;
        list.appendChild(card);
      });

      list.querySelectorAll('.record-image-thumb').forEach((btn) => {
        btn.addEventListener('click', () => openLightbox(btn.dataset.src));
      });

      list.querySelectorAll('.status-btn:not(:disabled)').forEach((btn) => {
        btn.addEventListener('click', () => updateStatus(btn.dataset.id, btn.dataset.status));
      });

      list.querySelectorAll('.btn-contact').forEach((btn) => {
        btn.addEventListener('click', async () => {
          try {
            if (btn.dataset.copy === 'wechat') {
              await copyText(btn.dataset.wechat || '');
              showToast('微信号已复制');
              return;
            }
            const bookingId = Number(btn.dataset.id);
            const booking = data.find((item) => item.id === bookingId);
            if (!booking) throw new Error('预约数据不存在');
            await copyText(buildContactMessage(booking));
            showToast('联系话术已复制');
          } catch (err) {
            showToast(err.message || '复制失败');
          }
        });
      });

      list.querySelectorAll('.btn-delete').forEach((btn) => {
        btn.addEventListener('click', async () => {
          if (!confirm('确定删除这条预约？')) return;
          const id = btn.dataset.id;
          const res = await fetch(`/api/bookings/${id}?password=${encodeURIComponent(password)}`, {
            method: 'DELETE',
          });
          if (res.ok) loadBookings();
          else showToast('删除失败');
        });
      });
    } catch (e) {
      if (!silent) showToast(e.message || '加载失败');
      if (e.message === '密码错误') showLogin();
    }
  }

  async function updateStatus(id, status) {
    try {
      const res = await fetch(
        `/api/bookings/${id}/status?password=${encodeURIComponent(password)}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status }),
        }
      );
      const data = await parseJsonResponse(res);
      if (!res.ok) throw new Error(data.error);
      showToast(`已设为「${status}」`);
      loadBookings({ notifyNew: false });
    } catch (e) {
      showToast(e.message || '状态更新失败');
    }
  }

  function formatDate(str) {
    const d = new Date(str + 'T00:00:00');
    const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
    return `${str} 周${weekdays[d.getDay()]}`;
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  document.getElementById('btn-login').addEventListener('click', () => {
    password = document.getElementById('admin-password').value;
    if (!password) {
      showToast('请输入密码');
      return;
    }
    sessionStorage.setItem(STORAGE_KEY, password);
    showAdmin();
  });

  document.getElementById('btn-logout').addEventListener('click', showLogin);

  document.getElementById('filter-date').addEventListener('change', () =>
    loadBookings({ notifyNew: false })
  );

  notificationBtn?.addEventListener('click', async () => {
    if (!('Notification' in window)) {
      refreshNotificationUi();
      return;
    }
    const permission = await Notification.requestPermission();
    refreshNotificationUi();
    if (permission === 'granted') showToast('新预约浏览器提醒已开启');
  });

  workImageInput?.addEventListener('change', async () => {
    const file = workImageInput.files?.[0];
    if (!file) return;
    if (!/^image\/(jpeg|jpg|png|webp)$/i.test(file.type) && !/\.(jpe?g|png|webp)$/i.test(file.name)) {
      showToast('仅支持 JPG、PNG、WEBP');
      workImageInput.value = '';
      return;
    }
    try {
      pendingWorkImage = await compressImageToDataUrl(file);
      shouldClearWorkImage = false;
      showToast('作品图片已准备好，保存后生效');
    } catch (e) {
      showToast(e.message || '图片处理失败');
    }
  });

  btnWorkSave?.addEventListener('click', saveWork);
  btnWorkReset?.addEventListener('click', resetWorkForm);
  btnWorkClearImage?.addEventListener('click', () => {
    shouldClearWorkImage = true;
    pendingWorkImage = null;
    if (workImageInput) workImageInput.value = '';
    btnWorkClearImage.style.display = 'none';
    showToast('已标记清空图片，保存后生效');
  });
  btnSettingReload?.addEventListener('click', loadSiteSettings);
  btnSettingSave?.addEventListener('click', saveSiteSettings);
  btnServiceSave?.addEventListener('click', saveService);
  btnServiceReset?.addEventListener('click', resetServiceForm);

  const lightbox = document.getElementById('lightbox');
  const lightboxImg = document.getElementById('lightbox-img');
  const lightboxClose = document.getElementById('lightbox-close');
  const lightboxBackdrop = document.getElementById('lightbox-backdrop');

  function openLightbox(src) {
    if (!lightbox || !lightboxImg) return;
    lightboxImg.src = src;
    lightbox.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }

  function closeLightbox() {
    if (!lightbox || !lightboxImg) return;
    lightbox.classList.add('hidden');
    lightboxImg.src = '';
    document.body.style.overflow = '';
  }

  lightboxClose?.addEventListener('click', closeLightbox);
  lightboxBackdrop?.addEventListener('click', closeLightbox);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && lightbox && !lightbox.classList.contains('hidden')) {
      closeLightbox();
    }
  });

  window.addEventListener('focus', () => {
    document.title = '预约管理 · 奶油指尖';
  });

  if (password) showAdmin();
})();
