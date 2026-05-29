(function () {
  async function loadSettings() {
    try {
      const res = await fetch('/api/site-settings');
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }

  function setText(selector, text) {
    if (!text) return;
    document.querySelectorAll(selector).forEach((el) => {
      el.textContent = text;
    });
  }

  function renderRules(rules) {
    if (!Array.isArray(rules) || rules.length === 0) return;
    const list = document.querySelector('[data-setting="rules_list"]');
    if (!list) return;
    list.innerHTML = rules
      .map(
        (rule, idx) => `
          <li>
            <span class="rule-num">${idx + 1}</span>
            <span>${String(rule)}</span>
          </li>
        `
      )
      .join('');
  }

  function applySettings(data) {
    if (!data) return;
    setText('[data-setting="store_name"]', data.store_name);
    setText('[data-setting="hero_badge"]', data.hero_badge);
    setText('[data-setting="hero_title"]', data.hero_title);
    setText('[data-setting="hero_subtitle"]', data.hero_subtitle);
    setText('[data-setting="hero_desc"]', data.hero_desc);
    setText('[data-setting="booking_notice"]', data.booking_notice);
    setText('[data-setting="booking_success"]', data.booking_success);
    setText('[data-setting="works_intro"]', data.works_intro);
    setText('[data-setting="contact_title"]', data.contact_title || '有问题直接联系我');
    setText('[data-setting="contact_wechat"]', data.contact_wechat || '-');
    setText('[data-setting="contact_phone"]', data.contact_phone || '-');
    setText('[data-setting="contact_note"]', data.contact_note || '有问题可直接加微信联系');
    const qr = document.getElementById('contact-qr-image');
    if (qr) {
      if (data.contact_qr) {
        qr.src = data.contact_qr;
        qr.hidden = false;
      } else {
        qr.hidden = true;
      }
    }
    renderRules(data.rules);
    if (data.store_name) {
      document.title = document.title.replace(/奶油指尖/g, data.store_name);
    }
  }

  loadSettings().then(applySettings);
})();
