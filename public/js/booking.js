(function () {
  let currentStep = 1;
  const toast = document.getElementById('toast');

  function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
  }

  window.bookingShowToast = showToast;

  function setStep(step) {
    currentStep = step;
    document.querySelectorAll('.form-step').forEach((el) => {
      el.classList.toggle('active', Number(el.dataset.step) === step);
    });
    document.querySelectorAll('.progress-step').forEach((el) => {
      const s = Number(el.dataset.step);
      el.classList.toggle('active', s === step);
      el.classList.toggle('done', s < step);
      const dot = el.querySelector('.step-dot');
      if (s < step) dot.textContent = '';
      else dot.textContent = s;
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const grid = document.getElementById('service-grid');
  function renderServices(serviceData) {
    grid.innerHTML = '';
    serviceData.forEach((cat) => {
      cat.items.forEach((item) => {
        const wrap = document.createElement('div');
        wrap.className = 'service-option';
        const suffix = item.suffix || '';
        const valueId = item.id || `svc-${item.serviceId || item.name}`;
        wrap.innerHTML = `
          <input type="checkbox" name="service" id="${valueId}" value="${valueId}"
            data-label="${cat.category} · ${item.name}" data-price="${item.price}${suffix}" />
          <label for="${valueId}">
            <span>
              <span class="name">${item.name}</span>
              <span class="cat">${cat.category}</span>
            </span>
            <span class="price">¥${item.price}${suffix}</span>
          </label>
        `;
        grid.appendChild(wrap);
      });
    });
  }

  async function copyText(text) {
    if (!text) return false;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch {}
    const el = document.createElement('textarea');
    el.value = text;
    el.style.position = 'fixed';
    el.style.left = '-9999px';
    document.body.appendChild(el);
    el.select();
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch {
      ok = false;
    }
    document.body.removeChild(el);
    return ok;
  }

  async function loadServicesData() {
    try {
      const res = await fetch('/api/services');
      const data = await res.json();
      if (res.ok && Array.isArray(data) && data.length) return data;
    } catch {}
    return SERVICES;
  }

  const dateInput = document.getElementById('booking-date');
  const timeHint = document.getElementById('time-hint');
  let lastSubmittedDate = '';
  let lastSubmittedTime = '';
  let lastSubmittedWechat = '';
  const today = new Date();
  const minDate = today.toISOString().split('T')[0];
  const maxDate = new Date(today);
  maxDate.setDate(maxDate.getDate() + 60);
  dateInput.min = minDate;
  dateInput.max = maxDate.toISOString().split('T')[0];
  dateInput.value = minDate;

  const slotsEl = document.getElementById('time-slots');
  let renderedSlotsKey = '';

  function renderTimeSlots(slots) {
    const key = JSON.stringify(slots || []);
    if (renderedSlotsKey === key) return;
    renderedSlotsKey = key;
    slotsEl.innerHTML = '';
    (slots || []).forEach((time) => {
      const wrap = document.createElement('div');
      wrap.className = 'time-slot';
      const id = `time-${time.replace(/[:~\-]/g, '')}`;
      const label = String(time).replace('-', '~');
      wrap.innerHTML = `
        <input type="radio" name="time" id="${id}" value="${time}" />
        <label for="${id}">${label}</label>
      `;
      slotsEl.appendChild(wrap);
    });
  }

  async function updateTimeSlotAvailability() {
    if (!dateInput.value) return;
    try {
      const res = await fetch(`/api/availability?date=${encodeURIComponent(dateInput.value)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '加载可预约时段失败');
      const slots = Array.isArray(data.slots) ? data.slots : [];
      renderTimeSlots(slots);
      const occupied = new Set(Array.isArray(data.occupied) ? data.occupied : []);
      document.querySelectorAll('input[name="time"]').forEach((input) => {
        const isOccupied = occupied.has(input.value) || Boolean(data.closed);
        input.disabled = isOccupied;
        if (isOccupied && input.checked) input.checked = false;
      });
      if (data.closed) {
        if (timeHint) timeHint.textContent = `该日期暂不可预约：${data.closed_reason || '店休'}`;
      } else if (!slots.length) {
        if (timeHint) timeHint.textContent = '该日期暂未开放可预约时段';
      } else if (timeHint) {
        timeHint.textContent = '请选择方便到店的时间段';
      }
    } catch (err) {
      showToast(err.message || '加载可预约时段失败');
    }
  }

  function getSelectedServices() {
    return [...document.querySelectorAll('input[name="service"]:checked')].map((el) => ({
      id: el.value,
      label: el.dataset.label,
      price: el.dataset.price,
    }));
  }

  document.getElementById('btn-next-1').addEventListener('click', () => {
    if (getSelectedServices().length === 0) {
      showToast('请至少选择一项服务');
      return;
    }
    setStep(2);
  });

  document.getElementById('btn-prev-2').addEventListener('click', () => setStep(1));

  document.getElementById('btn-next-2').addEventListener('click', () => {
    if (!dateInput.value) {
      showToast('请选择预约日期');
      return;
    }
    if (!document.querySelector('input[name="time"]:checked')) {
      showToast('请选择预约时段');
      return;
    }
    setStep(3);
  });

  document.getElementById('btn-prev-3').addEventListener('click', () => setStep(2));
  dateInput.addEventListener('change', updateTimeSlotAvailability);

  async function parseJsonResponse(res) {
    const text = await res.text();
    const ct = res.headers.get('content-type') || '';
    if (ct.includes('application/json')) {
      try {
        return JSON.parse(text);
      } catch {
        throw new Error('服务器返回格式异常');
      }
    }
    if (text.trimStart().startsWith('<!DOCTYPE') || text.trimStart().startsWith('<html')) {
      if (res.status === 413) throw new Error('图片过大，请减少张数或压缩后重试');
      throw new Error('接口不可用，请确认服务已启动（npm start）');
    }
    throw new Error(text.slice(0, 100) || `请求失败 (${res.status})`);
  }

  document.getElementById('btn-submit').addEventListener('click', async () => {
    const services = getSelectedServices();
    const wechat = document.getElementById('wechat').value.trim();
    const notes = document.getElementById('notes').value.trim();
    const date = dateInput.value;
    const time = document.querySelector('input[name="time"]:checked')?.value;

    if (!services.length) {
      showToast('请至少选择一项服务');
      setStep(1);
      return;
    }
    if (!date || !time) {
      showToast('请选择日期和时间');
      setStep(2);
      return;
    }
    if (!wechat) {
      showToast('请填写微信号');
      return;
    }

    const btn = document.getElementById('btn-submit');
    btn.disabled = true;
    btn.textContent = '提交中…';

    try {
      const images =
        typeof window.getReferenceImages === 'function' ? window.getReferenceImages() : [];

      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ services, date, time, wechat, notes }),
      });
      const data = await parseJsonResponse(res);
      lastSubmittedDate = date;
      lastSubmittedTime = time;
      lastSubmittedWechat = wechat;
      if (!res.ok) throw new Error(data.error || '提交失败');

      if (images.length > 0) {
        const imgRes = await fetch(`/api/bookings/${data.id}/images`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ images }),
        });
        const imgData = await parseJsonResponse(imgRes);
        if (!imgRes.ok) {
          showToast(imgData.error || '参考图上传失败，预约已提交');
        }
      }

      if (typeof window.clearReferenceImages === 'function') {
        window.clearReferenceImages();
      }
      const successDate = document.getElementById('success-date');
      const successTime = document.getElementById('success-time');
      const successWechat = document.getElementById('success-customer-wechat');
      if (successDate) successDate.textContent = date || '-';
      if (successTime) successTime.textContent = String(time || '-').replace('-', '~');
      if (successWechat) successWechat.textContent = wechat || '-';
      const cancelDateInput = document.getElementById('cancel-date');
      const cancelTimeInput = document.getElementById('cancel-time');
      const cancelWechatInput = document.getElementById('cancel-wechat');
      if (cancelDateInput) cancelDateInput.value = date || '';
      if (cancelTimeInput) cancelTimeInput.value = String(time || '');
      if (cancelWechatInput) cancelWechatInput.value = wechat;
      document.getElementById('booking-form-wrap').classList.add('hidden');
      document.getElementById('success-wrap').classList.remove('hidden');
    } catch (e) {
      showToast(e.message || '网络错误，请稍后重试');
      btn.disabled = false;
      btn.textContent = '提交预约';
    }
  });

  const copyWechatBtn = document.getElementById('success-copy-wechat');
  if (copyWechatBtn) {
    copyWechatBtn.addEventListener('click', async () => {
      const wechat = document.querySelector('[data-setting="contact_wechat"]')?.textContent?.trim() || '';
      if (!wechat || wechat === '-') {
        showToast('店主微信暂未设置');
        return;
      }
      const ok = await copyText(wechat);
      showToast(ok ? '店主微信已复制' : '复制失败，请手动复制');
    });
  }

  async function cancelBookingByClient(date, time, wechat) {
    const res = await fetch('/api/bookings/cancel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ date, time, wechat }),
    });
    const data = await parseJsonResponse(res);
    if (!res.ok) throw new Error(data.error || '取消失败');
    return data;
  }

  async function lookupClientBookings(wechat) {
    const res = await fetch(
      `/api/bookings/client?wechat=${encodeURIComponent(wechat)}`
    );
    const data = await parseJsonResponse(res);
    if (!res.ok) throw new Error(data.error || '查询失败');
    return Array.isArray(data) ? data : [];
  }

  async function cancelBookingById(id, wechat) {
    const res = await fetch('/api/bookings/cancel-by-id', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ id, wechat }),
    });
    const data = await parseJsonResponse(res);
    if (!res.ok) throw new Error(data.error || '取消失败');
    return data;
  }

  const cancelBtn = document.getElementById('btn-cancel-booking');
  if (cancelBtn) {
    cancelBtn.addEventListener('click', async () => {
      const date = document.getElementById('cancel-date')?.value || '';
      const time = document.getElementById('cancel-time')?.value?.trim() || '';
      const wechat = document.getElementById('cancel-wechat')?.value?.trim() || '';
      if (!date || !time || !wechat) {
        showToast('请填写预约日期、时段和微信号');
        return;
      }
      cancelBtn.disabled = true;
      cancelBtn.textContent = '取消中...';
      try {
        await cancelBookingByClient(date, time, wechat);
        showToast('预约已取消');
        updateTimeSlotAvailability();
      } catch (e) {
        showToast(e.message || '取消失败，请稍后重试');
      } finally {
        cancelBtn.disabled = false;
        cancelBtn.textContent = '确认取消预约';
      }
    });
  }

  const quickCancelBtn = document.getElementById('success-cancel-booking');
  if (quickCancelBtn) {
    quickCancelBtn.addEventListener('click', async () => {
      if (!lastSubmittedDate || !lastSubmittedTime || !lastSubmittedWechat) {
        showToast('找不到本次预约信息');
        return;
      }
      quickCancelBtn.disabled = true;
      quickCancelBtn.textContent = '取消中...';
      try {
        await cancelBookingByClient(lastSubmittedDate, lastSubmittedTime, lastSubmittedWechat);
        showToast('本次预约已取消');
        updateTimeSlotAvailability();
      } catch (e) {
        showToast(e.message || '取消失败，请稍后重试');
      } finally {
        quickCancelBtn.disabled = false;
        quickCancelBtn.textContent = '取消本次预约';
      }
    });
  }

  function renderClientBookings(rows, wechat) {
    const list = document.getElementById('client-bookings-list');
    const empty = document.getElementById('client-bookings-empty');
    if (!list || !empty) return;
    list.innerHTML = '';
    if (!rows.length) {
      empty.textContent = '暂无查询结果';
      return;
    }
    empty.textContent = `共找到 ${rows.length} 条预约`;
    rows.forEach((row) => {
      const card = document.createElement('article');
      card.className = 'client-booking-card';
      const status = row.status || '待联系';
      card.innerHTML = `
        <div class="client-booking-row"><span>预约编号</span><strong>${row.id}</strong></div>
        <div class="client-booking-main">${row.date} ${String(row.time || '').replace('-', '~')}</div>
        <div class="client-booking-row"><span>状态</span><strong>${status}</strong></div>
        <div class="form-nav" style="margin-top:10px">
          <button type="button" class="btn-secondary" data-client-cancel-id="${row.id}" style="flex:1">取消这条预约</button>
        </div>
      `;
      list.appendChild(card);
    });
    list.querySelectorAll('[data-client-cancel-id]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = Number(btn.getAttribute('data-client-cancel-id'));
        if (!Number.isInteger(id) || id < 1) return;
        btn.disabled = true;
        btn.textContent = '取消中...';
        try {
          await cancelBookingById(id, wechat);
          showToast('预约已取消');
          updateTimeSlotAvailability();
          const refreshed = await lookupClientBookings(wechat);
          renderClientBookings(refreshed, wechat);
        } catch (e) {
          showToast(e.message || '取消失败，请稍后重试');
          btn.disabled = false;
          btn.textContent = '取消这条预约';
        }
      });
    });
  }

  const lookupBtn = document.getElementById('btn-lookup-bookings');
  if (lookupBtn) {
    lookupBtn.addEventListener('click', async () => {
      const wechat = document.getElementById('lookup-wechat')?.value?.trim() || '';
      if (!wechat) {
        showToast('请填写微信号');
        return;
      }
      lookupBtn.disabled = true;
      lookupBtn.textContent = '查询中...';
      try {
        const rows = await lookupClientBookings(wechat);
        renderClientBookings(rows, wechat);
      } catch (e) {
        showToast(e.message || '查询失败，请稍后重试');
      } finally {
        lookupBtn.disabled = false;
        lookupBtn.textContent = '查看我的预约';
      }
    });
  }

  loadServicesData().then(renderServices);
  updateTimeSlotAvailability();
})();
