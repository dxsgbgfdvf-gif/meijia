const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'meijia2025';

const dataDir = process.env.DATA_DIR || (process.env.VERCEL ? '/tmp/data' : path.join(__dirname, 'data'));
const uploadsDir = path.join(dataDir, 'uploads');
const worksDir = path.join(dataDir, 'works');
const settingsDir = path.join(dataDir, 'settings');
fs.mkdirSync(dataDir, { recursive: true });
fs.mkdirSync(uploadsDir, { recursive: true });
fs.mkdirSync(worksDir, { recursive: true });
fs.mkdirSync(settingsDir, { recursive: true });

const db = new Database(path.join(dataDir, 'bookings.db'));
db.exec(`
  CREATE TABLE IF NOT EXISTS bookings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    services TEXT NOT NULL,
    date TEXT NOT NULL,
    time TEXT NOT NULL,
    wechat TEXT NOT NULL,
    notes TEXT DEFAULT '',
    images TEXT DEFAULT '[]',
    status TEXT DEFAULT '待联系',
    created_at TEXT DEFAULT (datetime('now', 'localtime'))
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS works (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    tag TEXT DEFAULT '',
    description TEXT DEFAULT '',
    image TEXT DEFAULT '',
    active INTEGER DEFAULT 1,
    sort_order INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now', 'localtime'))
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS site_settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    store_name TEXT DEFAULT '奶油指尖',
    hero_badge TEXT DEFAULT '预约制 · 一客一消毒',
    hero_title TEXT DEFAULT '奶油指尖',
    hero_subtitle TEXT DEFAULT 'NAIL STUDIO',
    hero_desc TEXT DEFAULT '温柔秋日氛围 · 专属指尖美学',
    booking_notice TEXT DEFAULT '提交预约后店主会通过微信联系您，进一步确认时间与款式。',
    booking_success TEXT DEFAULT '我们会尽快通过微信与您确认时间',
    works_intro TEXT DEFAULT '挑一个喜欢的氛围，也可以上传参考图，让款式更接近你想要的感觉。',
    business_start TEXT DEFAULT '10:00',
    business_end TEXT DEFAULT '19:30',
    slot_minutes INTEGER DEFAULT 30,
    custom_slots_json TEXT DEFAULT '[]',
    weekly_closed_json TEXT DEFAULT '[]',
    closed_dates_json TEXT DEFAULT '[]',
    special_open_json TEXT DEFAULT '[]',
    contact_title TEXT DEFAULT '有问题直接联系我',
    contact_wechat TEXT DEFAULT '',
    contact_phone TEXT DEFAULT '',
    contact_note TEXT DEFAULT '',
    contact_qr TEXT DEFAULT '',
    rules_json TEXT DEFAULT '["七天内非人为损坏可免费修补","款式看图收费，复杂款式价格另议","需要提前预约，空降不保证有位","提交后店主会通过微信确认时间","工具一客一消毒，请放心使用"]',
    updated_at TEXT DEFAULT (datetime('now', 'localtime'))
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS services (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category TEXT NOT NULL,
    name TEXT NOT NULL,
    price TEXT NOT NULL,
    suffix TEXT DEFAULT '',
    active INTEGER DEFAULT 1,
    sort_order INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now', 'localtime'))
  )
`);

const BOOKING_STATUSES = ['待联系', '已确认', '已完成', '已取消'];
const DEFAULT_STATUS = '待联系';
const CANCELLED_STATUS = '已取消';

const cols = db.prepare('PRAGMA table_info(bookings)').all();
if (!cols.some((c) => c.name === 'images')) {
  db.exec(`ALTER TABLE bookings ADD COLUMN images TEXT DEFAULT '[]'`);
}
if (!cols.some((c) => c.name === 'status')) {
  db.exec(`ALTER TABLE bookings ADD COLUMN status TEXT DEFAULT '${DEFAULT_STATUS}'`);
}

const workCols = db.prepare('PRAGMA table_info(works)').all();
if (!workCols.some((c) => c.name === 'tag')) {
  db.exec(`ALTER TABLE works ADD COLUMN tag TEXT DEFAULT ''`);
}
if (!workCols.some((c) => c.name === 'description')) {
  db.exec(`ALTER TABLE works ADD COLUMN description TEXT DEFAULT ''`);
}
if (!workCols.some((c) => c.name === 'image')) {
  db.exec(`ALTER TABLE works ADD COLUMN image TEXT DEFAULT ''`);
}
if (!workCols.some((c) => c.name === 'active')) {
  db.exec(`ALTER TABLE works ADD COLUMN active INTEGER DEFAULT 1`);
}
if (!workCols.some((c) => c.name === 'sort_order')) {
  db.exec(`ALTER TABLE works ADD COLUMN sort_order INTEGER DEFAULT 0`);
}

const settingsRow = db.prepare('SELECT id FROM site_settings WHERE id = 1').get();
const settingsCols = db.prepare('PRAGMA table_info(site_settings)').all();
if (!settingsCols.some((c) => c.name === 'business_start')) {
  db.exec(`ALTER TABLE site_settings ADD COLUMN business_start TEXT DEFAULT '10:00'`);
}
if (!settingsCols.some((c) => c.name === 'business_end')) {
  db.exec(`ALTER TABLE site_settings ADD COLUMN business_end TEXT DEFAULT '19:30'`);
}
if (!settingsCols.some((c) => c.name === 'slot_minutes')) {
  db.exec(`ALTER TABLE site_settings ADD COLUMN slot_minutes INTEGER DEFAULT 30`);
}
if (!settingsCols.some((c) => c.name === 'custom_slots_json')) {
  db.exec(`ALTER TABLE site_settings ADD COLUMN custom_slots_json TEXT DEFAULT '[]'`);
}
if (!settingsCols.some((c) => c.name === 'weekly_closed_json')) {
  db.exec(`ALTER TABLE site_settings ADD COLUMN weekly_closed_json TEXT DEFAULT '[]'`);
}
if (!settingsCols.some((c) => c.name === 'closed_dates_json')) {
  db.exec(`ALTER TABLE site_settings ADD COLUMN closed_dates_json TEXT DEFAULT '[]'`);
}
if (!settingsCols.some((c) => c.name === 'special_open_json')) {
  db.exec(`ALTER TABLE site_settings ADD COLUMN special_open_json TEXT DEFAULT '[]'`);
}
if (!settingsCols.some((c) => c.name === 'contact_title')) {
  db.exec(`ALTER TABLE site_settings ADD COLUMN contact_title TEXT DEFAULT '鏈夐棶棰樼洿鎺ヨ仈绯绘垜'`);
}
if (!settingsCols.some((c) => c.name === 'contact_wechat')) {
  db.exec(`ALTER TABLE site_settings ADD COLUMN contact_wechat TEXT DEFAULT ''`);
}
if (!settingsCols.some((c) => c.name === 'contact_phone')) {
  db.exec(`ALTER TABLE site_settings ADD COLUMN contact_phone TEXT DEFAULT ''`);
}
if (!settingsCols.some((c) => c.name === 'contact_note')) {
  db.exec(`ALTER TABLE site_settings ADD COLUMN contact_note TEXT DEFAULT ''`);
}
if (!settingsCols.some((c) => c.name === 'contact_qr')) {
  db.exec(`ALTER TABLE site_settings ADD COLUMN contact_qr TEXT DEFAULT ''`);
}
if (!settingsRow) {
  db.prepare(
    `INSERT INTO site_settings (
      id, store_name, hero_badge, hero_title, hero_subtitle, hero_desc,
      booking_notice, booking_success, works_intro,
      business_start, business_end, slot_minutes, custom_slots_json, weekly_closed_json, closed_dates_json,
      special_open_json,
      contact_title, contact_wechat, contact_phone, contact_note, contact_qr,
      rules_json, updated_at
    ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', 'localtime'))`
  ).run(
    '奶油指尖',
    '预约制 · 一客一消毒',
    '奶油指尖',
    'NAIL STUDIO',
    '温柔秋日氛围 · 专属指尖美学',
    '提交预约后店主会通过微信联系您，进一步确认时间与款式。',
    '我们会尽快通过微信与您确认时间',
    '挑一个喜欢的氛围，也可以上传参考图，让款式更接近你想要的感觉。',
    '10:00',
    '19:30',
    30,
    JSON.stringify([
      '10:00',
      '10:30',
      '11:00',
      '11:30',
      '12:00',
      '12:30',
      '13:00',
      '13:30',
      '14:00',
      '14:30',
      '15:00',
      '15:30',
      '16:00',
      '16:30',
      '17:00',
      '17:30',
      '18:00',
      '18:30',
      '19:00',
      '19:30',
    ]),
    JSON.stringify([]),
    JSON.stringify([]),
    JSON.stringify([]),
    '有问题直接联系我',
    '',
    '',
    '',
    '',
    JSON.stringify([
      '七天内非人为损坏可免费修补',
      '款式看图收费，复杂款式价格另议',
      '需要提前预约，空降不保证有位',
      '提交后店主会通过微信确认时间',
      '工具一客一消毒，请放心使用',
    ])
  );
}

const serviceCols = db.prepare('PRAGMA table_info(services)').all();
if (!serviceCols.some((c) => c.name === 'suffix')) {
  db.exec(`ALTER TABLE services ADD COLUMN suffix TEXT DEFAULT ''`);
}
if (!serviceCols.some((c) => c.name === 'active')) {
  db.exec(`ALTER TABLE services ADD COLUMN active INTEGER DEFAULT 1`);
}
if (!serviceCols.some((c) => c.name === 'sort_order')) {
  db.exec(`ALTER TABLE services ADD COLUMN sort_order INTEGER DEFAULT 0`);
}

const serviceCountRow = db.prepare('SELECT COUNT(*) AS total FROM services').get();
if (!serviceCountRow || !serviceCountRow.total) {
  const seed = [
    ['本甲', '纯色', '29.9', '', 1, 10],
    ['本甲', '款式', '49.9', '起', 1, 20],
    ['甲片', '纯色', '59.9', '', 1, 30],
    ['甲片', '款式', '79.9', '起', 1, 40],
    ['卸甲', '本甲', '10', '', 1, 50],
    ['卸甲', '甲片', '20', '', 1, 60],
    ['建构', '建构', '30', '', 1, 70],
    ['甲片延长', '甲片延长', '99.9', '起', 1, 80],
    ['手部护理', '基础护理', '20', '', 1, 90],
    ['手部护理', '深层护理', '40', '', 1, 100],
  ];
  const stmt = db.prepare(
    'INSERT INTO services (category, name, price, suffix, active, sort_order) VALUES (?, ?, ?, ?, ?, ?)'
  );
  const insertMany = db.transaction((rows) => {
    rows.forEach((row) => stmt.run(...row));
  });
  insertMany(seed);
}

function getServices(activeOnly) {
  const where = activeOnly ? 'WHERE active = 1' : '';
  const rows = db
    .prepare(
      `SELECT id, category, name, price, suffix, active, sort_order
       FROM services ${where} ORDER BY sort_order ASC, id ASC`
    )
    .all();
  return rows;
}

function formatServicesForClient(rows) {
  const map = new Map();
  rows.forEach((row) => {
    if (!map.has(row.category)) {
      map.set(row.category, { category: row.category, items: [] });
    }
    map.get(row.category).items.push({
      id: `svc-${row.id}`,
      serviceId: row.id,
      name: row.name,
      price: row.price,
      suffix: row.suffix || '',
    });
  });
  return Array.from(map.values());
}

function getSiteSettings() {
  const row = db.prepare('SELECT * FROM site_settings WHERE id = 1').get();
  if (!row) return null;
  let rules = [];
  let weeklyClosed = [];
  let closedDates = [];
  let specialOpen = [];
  let customSlots = [];
  try {
    rules = JSON.parse(row.rules_json || '[]');
  } catch {
    rules = [];
  }
  try {
    weeklyClosed = JSON.parse(row.weekly_closed_json || '[]');
  } catch {
    weeklyClosed = [];
  }
  try {
    closedDates = JSON.parse(row.closed_dates_json || '[]');
  } catch {
    closedDates = [];
  }
  try {
    specialOpen = JSON.parse(row.special_open_json || '[]');
  } catch {
    specialOpen = [];
  }
  try {
    customSlots = JSON.parse(row.custom_slots_json || '[]');
  } catch {
    customSlots = [];
  }
  return {
    store_name: row.store_name || '濂舵补鎸囧皷',
    hero_badge: row.hero_badge || '',
    hero_title: row.hero_title || '',
    hero_subtitle: row.hero_subtitle || '',
    hero_desc: row.hero_desc || '',
    booking_notice: row.booking_notice || '',
    booking_success: row.booking_success || '',
    works_intro: row.works_intro || '',
    business_start: row.business_start || '10:00',
    business_end: row.business_end || '19:30',
    slot_minutes: Number(row.slot_minutes) || 30,
    custom_slots: Array.isArray(customSlots) ? customSlots : [],
    weekly_closed: Array.isArray(weeklyClosed) ? weeklyClosed : [],
    closed_dates: Array.isArray(closedDates) ? closedDates : [],
    special_open: Array.isArray(specialOpen) ? specialOpen : [],
    contact_title: row.contact_title || '鏈夐棶棰樼洿鎺ヨ仈绯绘垜',
    contact_wechat: row.contact_wechat || '',
    contact_phone: row.contact_phone || '',
    contact_note: row.contact_note || '',
    contact_qr: row.contact_qr || '',
    rules,
    updated_at: row.updated_at,
  };
}

function parseHm(hm) {
  const normalized = String(hm || '').replace('：', ':').trim();
  const m = normalized.match(/^(\d{1,2}):(\d{1,2})$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return h * 60 + min;
}

function minutesToHm(totalMinutes) {
  const h = String(Math.floor(totalMinutes / 60)).padStart(2, '0');
  const m = String(totalMinutes % 60).padStart(2, '0');
  return `${h}:${m}`;
}

function generateTimeSlots(start, end, interval) {
  const startMin = parseHm(start);
  const endMin = parseHm(end);
  const step = Number(interval) || 30;
  if (startMin == null || endMin == null || step < 5 || startMin > endMin) return [];
  const slots = [];
  for (let t = startMin; t <= endMin; t += step) {
    slots.push(minutesToHm(t));
  }
  return slots;
}

function normalizeWeekdayList(values) {
  if (!Array.isArray(values)) return [];
  return values
    .map((v) => Number(v))
    .filter((v) => Number.isInteger(v) && v >= 0 && v <= 6)
    .filter((v, idx, arr) => arr.indexOf(v) === idx);
}

function normalizeClosedDates(values) {
  if (!Array.isArray(values)) return [];
  return values
    .map((v) => String(v || '').trim())
    .filter((v) => /^\d{4}-\d{2}-\d{2}$/.test(v))
    .filter((v, idx, arr) => arr.indexOf(v) === idx);
}

function normalizeSpecialOpen(values) {
  if (!Array.isArray(values)) return [];
  return values
    .map((v) => ({
      date: String(v?.date || '').trim(),
      start: String(v?.start || '').trim(),
      end: String(v?.end || '').trim(),
    }))
    .filter((v) => /^\d{4}-\d{2}-\d{2}$/.test(v.date))
    .filter((v) => parseHm(v.start) != null && parseHm(v.end) != null && parseHm(v.start) <= parseHm(v.end));
}

function normalizeSlots(values) {
  if (!Array.isArray(values)) return [];
  return values
    .map((v) => parseHm(v))
    .filter((v) => v != null)
    .map((v) => minutesToHm(v))
    .filter((v, idx, arr) => arr.indexOf(v) === idx)
    .sort((a, b) => parseHm(a) - parseHm(b));
}

function isDateClosed(dateStr, settings) {
  const d = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(d.getTime())) return { closed: true, reason: '鏃ユ湡鏃犳晥' };
  if (settings.closed_dates.includes(dateStr)) return { closed: true, reason: '褰撳ぉ搴椾紤' };
  if (settings.weekly_closed.includes(d.getDay())) return { closed: true, reason: '褰撳懆搴椾紤' };
  return { closed: false, reason: '' };
}

function getSpecialSlotsForDate(dateStr, settings) {
  const special = normalizeSpecialOpen(settings.special_open || []);
  const matched = special.filter((s) => s.date === dateStr);
  if (!matched.length) return [];
  const slotMinutes = Number(settings.slot_minutes) || 30;
  const all = matched.flatMap((s) => generateTimeSlots(s.start, s.end, slotMinutes));
  return Array.from(new Set(all)).sort();
}

function getSpecialWindowsForDate(dateStr, settings) {
  const special = normalizeSpecialOpen(settings.special_open || []);
  return special
    .filter((s) => s.date === dateStr)
    .map((s) => `${s.start}-${s.end}`)
    .filter((v, idx, arr) => arr.indexOf(v) === idx)
    .sort((a, b) => parseHm(a.split('-')[0]) - parseHm(b.split('-')[0]));
}

function saveWorkImage(workId, imageData) {
  if (!imageData || typeof imageData !== 'string') return '';
  const match = imageData.match(/^data:image\/([\w+]+);base64,(.+)$/);
  if (!match) return '';
  let ext = match[1].toLowerCase();
  if (ext === 'jpeg') ext = 'jpg';
  if (!['jpg', 'png', 'webp'].includes(ext)) ext = 'jpg';
  const filename = `${workId}.${ext}`;
  fs.writeFileSync(path.join(worksDir, filename), Buffer.from(match[2], 'base64'));
  return `/works/${filename}`;
}

function deleteWorkImageByPath(imagePath) {
  if (!imagePath || typeof imagePath !== 'string') return;
  const filename = path.basename(imagePath);
  const full = path.join(worksDir, filename);
  if (fs.existsSync(full)) fs.rmSync(full, { force: true });
}

function saveSettingImage(name, imageData) {
  if (!imageData || typeof imageData !== 'string') return '';
  const match = imageData.match(/^data:image\/([\w+]+);base64,(.+)$/);
  if (!match) return '';
  let ext = match[1].toLowerCase();
  if (ext === 'jpeg') ext = 'jpg';
  if (!['jpg', 'png', 'webp'].includes(ext)) ext = 'jpg';
  const filename = `${name}.${ext}`;
  const fullPath = path.join(settingsDir, filename);
  ['jpg', 'png', 'webp'].forEach((candidate) => {
    const oldPath = path.join(settingsDir, `${name}.${candidate}`);
    if (oldPath !== fullPath && fs.existsSync(oldPath)) {
      fs.rmSync(oldPath, { force: true });
    }
  });
  fs.writeFileSync(fullPath, Buffer.from(match[2], 'base64'));
  return `/settings/${filename}`;
}

function deleteSettingImageByPath(imagePath) {
  if (!imagePath || typeof imagePath !== 'string') return;
  const filename = path.basename(imagePath);
  const full = path.join(settingsDir, filename);
  if (fs.existsSync(full)) fs.rmSync(full, { force: true });
}

function hasActiveBookingConflict(date, time, excludeId) {
  const row = db
    .prepare(
      `SELECT id FROM bookings
       WHERE date = ? AND time = ? AND status != ?
       ${excludeId ? 'AND id != ?' : ''}
       LIMIT 1`
    )
    .get(...(excludeId ? [date, time, CANCELLED_STATUS, excludeId] : [date, time, CANCELLED_STATUS]));
  return Boolean(row);
}

function saveBookingImages(bookingId, images) {
  if (!images?.length) return [];
  const dir = path.join(uploadsDir, String(bookingId));
  fs.mkdirSync(dir, { recursive: true });
  const saved = [];
  images.forEach((img, i) => {
    const raw = img.data || img;
    const match = String(raw).match(/^data:image\/([\w+]+);base64,(.+)$/);
    if (!match) return;
    let ext = match[1].toLowerCase();
    if (ext === 'jpeg') ext = 'jpg';
    if (!['jpg', 'png', 'webp'].includes(ext)) ext = 'jpg';
    const filename = `ref-${i + 1}.${ext}`;
    fs.writeFileSync(path.join(dir, filename), Buffer.from(match[2], 'base64'));
    saved.push(`/uploads/${bookingId}/${filename}`);
  });
  return saved;
}

function deleteBookingImages(bookingId) {
  const dir = path.join(uploadsDir, String(bookingId));
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
}

function normalizeWechat(value) {
  return String(value || '')
    .trim()
    .replace(/^@+/, '')
    .replace(/\s+/g, '')
    .toLowerCase();
}

const jsonSmall = express.json({ limit: '256kb' });
const jsonImages = express.json({ limit: '30mb' });

app.use(cors());

/* API 璺敱蹇呴』鍦?static 涔嬪墠锛岄伩鍏嶈繑鍥?HTML */
app.post('/api/bookings', jsonSmall, (req, res) => {
  try {
    const { services, date, time, wechat, notes } = req.body;
    if (!services?.length || !date || !time || !wechat?.trim()) {
      return res.status(400).json({ error: '请完整填写预约信息' });
    }
    const settings = getSiteSettings() || {};
    const windows = getSpecialWindowsForDate(date, settings);
    if (!windows.length) {
      return res.status(400).json({ error: '璇ユ棩鏈熸湭寮€鏀惧彲棰勭害鏃舵锛岃閫夋嫨鍏朵粬鏃ユ湡' });
    }
    if (!windows.includes(String(time))) {
      return res.status(400).json({ error: '璇烽€夋嫨鏈夋晥鐨勯绾︽椂闂存' });
    }
    if (hasActiveBookingConflict(date, time)) {
      return res.status(409).json({ error: '璇ユ椂闂存宸茶棰勭害锛岃閫夋嫨鍏朵粬鏃堕棿' });
    }
    const stmt = db.prepare(
      'INSERT INTO bookings (services, date, time, wechat, notes, images, status) VALUES (?, ?, ?, ?, ?, ?, ?)'
    );
    const result = stmt.run(
      JSON.stringify(services),
      date,
      time,
      wechat.trim(),
      (notes || '').trim(),
      '[]',
      DEFAULT_STATUS
    );
    res.json({ id: result.lastInsertRowid, message: '棰勭害鎻愪氦鎴愬姛' });
  } catch (err) {
    console.error('POST /api/bookings', err);
    res.status(500).json({ error: '棰勭害淇濆瓨澶辫触' });
  }
});

app.post('/api/bookings/:id/images', jsonImages, (req, res) => {
  try {
    const bookingId = Number(req.params.id);
    const { images } = req.body;

    if (!Number.isInteger(bookingId) || bookingId < 1) {
      return res.status(400).json({ error: '无效的预约编号' });
    }
    if (!images?.length) {
      return res.status(400).json({ error: '没有可上传的图片' });
    }
    if (images.length > 3) {
      return res.status(400).json({ error: '最多上传 3 张参考图' });
    }

    const row = db.prepare('SELECT id FROM bookings WHERE id = ?').get(bookingId);
    if (!row) {
      return res.status(404).json({ error: '预约不存在' });
    }

    deleteBookingImages(bookingId);
    const imagePaths = saveBookingImages(bookingId, images);
    if (!imagePaths.length) {
      return res.status(400).json({ error: '图片格式无效，请使用 JPG / PNG / WEBP' });
    }

    db.prepare('UPDATE bookings SET images = ? WHERE id = ?').run(
      JSON.stringify(imagePaths),
      bookingId
    );
    res.json({ images: imagePaths, message: '鍙傝€冨浘涓婁紶鎴愬姛' });
  } catch (err) {
    console.error('POST /api/bookings/:id/images', err);
    res.status(500).json({ error: '鍙傝€冨浘淇濆瓨澶辫触' });
  }
});

app.post('/api/bookings/cancel', jsonSmall, (req, res) => {
  try {
    const { date, time, wechat } = req.body || {};
    const dateText = String(date || '').trim();
    const timeText = String(time || '').trim();
    const wechatText = normalizeWechat(wechat);
    if (!dateText || !timeText || !wechatText) {
      return res.status(400).json({ error: '请填写预约日期、时段和微信号' });
    }

    const row = db
      .prepare(
        `SELECT id, wechat, status, date, time
         FROM bookings
         WHERE date = ? AND time = ? AND status != ?
         ORDER BY id DESC
         LIMIT 1`
      )
      .get(dateText, timeText, CANCELLED_STATUS);

    if (!row) {
      return res.status(404).json({ error: '未找到可取消的预约，请检查日期和时段' });
    }
    if (normalizeWechat(row.wechat) !== wechatText) {
      return res.status(403).json({ error: '微信号不匹配，请确认后再试' });
    }

    deleteBookingImages(row.id);
    db.prepare('DELETE FROM bookings WHERE id = ?').run(row.id);
    return res.json({
      id: row.id,
      date: row.date,
      time: row.time,
      status: 'deleted',
      message: '预约已取消',
    });
  } catch (err) {
    console.error('POST /api/bookings/cancel', err);
    return res.status(500).json({ error: '取消失败，请稍后重试' });
  }
});

app.get('/api/bookings/client', jsonSmall, (req, res) => {
  try {
    const wechatText = normalizeWechat(req.query?.wechat || '');
    if (!wechatText) {
      return res.status(400).json({ error: '请填写微信号' });
    }
    const rows = db
      .prepare(
        `SELECT id, services, date, time, wechat, notes, status, created_at
         FROM bookings
         ORDER BY date DESC, time DESC, id DESC`
      )
      .all()
      .filter((row) => normalizeWechat(row.wechat) === wechatText)
      .slice(0, 20)
      .map((row) => ({
        ...row,
        services: row.services ? JSON.parse(row.services) : [],
      }));
    return res.json(rows);
  } catch (err) {
    console.error('GET /api/bookings/client', err);
    return res.status(500).json({ error: '查询失败，请稍后重试' });
  }
});

app.post('/api/bookings/cancel-by-id', jsonSmall, (req, res) => {
  try {
    const id = Number(req.body?.id);
    const wechatText = normalizeWechat(req.body?.wechat || '');
    if (!Number.isInteger(id) || id < 1 || !wechatText) {
      return res.status(400).json({ error: '请填写正确的预约信息' });
    }
    const row = db
      .prepare('SELECT id, date, time, wechat FROM bookings WHERE id = ?')
      .get(id);
    if (!row) {
      return res.status(404).json({ error: '预约不存在或已取消' });
    }
    if (normalizeWechat(row.wechat) !== wechatText) {
      return res.status(403).json({ error: '微信号不匹配，请确认后再试' });
    }
    deleteBookingImages(row.id);
    db.prepare('DELETE FROM bookings WHERE id = ?').run(row.id);
    return res.json({ id: row.id, date: row.date, time: row.time, status: 'deleted' });
  } catch (err) {
    console.error('POST /api/bookings/cancel-by-id', err);
    return res.status(500).json({ error: '取消失败，请稍后重试' });
  }
});

app.get('/api/works', (req, res) => {
  const rows = db
    .prepare(
      'SELECT id, title, tag, description, image, active, sort_order, created_at FROM works WHERE active = 1 ORDER BY sort_order ASC, id DESC'
    )
    .all();
  res.json(rows);
});

app.get('/api/services', (req, res) => {
  const rows = getServices(true);
  res.json(formatServicesForClient(rows));
});

app.get('/api/admin/services', jsonSmall, (req, res) => {
  const { password } = req.query;
  if (password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: '瀵嗙爜閿欒' });
  }
  res.json(getServices(false));
});

app.post('/api/admin/services', jsonSmall, (req, res) => {
  const { password } = req.query;
  if (password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: '瀵嗙爜閿欒' });
  }
  const { category, name, price, suffix, active, sortOrder } = req.body;
  if (!category?.trim() || !name?.trim() || !price?.trim()) {
    return res.status(400).json({ error: '璇峰～鍐欏垎绫汇€侀」鐩拰浠锋牸' });
  }
  const result = db
    .prepare(
      'INSERT INTO services (category, name, price, suffix, active, sort_order) VALUES (?, ?, ?, ?, ?, ?)'
    )
    .run(
      category.trim(),
      name.trim(),
      price.trim(),
      (suffix || '').trim(),
      active ? 1 : 0,
      Number.isFinite(Number(sortOrder)) ? Number(sortOrder) : 0
    );
  const row = db
    .prepare(
      'SELECT id, category, name, price, suffix, active, sort_order FROM services WHERE id = ?'
    )
    .get(Number(result.lastInsertRowid));
  res.json(row);
});

app.patch('/api/admin/services/:id', jsonSmall, (req, res) => {
  const { password } = req.query;
  if (password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: '密码错误' });
  }
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    return res.status(400).json({ error: '无效的项目编号' });
  }
  const current = db.prepare('SELECT id FROM services WHERE id = ?').get(id);
  if (!current) {
    return res.status(404).json({ error: '项目不存在' });
  }
  const { category, name, price, suffix, active, sortOrder } = req.body;
  if (!category?.trim() || !name?.trim() || !price?.trim()) {
    return res.status(400).json({ error: '请填写分类、项目和价格' });
  }
  db.prepare(
    'UPDATE services SET category = ?, name = ?, price = ?, suffix = ?, active = ?, sort_order = ? WHERE id = ?'
  ).run(
    category.trim(),
    name.trim(),
    price.trim(),
    (suffix || '').trim(),
    active ? 1 : 0,
    Number.isFinite(Number(sortOrder)) ? Number(sortOrder) : 0,
    id
  );
  const row = db
    .prepare(
      'SELECT id, category, name, price, suffix, active, sort_order FROM services WHERE id = ?'
    )
    .get(id);
  res.json(row);
});

app.delete('/api/admin/services/:id', jsonSmall, (req, res) => {
  const { password } = req.query;
  if (password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: '密码错误' });
  }
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    return res.status(400).json({ error: '无效的项目编号' });
  }
  const row = db.prepare('SELECT id FROM services WHERE id = ?').get(id);
  if (!row) {
    return res.status(404).json({ error: '项目不存在' });
  }
  db.prepare('DELETE FROM services WHERE id = ?').run(id);
  res.json({ message: '已删除' });
});

app.get('/api/site-settings', (req, res) => {
  const settings = getSiteSettings();
  res.json(settings || {});
});

app.get('/api/admin/site-settings', jsonSmall, (req, res) => {
  const { password } = req.query;
  if (password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: '瀵嗙爜閿欒' });
  }
  const settings = getSiteSettings();
  res.json(settings || {});
});

app.patch('/api/admin/site-settings', jsonSmall, (req, res) => {
  const { password } = req.query;
  if (password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: '瀵嗙爜閿欒' });
  }
  const current = getSiteSettings();
  if (!current) {
    return res.status(500).json({ error: '璁剧疆璇诲彇澶辫触' });
  }
  const {
    store_name,
    hero_badge,
    hero_title,
    hero_subtitle,
    hero_desc,
    booking_notice,
    booking_success,
    works_intro,
    special_open,
    contact_title,
    contact_wechat,
    contact_phone,
    contact_note,
    contact_qr_image,
    clear_contact_qr,
    rules,
  } = req.body;

  const normalizedRules = Array.isArray(rules)
    ? rules.map((s) => String(s || '').trim()).filter(Boolean).slice(0, 10)
    : current.rules;
  const normalizedSpecialOpen = normalizeSpecialOpen(special_open ?? current.special_open);
  const invalidSpecial = normalizedSpecialOpen.find((w) => !generateTimeSlots(w.start, w.end, 30).length);
  if (invalidSpecial) {
    return res.status(400).json({ error: '鎸囧畾寮€鏀炬椂闂存鏃犳晥锛岃妫€鏌ユ棩鏈熷拰鏃堕棿鑼冨洿' });
  }
  let contactQr = current.contact_qr || '';
  if (clear_contact_qr) {
    deleteSettingImageByPath(contactQr);
    contactQr = '';
  }
  if (typeof contact_qr_image === 'string' && contact_qr_image.startsWith('data:image/')) {
    const saved = saveSettingImage('contact-qr', contact_qr_image);
    if (saved) {
      deleteSettingImageByPath(contactQr);
      contactQr = saved;
    }
  }

  db.prepare(
    `UPDATE site_settings SET
      store_name = ?,
      hero_badge = ?,
      hero_title = ?,
      hero_subtitle = ?,
      hero_desc = ?,
      booking_notice = ?,
      booking_success = ?,
      works_intro = ?,
      special_open_json = ?,
      weekly_closed_json = '[]',
      closed_dates_json = '[]',
      contact_title = ?,
      contact_wechat = ?,
      contact_phone = ?,
      contact_note = ?,
      contact_qr = ?,
      rules_json = ?,
      updated_at = datetime('now', 'localtime')
    WHERE id = 1`
  ).run(
    (store_name || current.store_name || '濂舵补鎸囧皷').trim(),
    (hero_badge || '').trim(),
    (hero_title || '').trim(),
    (hero_subtitle || '').trim(),
    (hero_desc || '').trim(),
    (booking_notice || '').trim(),
    (booking_success || '').trim(),
    (works_intro || '').trim(),
    JSON.stringify(normalizedSpecialOpen),
    (contact_title ?? current.contact_title ?? '鏈夐棶棰樼洿鎺ヨ仈绯绘垜').trim(),
    (contact_wechat ?? current.contact_wechat ?? '').trim(),
    (contact_phone ?? current.contact_phone ?? '').trim(),
    (contact_note ?? current.contact_note ?? '').trim(),
    contactQr,
    JSON.stringify(normalizedRules)
  );

  res.json(getSiteSettings());
});

app.get('/api/admin/works', jsonSmall, (req, res) => {
  const { password } = req.query;
  if (password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: '密码错误' });
  }
  const rows = db
    .prepare(
      'SELECT id, title, tag, description, image, active, sort_order, created_at FROM works ORDER BY sort_order ASC, id DESC'
    )
    .all();
  res.json(rows);
});

app.post('/api/admin/works', jsonImages, (req, res) => {
  const { password } = req.query;
  if (password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: '密码错误' });
  }
  const { title, tag, description, image, active, sortOrder } = req.body;
  if (!title?.trim()) {
    return res.status(400).json({ error: '请填写作品名称' });
  }
  const result = db
    .prepare(
      'INSERT INTO works (title, tag, description, image, active, sort_order) VALUES (?, ?, ?, ?, ?, ?)'
    )
    .run(
      title.trim(),
      (tag || '').trim(),
      (description || '').trim(),
      '',
      active ? 1 : 0,
      Number.isFinite(Number(sortOrder)) ? Number(sortOrder) : 0
    );
  const id = Number(result.lastInsertRowid);
  let imagePath = '';
  if (image && String(image).startsWith('data:image/')) {
    imagePath = saveWorkImage(id, image);
    if (imagePath) {
      db.prepare('UPDATE works SET image = ? WHERE id = ?').run(imagePath, id);
    }
  }
  const row = db
    .prepare(
      'SELECT id, title, tag, description, image, active, sort_order, created_at FROM works WHERE id = ?'
    )
    .get(id);
  res.json(row);
});

app.patch('/api/admin/works/:id', jsonImages, (req, res) => {
  const { password } = req.query;
  if (password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: '密码错误' });
  }
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    return res.status(400).json({ error: '无效的作品编号' });
  }
  const current = db.prepare('SELECT * FROM works WHERE id = ?').get(id);
  if (!current) {
    return res.status(404).json({ error: '作品不存在' });
  }
  const { title, tag, description, image, active, sortOrder } = req.body;
  if (!title?.trim()) {
    return res.status(400).json({ error: '请填写作品名称' });
  }
  let imagePath = current.image || '';
  if (image === '') {
    deleteWorkImageByPath(imagePath);
    imagePath = '';
  } else if (typeof image === 'string' && image.startsWith('data:image/')) {
    deleteWorkImageByPath(imagePath);
    imagePath = saveWorkImage(id, image);
  }
  db.prepare(
    'UPDATE works SET title = ?, tag = ?, description = ?, image = ?, active = ?, sort_order = ? WHERE id = ?'
  ).run(
    title.trim(),
    (tag || '').trim(),
    (description || '').trim(),
    imagePath,
    active ? 1 : 0,
    Number.isFinite(Number(sortOrder)) ? Number(sortOrder) : 0,
    id
  );
  const row = db
    .prepare(
      'SELECT id, title, tag, description, image, active, sort_order, created_at FROM works WHERE id = ?'
    )
    .get(id);
  res.json(row);
});

app.delete('/api/admin/works/:id', jsonSmall, (req, res) => {
  const { password } = req.query;
  if (password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: '密码错误' });
  }
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    return res.status(400).json({ error: '无效的作品编号' });
  }
  const row = db.prepare('SELECT image FROM works WHERE id = ?').get(id);
  if (!row) {
    return res.status(404).json({ error: '作品不存在' });
  }
  deleteWorkImageByPath(row.image);
  db.prepare('DELETE FROM works WHERE id = ?').run(id);
  res.json({ message: '已删除' });
});

app.get('/api/availability', jsonSmall, (req, res) => {
  const { date } = req.query;
  if (!date || typeof date !== 'string') {
    return res.status(400).json({ error: '请提供预约日期' });
  }
  const settings = getSiteSettings() || {};
  const schedule = {
    special_open: normalizeSpecialOpen(settings.special_open || []),
  };
  const windows = getSpecialWindowsForDate(date, schedule);
  const slots = windows;
  const rows = db
    .prepare('SELECT time FROM bookings WHERE date = ? AND status != ?')
    .all(date, CANCELLED_STATUS);
  res.json({
    date,
    occupied: rows.map((r) => r.time),
    slots,
    closed: windows.length === 0,
    closed_reason: windows.length > 0 ? '' : '该日期未开放预约',
    schedule,
  });
});

app.get('/api/bookings', jsonSmall, (req, res) => {
  const { password } = req.query;
  if (password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: '密码错误' });
  }
  const rows = db.prepare('SELECT * FROM bookings ORDER BY date DESC, time DESC').all();
  res.json(
    rows.map((r) => ({
      ...r,
      services: JSON.parse(r.services),
      images: r.images ? JSON.parse(r.images) : [],
      status: BOOKING_STATUSES.includes(r.status) ? r.status : DEFAULT_STATUS,
    }))
  );
});

app.patch('/api/bookings/:id/status', jsonSmall, (req, res) => {
  const { password } = req.query;
  if (password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: '密码错误' });
  }
  const id = Number(req.params.id);
  const { status } = req.body;
  if (!Number.isInteger(id) || id < 1) {
    return res.status(400).json({ error: '无效的预约编号' });
  }
  if (!BOOKING_STATUSES.includes(status)) {
    return res.status(400).json({ error: '无效的状态' });
  }
  const row = db.prepare('SELECT id, date, time FROM bookings WHERE id = ?').get(id);
  if (!row) {
    return res.status(404).json({ error: '预约不存在' });
  }
  if (status !== CANCELLED_STATUS && hasActiveBookingConflict(row.date, row.time, id)) {
    return res.status(409).json({ error: '该时段已有有效预约，无法改为当前状态' });
  }
  db.prepare('UPDATE bookings SET status = ? WHERE id = ?').run(status, id);
  res.json({ id, status, message: '状态已更新' });
});

app.delete('/api/bookings/:id', jsonSmall, (req, res) => {
  const { password } = req.query;
  if (password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: '密码错误' });
  }
  const id = req.params.id;
  deleteBookingImages(id);
  db.prepare('DELETE FROM bookings WHERE id = ?').run(id);
  res.json({ message: '已删除' });
});

app.use((err, req, res, next) => {
  if (err.type === 'entity.too.large') {
    return res.status(413).json({
      error:
        req.path.includes('/images')
          ? '鍥剧墖杩囧ぇ锛岃鍑忓皯寮犳暟鎴栨崲鏇村皬鍥剧墖'
          : '璇锋眰鏁版嵁杩囧ぇ',
    });
  }
  next(err);
});

app.use('/uploads', express.static(uploadsDir));
app.use('/works', express.static(worksDir));
app.use('/settings', express.static(settingsDir));
app.use(express.static(path.join(__dirname, 'public')));

if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`美甲预约站运行于 http://localhost:${PORT}`);
  });
}

module.exports = app;

