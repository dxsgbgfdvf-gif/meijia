(function () {
  const MAX_IMAGES = 3;
  const MAX_WIDTH = 1200;
  const QUALITY = 0.82;
  const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  const ALLOWED_EXT = /\.(jpe?g|png|webp)$/i;

  /** @type {{ id: string, dataUrl: string, name: string }[]} */
  let images = [];

  const input = document.getElementById('ref-images-input');
  const trigger = document.getElementById('upload-trigger');
  const preview = document.getElementById('upload-preview');
  const countEl = document.getElementById('upload-count');

  if (!input || !trigger) return;

  function uid() {
    return `img-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function updateCount() {
    if (countEl) countEl.textContent = `${images.length} / ${MAX_IMAGES}`;
    trigger.disabled = images.length >= MAX_IMAGES;
    trigger.classList.toggle('is-disabled', images.length >= MAX_IMAGES);
  }

  function isAllowed(file) {
    return ALLOWED_TYPES.includes(file.type) || ALLOWED_EXT.test(file.name);
  }

  function compressImage(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          let w = img.width;
          let h = img.height;
          if (w > MAX_WIDTH) {
            h = Math.round((h * MAX_WIDTH) / w);
            w = MAX_WIDTH;
          }
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, w, h);
          const usePng = file.type === 'image/png' || /\.png$/i.test(file.name);
          const mime = usePng ? 'image/png' : 'image/jpeg';
          const dataUrl = canvas.toDataURL(mime, usePng ? undefined : QUALITY);
          resolve({ dataUrl, name: file.name });
        };
        img.onerror = () => reject(new Error('图片解析失败'));
        img.src = e.target.result;
      };
      reader.onerror = () => reject(new Error('文件读取失败'));
      reader.readAsDataURL(file);
    });
  }

  function renderPreview() {
    preview.innerHTML = '';
    images.forEach((item) => {
      const wrap = document.createElement('div');
      wrap.className = 'preview-item';
      wrap.innerHTML = `
        <img src="${item.dataUrl}" alt="参考图预览" />
        <button type="button" class="preview-remove" data-id="${item.id}" aria-label="删除图片">×</button>
      `;
      preview.appendChild(wrap);
    });
    updateCount();
  }

  function removeImage(id) {
    images = images.filter((i) => i.id !== id);
    renderPreview();
  }

  async function addFiles(fileList) {
    const files = [...fileList];
    const remaining = MAX_IMAGES - images.length;
    if (remaining <= 0) {
      window.bookingShowToast?.('最多上传 3 张参考图');
      return;
    }
    const toAdd = files.slice(0, remaining);
    if (files.length > remaining) {
      window.bookingShowToast?.(`最多还能上传 ${remaining} 张`);
    }

    for (const file of toAdd) {
      if (!isAllowed(file)) {
        window.bookingShowToast?.('仅支持 JPG、PNG、WEBP 格式');
        continue;
      }
      if (file.size > 12 * 1024 * 1024) {
        window.bookingShowToast?.('单张图片不能超过 12MB');
        continue;
      }
      try {
        trigger.classList.add('is-loading');
        const { dataUrl, name } = await compressImage(file);
        images.push({ id: uid(), dataUrl, name });
        renderPreview();
      } catch (err) {
        window.bookingShowToast?.(err.message || '图片处理失败');
      } finally {
        trigger.classList.remove('is-loading');
      }
    }
    input.value = '';
  }

  trigger.addEventListener('click', () => {
    if (images.length >= MAX_IMAGES) return;
    input.click();
  });

  input.addEventListener('change', () => {
    if (input.files?.length) addFiles(input.files);
  });

  preview.addEventListener('click', (e) => {
    const btn = e.target.closest('.preview-remove');
    if (btn) removeImage(btn.dataset.id);
  });

  updateCount();

  window.getReferenceImages = function () {
    return images.map((i) => ({ data: i.dataUrl, name: i.name }));
  };

  window.clearReferenceImages = function () {
    images = [];
    renderPreview();
  };
})();
