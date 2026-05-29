(function () {
  const grid = document.getElementById('works-grid');
  if (!grid) return;

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str == null ? '' : String(str);
    return div.innerHTML;
  }

  function renderFromApi(works) {
    if (!Array.isArray(works) || works.length === 0) return;
    grid.innerHTML = works
      .map((work) => {
        const image = work.image
          ? `<img src="${escapeHtml(work.image)}" alt="${escapeHtml(work.title)}" loading="lazy" />`
          : `<div class="work-admin-empty">无图片</div>`;
        return `
          <article class="work-card ${work.image ? 'work-card-photo' : ''}">
            <div class="work-cover">${image}</div>
            <div class="work-info">
              <span class="work-tag">${escapeHtml(work.tag || '作品')}</span>
              <h3>${escapeHtml(work.title || '未命名作品')}</h3>
              <p>${escapeHtml(work.description || '欢迎在预约时备注喜欢的风格。')}</p>
            </div>
          </article>
        `;
      })
      .join('');
  }

  async function loadWorks() {
    try {
      const res = await fetch('/api/works');
      const data = await res.json();
      if (!res.ok) return;
      renderFromApi(data);
    } catch {
      // Keep static fallback cards on network errors.
    }
  }

  loadWorks();
})();
