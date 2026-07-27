/* ==============================================================
   SSSDP — Sheno Secondary School Digital Portal
   Shared data layer + logic (used by index.html AND admin.html)
   Storage: localStorage (client-only demo — use ምትኬ / Backup
   in Settings to export/import the whole database as JSON).
   ============================================================== */

const LIB = (() => {

  const DB_KEY = "SSSDP_DB_V2";
  const SESSION_KEY = "SSSDP_SESSION_V2";
  const DEFAULT_DUE_DAYS = 14;
  const CATEGORIES = ["Teacher Guide", "Student Reference", "General Books", "Student Text Books"];
  const CATEGORY_LABEL = {
    "Teacher Guide": "የመምህር መምሪያ",
    "Student Reference": "የተማሪ ማጣቀሻ",
    "General Books": "አጠቃላይ መጻሕፍት",
    "Student Text Books": "የተማሪ መማሪያ መጽሐፍት"
  };
  const COPY_STATUS_LABEL = { available: "ይገኛል", borrowed: "ተወስዷል", damaged: "የተበላሸ", lost: "የጠፋ" };

  /* ---------------- utils ---------------- */
  const uid = (p="") => p + Math.random().toString(36).slice(2,9) + Date.now().toString(36).slice(-4);
  const todayISO = () => new Date().toISOString();
  const addDays = (iso, days) => { const d = new Date(iso); d.setDate(d.getDate()+days); return d.toISOString(); };
  const fmtDate = (iso) => { if(!iso) return "—"; const d = new Date(iso); return d.toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}); };
  const fmtDateTime = (iso) => { if(!iso) return "—"; const d = new Date(iso); return d.toLocaleString('en-GB',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}); };
  const isOverdue = (iso) => iso && new Date(iso).getTime() < Date.now();
  const daysLeft = (iso) => Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000);
  const escapeHtml = (s="") => String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const escapeAttr = escapeHtml;
  const digitsOnly = (s="") => (s||"").replace(/\D/g,"");
  // Clamped so a bad/out-of-range value (the historical bug: entering "6" here
  // used to throw and blank the entire book list, since "☆".repeat(5-6) is a
  // negative count) can never crash rendering again.
  const stars = (n) => { const c = Math.max(0, Math.min(5, Number(n)||0)); return "★".repeat(c) + "☆".repeat(5-c); };
  /* ---------------- Ethiopian calendar ----------------
     Used for student birth dates (Registrar). Amharic month names, 13 months
     total: 12 of 30 days + ጳጉሜ (Pagume), which has 5 days normally and 6 in
     an Ethiopian leap year (year % 4 === 3). Conversion goes through the
     Julian Day Number (JDN) — a standard technique for calendar math — so
     "today" in the Ethiopian calendar can be computed from the device's
     Gregorian clock. Verified by round-tripping every date from EC 2000–2020
     (7,670 dates, 0 mismatches) and checked against the known Ethiopian
     New Year dates (e.g. 1 Meskerem 2018 = 11 Sept 2025). */
  const ETH_EPOCH_JDN = 1723856;
  const ETH_MONTHS = [
    { n:1, am:"መስከረም" }, { n:2, am:"ጥቅምት" }, { n:3, am:"ኅዳር" }, { n:4, am:"ታኅሳስ" },
    { n:5, am:"ጥር" }, { n:6, am:"የካቲት" }, { n:7, am:"መጋቢት" }, { n:8, am:"ሚያዝያ" },
    { n:9, am:"ግንቦት" }, { n:10, am:"ሰኔ" }, { n:11, am:"ሐምሌ" }, { n:12, am:"ነሐሴ" },
    { n:13, am:"ጳጉሜ" }
  ];
  const isEthLeap = (year) => Number(year) % 4 === 3;
  const daysInEthMonth = (year, month) => month <= 12 ? 30 : (isEthLeap(year) ? 6 : 5);
  function gregorianToJDN(year, month, day){
    const a = Math.floor((14 - month) / 12);
    const y = year + 4800 - a;
    const m = month + 12*a - 3;
    return day + Math.floor((153*m+2)/5) + 365*y + Math.floor(y/4) - Math.floor(y/100) + Math.floor(y/400) - 32045;
  }
  function jdnToEthiopic(jdn){
    const r0 = (jdn - ETH_EPOCH_JDN) % 1461;
    const n = (r0 % 365) + 365 * Math.floor(r0/1460);
    const year = 4 * Math.floor((jdn - ETH_EPOCH_JDN)/1461) + Math.floor(r0/365) - Math.floor(r0/1460);
    return { year, month: Math.floor(n/30) + 1, day: (n % 30) + 1 };
  }
  function ethiopicToJDN(year, month, day){
    const k = Math.floor(year/4);
    const m = year - 4*k;
    const n = 30*(month-1) + (day-1);
    const r = (n === 365) ? 1460 : (365*m + n); // n===365 only reachable on Pagume day 6 of a leap year
    return ETH_EPOCH_JDN + 1461*k + r;
  }
  function ethToday(){
    const now = new Date();
    return jdnToEthiopic(gregorianToJDN(now.getFullYear(), now.getMonth()+1, now.getDate()));
  }
  // Age in whole years, computed entirely within the Ethiopian calendar (no
  // need to convert the birth date to Gregorian — "today" is the only side
  // that needs converting, via ethToday() above).
  function computeAgeFromEC(ec){
    if(!ec || !ec.year) return null;
    const t = ethToday();
    let age = t.year - Number(ec.year);
    if(t.month < Number(ec.month) || (t.month === Number(ec.month) && t.day < Number(ec.day))) age--;
    return age;
  }
  function fmtEthDate(ec){
    if(!ec || !ec.year) return "—";
    const mo = ETH_MONTHS.find(m => m.n === Number(ec.month));
    return `${ec.day} ${mo?mo.am:ec.month} ${ec.year}`;
  }
  function fmtResidency(r){
    if(!r) return "—";
    const parts = [r.town, r.kebele ? `Kebele ${r.kebele}` : "", r.sefer].filter(Boolean);
    return parts.length ? parts.join(", ") : "—";
  }

  // loose fuzzy match: normalizes spaces/case and checks substring OR token-subset match,
  // so admin can find "Abebe Kebede" by typing "abebe", "kebede", or minor variants —
  // partial names work fine, a full/exact name is not required.
  function fuzzyMatch(query, target){
    if(!query) return true;
    const q = query.trim().toLowerCase();
    const t = (target||"").toLowerCase();
    if(!q) return true;
    if(t.includes(q)) return true;
    const qTokens = q.split(/\s+/).filter(Boolean);
    return qTokens.every(tok => t.includes(tok));
  }

  /* ---------------- generic file helper (no resize — for any attachment) ---------------- */
  // Used for announcement attachments that aren't images (PDFs, docs, etc.) —
  // reads the raw file as a base64 data URL so it can be stored and later
  // offered to students as a downloadable link.
  function fileToDataURL(file, cb){
    const reader = new FileReader();
    reader.onload = (e) => cb(e.target.result);
    reader.onerror = () => cb(null);
    reader.readAsDataURL(file);
  }

  /* ---------------- image helper (resize to data URL) ---------------- */
  // Used for book covers, student photos, and the school/admin logo upload —
  // keeps localStorage small by capping the longest side.
  function fileToResizedDataURL(file, maxDim, cb){
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > height && width > maxDim){ height = Math.round(height * (maxDim/width)); width = maxDim; }
        else if (height > maxDim){ width = Math.round(width * (maxDim/height)); height = maxDim; }
        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        cb(canvas.toDataURL('image/jpeg', 0.82));
      };
      img.onerror = () => cb(null);
      img.src = e.target.result;
    };
    reader.onerror = () => cb(null);
    reader.readAsDataURL(file);
  }

  /* ---------------- DB (cloud-synced via Firestore, localStorage = instant-load cache only) ----------------
     IMPORTANT: localStorage is per-browser/per-device and was the ROOT CAUSE of "activation on one
     device isn't visible on another device / to admin". Real data now lives in Firestore (shared,
     one database for every device). localStorage is kept only as a fast local mirror so the page can
     render instantly on repeat visits before the network round-trip finishes. See firebase-config.js. */
  let _dbCache = null;
  let _ready = false;
  let _readyQueue = [];
  let _cloudEnabled = false;

  // The DB is split across three Firestore documents so that image-heavy data
  // (student photos, book covers, announcement attachments) can never block
  // small, high-frequency writes like book requests or comments. See saveDB().
  //   core     -> settings, staff, students, books   (has photos — can grow large)
  //   activity -> requests, reservations, comments   (small, text-only, never blocked)
  //   feed     -> announcements                      (can have images, isolated from activity)
  const SLICE_KEYS = {
    core: ["settings", "staff", "students", "books"],
    activity: ["requests", "reservations", "comments"],
    feed: ["announcements"]
  };
  let _fsRefs = { core: null, activity: null, feed: null };
  let _sliceCache = { core: null, activity: null, feed: null };
  let _slicesLoaded = { core: false, activity: false, feed: false };
  // Raw JSON string last known to be in Firestore for each slice — used to skip
  // writing a slice that hasn't actually changed. See saveDB() for why this matters.
  let _sliceJsonCache = { core: null, activity: null, feed: null };
  let _cloudConnected = false; // true once at least one snapshot has come back successfully

  function sliceOf(db, keys){
    const o = {};
    keys.forEach(k => o[k] = db[k]);
    return o;
  }
  function composeFromSlices(){
    return normalizeDB(Object.assign({}, _sliceCache.core, _sliceCache.activity, _sliceCache.feed));
  }

  function normalizeDB(db){
    if(!db) return db;
    db.settings = db.settings || {};
    db.staff = db.staff || [];
    db.students = db.students || [];
    db.books = db.books || [];
    db.requests = db.requests || [];
    db.reservations = db.reservations || [];
    db.announcements = db.announcements || [];
    db.comments = db.comments || [];
    return db;
  }

  function loadLocalCache(){
    try { const raw = localStorage.getItem(DB_KEY); return raw ? normalizeDB(JSON.parse(raw)) : null; } catch(e){ return null; }
  }
  function saveLocalCache(db){ try { localStorage.setItem(DB_KEY, JSON.stringify(db)); } catch(e){} }

  function loadDB(){ return _dbCache || loadLocalCache() || seedDB(); }
  function getDB(){ return loadDB(); }
  // Firestore hard-caps a single document at ~1MiB. The DB is split into three
  // documents (see SLICE_KEYS above) specifically so that base64 photos piling up
  // in `core` can NEVER block a write to `activity` (requests/comments) or `feed`
  // (announcements) — each slice is saved independently. We still warn well before
  // the real 1MB ceiling on whichever slice is getting close, so it shows up as a
  // visible banner instead of a mystery "my request never reached admin" bug.
  const FIRESTORE_DOC_SOFT_LIMIT = 900000;
  function saveDB(db){
    _dbCache = db;
    saveLocalCache(db); // keep the local mirror fresh for instant next-load
    if(!_cloudEnabled || !_fsRefs.core) return;
    Object.keys(SLICE_KEYS).forEach(sliceName => {
      const slice = sliceOf(db, SLICE_KEYS[sliceName]);
      const json = JSON.stringify(slice);
      // FIX: previously every single mutate() rewrote all 3 Firestore documents
      // (core+activity+feed) even when only one of them actually changed — e.g.
      // a student sending one book request triggered 3 writes, which then echoed
      // back as 3 separate onSnapshot updates and 3 full re-renders on every open
      // tab (admin included). That's the "everything shows loading for half a
      // second on every tap" bug, and it also burns through Firestore's daily
      // write quota 3x faster than necessary. Skipping unchanged slices fixes both.
      if(_sliceJsonCache[sliceName] === json){
        _sliceCache[sliceName] = slice;
        return;
      }
      if(json.length > FIRESTORE_DOC_SOFT_LIMIT){
        const msg = "SSSDP: '" + sliceName + "' data is " + Math.round(json.length/1024) + "KB — close to Firestore's 1MB per-document limit. Remove/compress some photos in that area.";
        console.error(msg);
        window.SSSDP_ON_SYNC_ERROR && window.SSSDP_ON_SYNC_ERROR(msg);
      }
      // Keep our in-memory slice cache in sync immediately so a rapid second mutate
      // (before the snapshot echoes back) composes from up-to-date data.
      _sliceCache[sliceName] = slice;
      _sliceJsonCache[sliceName] = json;
      _fsRefs[sliceName].set({ json, updatedAt: Date.now() })
        .catch(err => {
          const msg = "SSSDP: cloud save failed (" + sliceName + ") — your last change may not have reached the admin. (" + (err && err.message ? err.message : err) + ")";
          console.error(msg, err);
          // Roll back our "already sent" marker so the next save retries this slice
          // instead of silently assuming it went through.
          if(_sliceJsonCache[sliceName] === json) _sliceJsonCache[sliceName] = null;
          window.SSSDP_ON_SYNC_ERROR && window.SSSDP_ON_SYNC_ERROR(msg);
        });
    });
  }
  function mutate(fn){ const db = loadDB(); fn(db); saveDB(db); return db; }

  // Call cb once the initial cloud sync has completed (or immediately if running
  // without cloud config). Pages must wait for this before reading LIB.currentStudent()/
  // LIB.currentStaff() at boot, since the real DB may still be loading from the network.
  function ready(cb){ if(_ready) cb(); else _readyQueue.push(cb); }
  function flushReady(){ const q = _readyQueue; _readyQueue = []; q.forEach(cb => { try{ cb(); }catch(e){ console.error(e); } }); }

  // Attaches a live listener to each of the 3 slice docs. Once all 3 have delivered
  // at least one snapshot, composes the merged DB and flips _ready (or, on later
  // updates, tells the page to re-render — this is how changes made on another
  // device/browser show up here in real time).
  function attachSliceListeners(){
    Object.keys(_fsRefs).forEach(sliceName => {
      _fsRefs[sliceName].onSnapshot(snap => {
        let rawJson = (snap.exists && snap.data() && snap.data().json) ? snap.data().json : null;
        let data = null;
        if(rawJson){
          try { data = JSON.parse(rawJson); } catch(e){ data = null; }
        }
        _sliceCache[sliceName] = data || sliceOf(seedDB(), SLICE_KEYS[sliceName]);
        // Remember exactly what Firestore has right now for this slice so a later
        // saveDB() can skip re-sending it if nothing actually changed (see saveDB()).
        _sliceJsonCache[sliceName] = rawJson || JSON.stringify(_sliceCache[sliceName]);
        _slicesLoaded[sliceName] = true;
        _cloudConnected = true;
        window.SSSDP_ON_CLOUD_STATUS && window.SSSDP_ON_CLOUD_STATUS(true);
        if(_slicesLoaded.core && _slicesLoaded.activity && _slicesLoaded.feed){
          _dbCache = composeFromSlices();
          saveLocalCache(_dbCache);
          if(!_ready){ _ready = true; flushReady(); }
          else { window.SSSDP_REFRESH && window.SSSDP_REFRESH(); } // live update from another device
        }
      }, err => {
        // This is the exact failure mode behind "student's request never reaches
        // admin": if this listener errors out (rules, network, quota), writes on
        // THIS device stop reaching the shared cloud DB entirely, silently, with
        // only a console.error — nobody sees it happen. Surface it visibly instead.
        const msg = "SSSDP: '" + sliceName + "' cloud sync lost — changes on this device may not reach other devices until this is fixed. Check your internet connection and Firestore security rules.";
        console.error(msg, err);
        _cloudConnected = false;
        window.SSSDP_ON_CLOUD_STATUS && window.SSSDP_ON_CLOUD_STATUS(false);
        window.SSSDP_ON_SYNC_ERROR && window.SSSDP_ON_SYNC_ERROR(msg);
        if(!_ready){ _dbCache = loadLocalCache() || seedDB(); _ready = true; flushReady(); }
      });
    });
  }

  // One-time migration: older deployments of this app stored everything in a
  // single doc at sssdp/main. If that doc exists and the new split docs don't yet,
  // read it once and fan it out into core/activity/feed so no existing data is lost.
  function migrateOrSeed(fs){
    return fs.collection("sssdp").doc("main").get().then(oldSnap => {
      let full = null;
      if(oldSnap.exists && oldSnap.data() && oldSnap.data().json){
        try { full = normalizeDB(JSON.parse(oldSnap.data().json)); } catch(e){ full = null; }
      }
      if(!full) full = normalizeDB(loadLocalCache() || seedDB());
      const batch = fs.batch();
      Object.keys(SLICE_KEYS).forEach(sliceName => {
        batch.set(_fsRefs[sliceName], { json: JSON.stringify(sliceOf(full, SLICE_KEYS[sliceName])), updatedAt: Date.now() });
      });
      return batch.commit();
    });
  }

  function initCloud(){
    if(!window.FIREBASE_CONFIG || !window.firebase){
      // No firebase-config.js / SDK found — falls back to old device-only localStorage behavior.
      const msg = "SSSDP: running WITHOUT cloud sync — set up firebase-config.js so student accounts and requests work across devices.";
      console.warn(msg);
      window.SSSDP_ON_SYNC_ERROR && window.SSSDP_ON_SYNC_ERROR(msg);
      window.SSSDP_ON_CLOUD_STATUS && window.SSSDP_ON_CLOUD_STATUS(false);
      _dbCache = loadLocalCache() || seedDB();
      _ready = true; flushReady();
      return;
    }
    try{
      firebase.initializeApp(window.FIREBASE_CONFIG);
      const fs = firebase.firestore();
      _fsRefs.core = fs.collection("sssdp").doc("core");
      _fsRefs.activity = fs.collection("sssdp").doc("activity");
      _fsRefs.feed = fs.collection("sssdp").doc("feed");
      _cloudEnabled = true;

      _fsRefs.core.get().then(coreSnap => {
        if(coreSnap.exists){
          attachSliceListeners();
        } else {
          return migrateOrSeed(fs).then(attachSliceListeners);
        }
      }).catch(err => {
        const msg = "SSSDP: could not connect to the cloud database — running in local-only mode. Requests/comments made here will NOT reach the admin until this is fixed. (" + (err && err.message ? err.message : err) + ")";
        console.error(msg, err);
        window.SSSDP_ON_SYNC_ERROR && window.SSSDP_ON_SYNC_ERROR(msg);
        window.SSSDP_ON_CLOUD_STATUS && window.SSSDP_ON_CLOUD_STATUS(false);
        _dbCache = loadLocalCache() || seedDB();
        _ready = true; flushReady();
      });
    } catch(e){
      const msg = "SSSDP: cloud init failed — running in local-only mode. Requests/comments made here will NOT reach the admin until this is fixed. (" + (e && e.message ? e.message : e) + ")";
      console.error(msg, e);
      window.SSSDP_ON_SYNC_ERROR && window.SSSDP_ON_SYNC_ERROR(msg);
      window.SSSDP_ON_CLOUD_STATUS && window.SSSDP_ON_CLOUD_STATUS(false);
      _dbCache = loadLocalCache() || seedDB();
      _ready = true; flushReady();
    }
  }
  initCloud();

  function makeCopies(n){ return Array.from({length:Math.max(0,Number(n)||0)}, () => ({ id: uid("cp_"), status: "available" })); }

  function seedDB(){
    const now = todayISO();
    return {
      settings: {
        accent: "#C8102E",
        dueDays: DEFAULT_DUE_DAYS,
        schoolName: "SHENO SECONDARY SCHOOL",
        portalName: "SSSDP — Sheno Secondary School Digital Portal",
        logoUrl: "",
        telegram: "t.me/dagdevio",
        youtube: "",
        texture: true
      },
      // No hardcoded demo admin account here on purpose — shipping a known
      // username/password in the source code is a security hole. Instead, when
      // staff is empty, admin.html shows a one-time "Create Director Account"
      // setup screen (see LIB.setupFirstAdmin) so the real registrar picks
      // their own credentials.
      staff: [],
      students: [
        {
          id: uid("std_"), fan: "1002003004005006",
          name: "Abebe Kebede", class: "10", section: "A",
          gender: "male", ecBirth: { year: 2002, month: 5, day: 12 }, age: computeAgeFromEC({ year: 2002, month: 5, day: 12 }),
          residency: { town: "Sheno", kebele: "02", sefer: "Arada" },
          guardianName: "Kebede Alemu", guardianPhone: "0911223344",
          activated: true, pin: "1234", photo: "",
          createdAt: now
        },
        {
          id: uid("std_"), fan: "2003004005006007",
          name: "Selam Tesfaye", class: "9", section: "B",
          gender: "female", ecBirth: { year: 2003, month: 2, day: 20 }, age: computeAgeFromEC({ year: 2003, month: 2, day: 20 }),
          residency: { town: "Sheno", kebele: "01", sefer: "Mekane Yesus" },
          guardianName: "Tesfaye Bekele", guardianPhone: "0922334455",
          activated: false, pin: "", photo: "",
          createdAt: now
        }
      ],
      books: [
        { id: uid("bk_"), title: "Introduction to Biology", author: "Dr. Alemu Worku", category: "Student Text Books",
          quality: 4, condition: "Good condition, minor cover wear", coverUrl: "", copies: makeCopies(5), addedAt: now },
        { id: uid("bk_"), title: "Amharic Grammar Guide", author: "W/ro Almaz Tadesse", category: "Teacher Guide",
          quality: 5, condition: "Brand new", coverUrl: "", copies: makeCopies(2), addedAt: now },
        { id: uid("bk_"), title: "General Knowledge Encyclopedia", author: "Various", category: "General Books",
          quality: 3, condition: "Old, but readable", coverUrl: "", copies: makeCopies(3), addedAt: now },
        { id: uid("bk_"), title: "Physics Reference for Grade 11-12", author: "Mekonnen Girma", category: "Student Reference",
          quality: 4, condition: "Good", coverUrl: "", copies: makeCopies(4), addedAt: now }
      ],
      requests: [], // {id, studentId, bookId, copyId, status: pending|borrowed|returned|rejected, requestedAt, approvedAt, dueDate, returnedAt, approvedBy}
      reservations: [], // {id, studentId, bookId, date}
      announcements: [
        { id: uid("an_"), title: "እንኳን ደህና መጡ!", body: "የSHENO SECONDARY SCHOOL ዲጂታል ፖርታል (SSSDP) ተጀምሯል። መጻሕፍትን መፈለግ፣ መዋስ እና ማንበብ ይችላሉ።",
          mediaUrl: "", mediaType: "", postedBy: "Director Admin", postedByRole: "director", date: now, views: [] }
      ],
      comments: [] // {id, targetType: 'announcement'|'book', targetId, studentId, text, date}
    };
  }

  /* ---------------- settings ---------------- */
  function getSettings(){ return getDB().settings; }
  function updateSettings(patch){ return mutate(db => Object.assign(db.settings, patch)); }
  function applyTheme(){
    const s = getSettings();
    document.documentElement.style.setProperty('--red', s.accent || "#C8102E");
    document.documentElement.classList.toggle('texture-off', s.texture === false);
  }

  /* ---------------- session ---------------- */
  function getSession(){ try { return JSON.parse(sessionStorage.getItem(SESSION_KEY)); } catch(e){ return null; } }
  function setSession(session){ sessionStorage.setItem(SESSION_KEY, JSON.stringify(session)); }
  function clearSession(){ sessionStorage.removeItem(SESSION_KEY); }

  /* ---------------- auth: students ---------------- */
  // Admin pre-registers the student's official record with just a 16-digit FAN
  // (no FIN needed — kept out of the flow entirely per school policy).
  function adminRegisterStudent({name, fan, klass, section, gender, ecBirth, phone, residency, guardianName, guardianPhone}){
    fan = digitsOnly(fan);
    if(!name || !name.trim()) return { ok:false, error: "ሙሉ ስም ያስፈልጋል" };
    if(fan.length !== 16) return { ok:false, error: "FAN 16 ዲጂት መሆን አለበት" };
    const db = getDB();
    if(db.students.some(s => s.fan === fan)) return { ok:false, error: "ይህ FAN ቀድሞ ተመዝግቧል" };
    const student = { id: uid("std_"), fan, name: name.trim(), class: klass, section,
      gender: gender||"", ecBirth: ecBirth||null, age: ecBirth ? computeAgeFromEC(ecBirth) : null,
      phone: phone||"",
      residency: (residency && typeof residency==='object') ? { town: residency.town||"", kebele: residency.kebele||"", sefer: residency.sefer||"" } : { town:"", kebele:"", sefer:"" },
      guardianName: guardianName||"", guardianPhone: guardianPhone||"",
      activated:false, pin:"", photo:"", createdAt: todayISO() };
    mutate(db => db.students.push(student));
    return { ok:true, student };
  }

  // Self-activation: student proves identity with the first 4 digits of their FAN
  // (+ full name to disambiguate) and picks a 4-digit PIN. If more than one
  // un-activated student shares that FAN prefix, name filtering narrows it down;
  // if it's still ambiguous the student is asked to double-check their name.
  function activateStudent({fanPrefix4, name, pin}){
    fanPrefix4 = digitsOnly(fanPrefix4);
    if(fanPrefix4.length !== 4) return { ok:false, error:"የFAN መጀመሪያ 4 ዲጂት ብቻ ያስገቡ" };
    if(!/^\d{4}$/.test(pin||"")) return { ok:false, error:"የይለፍ ቁጥር (PIN) ልክ 4 ዲጂት መሆን አለበት" };
    const db = getDB();
    let matches = db.students.filter(s => s.fan.startsWith(fanPrefix4) && !s.activated);
    if(name && name.trim()) matches = matches.filter(s => fuzzyMatch(name, s.name));
    if(matches.length === 0) return { ok:false, error:"የሚመሳሰል ያልነቃ ተማሪ መዝገብ አልተገኘም። ስምዎን በትክክል ያስገቡ ወይም አድሚንን ያግኙ።" };
    if(matches.length > 1) return { ok:false, error:"ከአንድ በላይ ተማሪ ተገኝቷል፤ እባክዎ ሙሉ ስምዎን በትክክል ያስገቡ።" };
    const match = matches[0];
    mutate(db => {
      const s = db.students.find(x => x.id === match.id);
      s.activated = true; s.pin = pin;
    });
    return { ok:true, fanPrefix4 };
  }

  // Daily login only needs the first 4 digits of the FAN + the 4-digit PIN.
  // If several activated students share that prefix, return candidates for the
  // UI to disambiguate; the caller then calls studentLoginConfirm with the id.
  function studentLogin(fanPrefix4, pin){
    fanPrefix4 = digitsOnly(fanPrefix4);
    const db = getDB();
    const candidates = db.students.filter(s => s.activated && s.fan.startsWith(fanPrefix4));
    if(candidates.length === 0) return { ok:false, error:"ምንም ንቁ ተማሪ በዚህ ቁጥር አልተገኘም" };
    const withCorrectPin = candidates.filter(s => s.pin === pin);
    if(withCorrectPin.length === 0) return { ok:false, error:"የይለፍ ቁጥር (PIN) ትክክል አይደለም" };
    if(withCorrectPin.length === 1) {
      setSession({ type:"student", id: withCorrectPin[0].id });
      return { ok:true, student: withCorrectPin[0] };
    }
    return { ok:false, needsPick:true, candidates: withCorrectPin.map(s=>({id:s.id, name:s.name, class:s.class, section:s.section})) };
  }
  function studentLoginConfirm(studentId, pin){
    const db = getDB();
    const student = db.students.find(s => s.id === studentId);
    if(!student || student.pin !== pin) return { ok:false, error:"ማረጋገጥ አልተሳካም" };
    setSession({ type:"student", id: student.id });
    return { ok:true, student };
  }

  function staffLogin(username, password){
    const db = getDB();
    const staff = db.staff.find(s => s.username.trim().toLowerCase() === (username||"").trim().toLowerCase());
    // Trim the password too — mobile keyboards can silently append a trailing
    // space via autocorrect, which previously made a perfectly correct password
    // fail to match the one stored when the staff account was created.
    if(!staff || staff.password !== (password||"").trim()) return { ok:false, error:"የተጠቃሚ ስም ወይም የይለፍ ቃል ትክክል አይደለም" };
    setSession({ type:"staff", id: staff.id, role: staff.role });
    return { ok:true, staff };
  }

  function currentStudent(){
    const s = getSession(); if(!s || s.type !== "student") return null;
    return getDB().students.find(x => x.id === s.id) || null;
  }
  function currentStaff(){
    const s = getSession(); if(!s || s.type !== "staff") return null;
    return getDB().staff.find(x => x.id === s.id) || null;
  }

  // Admin resets/edits a student's PIN directly — no need for the student to remember anything.
  function adminSetStudentPin(studentId, newPin){
    if(!/^\d{4}$/.test(newPin||"")) return { ok:false, error:"PIN ልክ 4 ዲጂት መሆን አለበት" };
    mutate(db => {
      const s = db.students.find(x => x.id === studentId);
      if(s){ s.pin = newPin; s.activated = true; }
    });
    return { ok:true };
  }
  function adminEditStudent(studentId, patch){
    mutate(db => {
      const s = db.students.find(x => x.id === studentId);
      if(s) Object.assign(s, patch);
    });
  }
  function adminSetStudentPhoto(studentId, dataUrl){
    mutate(db => { const s = db.students.find(x=>x.id===studentId); if(s) s.photo = dataUrl || ""; });
  }
  // Partial-name search: admin can find a student typing just part of the name
  // (a first name, a last name, or any fragment) — no need to type it in full.
  function searchStudents(query){
    const db = getDB();
    if(!query) return db.students;
    const qDigits = digitsOnly(query);
    return db.students.filter(s => fuzzyMatch(query, s.name) || (qDigits && (s.fan||"").includes(qDigits)));
  }
  // Full removal ("withdraw") of a student record: releases any copies they were
  // holding back to 'available', then deletes the student plus their requests,
  // reservations, and comments so no orphaned data is left behind.
  function removeStudent(id){
    mutate(db => {
      db.requests.forEach(r => {
        if(r.studentId === id && (r.status === 'pending' || r.status === 'borrowed')){
          const b = db.books.find(x => x.id === r.bookId);
          const c = b && b.copies.find(x => x.id === r.copyId);
          if(c) c.status = 'available';
        }
      });
      db.students = db.students.filter(s => s.id !== id);
      db.requests = db.requests.filter(r => r.studentId !== id);
      db.reservations = db.reservations.filter(r => r.studentId !== id);
      db.comments = db.comments.filter(c => c.studentId !== id);
    });
  }

  /* ---------------- staff management (director only) ---------------- */
  // One-time bootstrap: creates the very first Director account when no staff
  // accounts exist yet at all (fresh install, or one that never had a demo
  // account seeded). This is the ONLY way to create a staff account without
  // already being logged in as a registrar, and it stops working forever the
  // moment any staff record exists — so it can never be used to sneak in a
  // second/rogue admin later.
  function setupFirstAdmin({name, username, password}){
    const db = getDB();
    if(db.staff.length > 0) return { ok:false, error:"Setup already completed — please log in instead." };
    name = (name||"").trim(); username = (username||"").trim(); password = (password||"").trim();
    if(!name || !username || !password) return { ok:false, error:"Please fill in all fields." };
    if(password.length < 6) return { ok:false, error:"Password should be at least 6 characters." };
    // Registrar is the top-level admin role (owns Settings & Backup and Staff
    // Accounts), so the very first account on a fresh install is a Registrar —
    // otherwise nobody could ever create the first Registrar account.
    const staff = { id: uid("stf_"), username, password, role: "registrar", name };
    mutate(db => db.staff.push(staff));
    setSession({ type:"staff", id: staff.id, role: staff.role });
    return { ok:true, staff };
  }
  // Only the currently logged-in Registrar may add or remove staff accounts.
  // Enforced here (not just hidden in the UI) so a Director/Library Staff
  // account can't do it by calling LIB.addStaff/removeStaff directly from the console.
  function addStaff({username, password, role, name}){
    const actor = currentStaff();
    if(!actor || actor.role !== 'registrar') return { ok:false, error:"Only the Registrar can add staff accounts." };
    name = (name||"").trim(); username = (username||"").trim(); password = (password||"").trim();
    if(!name || !username || !password) return { ok:false, error:"Please fill in all fields." };
    const db = getDB();
    if(db.staff.some(s => s.username.toLowerCase() === username.toLowerCase())) return {ok:false,error:"ይህ የተጠቃሚ ስም አለ"};
    const staff = { id: uid("stf_"), username, password, role, name };
    mutate(db => db.staff.push(staff));
    return { ok:true, staff };
  }
  function removeStaff(id){
    const actor = currentStaff();
    if(!actor || actor.role !== 'registrar') return { ok:false, error:"Only the Registrar can remove staff accounts." };
    if(actor.id === id) return { ok:false, error:"You can't remove your own account." };
    mutate(db => { db.staff = db.staff.filter(s => s.id !== id); });
    return { ok:true };
  }
  // Any staff member (director or library) can change their own login password from Settings.
  function staffChangeOwnPassword(staffId, oldPassword, newPassword){
    const db = getDB();
    const staff = db.staff.find(s => s.id === staffId);
    if(!staff) return { ok:false, error:"አልተገኘም" };
    if(staff.password !== oldPassword) return { ok:false, error:"የአሁኑ የይለፍ ቃል ትክክል አይደለም" };
    if(!newPassword || newPassword.length < 6) return { ok:false, error:"አዲሱ የይለፍ ቃል ቢያንስ 6 ፊደል ይሁን" };
    mutate(db => { db.staff.find(s=>s.id===staffId).password = newPassword; });
    return { ok:true };
  }

  /* ---------------- books (per-copy tracking) ---------------- */
  function bookStats(book){
    const copies = book.copies || [];
    return {
      total: copies.length,
      available: copies.filter(c=>c.status==='available').length,
      borrowed: copies.filter(c=>c.status==='borrowed').length,
      damaged: copies.filter(c=>c.status==='damaged').length,
      lost: copies.filter(c=>c.status==='lost').length
    };
  }
  // Books, Requests & Loans, and Reservations are Library Staff's exclusive
  // job — enforced here too (not just hidden in the admin UI) so a Registrar
  // or Director account can't do it by calling these directly from the console.
  function isLibrarian(){ const a = currentStaff(); return !!a && a.role === 'library'; }
  function addBook(book){
    if(!isLibrarian()) return { ok:false, error:"Only Library Staff can add books." };
    const rec = { id: uid("bk_"), title:book.title, author:book.author, category:book.category,
      quality:Number(book.quality)||3, condition:book.condition||"", coverUrl:book.coverUrl||"",
      copies: makeCopies(book.totalCopies), addedAt: todayISO() };
    mutate(db => db.books.push(rec));
    return rec;
  }
  function editBook(id, patch){
    if(!isLibrarian()) return;
    mutate(db => {
      const b = db.books.find(x => x.id === id);
      if(!b) return;
      const { totalCopies, ...rest } = patch;
      Object.assign(b, rest);
      if(totalCopies !== undefined){
        const target = Math.max(0, Number(totalCopies)||0);
        const cur = b.copies.length;
        if(target > cur) b.copies = b.copies.concat(makeCopies(target - cur));
        else if(target < cur){
          // remove available copies first, keep borrowed/damaged/lost history intact where possible
          let toRemove = cur - target;
          b.copies = b.copies.filter(c => {
            if(toRemove > 0 && c.status === 'available'){ toRemove--; return false; }
            return true;
          });
        }
      }
    });
  }
  function setCopyStatus(bookId, copyId, status){
    if(!isLibrarian()) return;
    mutate(db => {
      const b = db.books.find(x=>x.id===bookId); if(!b) return;
      const c = b.copies.find(x=>x.id===copyId); if(c) c.status = status;
    });
  }
  function addCopies(bookId, n){
    if(!isLibrarian()) return;
    mutate(db => { const b = db.books.find(x=>x.id===bookId); if(b) b.copies = b.copies.concat(makeCopies(n)); });
  }
  function removeBook(id){ if(!isLibrarian()) return; mutate(db => { db.books = db.books.filter(b => b.id !== id); }); }
  // Search across title, author, AND category — a partial title, a partial author
  // name, or a category keyword all work.
  function searchBooks({query, category} = {}){
    const db = getDB();
    return db.books.filter(b => {
      const matchesQ = !query || fuzzyMatch(query, b.title) || fuzzyMatch(query, b.author) || fuzzyMatch(query, CATEGORY_LABEL[b.category]||"");
      const matchesCat = !category || category === "all" || b.category === category;
      return matchesQ && matchesCat;
    });
  }

  /* ---------------- borrow / approval workflow ----------------
     All state changes go through mutate(), which already pushes the whole DB
     to the shared Firestore doc (see saveDB above) — that single sync path is
     what makes a student's request show up for admin on another device, so
     these stay plain synchronous functions returning a result object, exactly
     as the callers in index.html / admin.html expect (they read res.ok
     immediately — they don't await a promise). */
  function requestBook(studentId, bookId){
    const db = getDB();
    const book = db.books.find(b => b.id === bookId);
    if(!book) return { ok:false, error:"መጽሐፍ አልተገኘም" };

    const freeCopy = (book.copies||[]).find(c => c.status === 'available');
    if(!freeCopy) return { ok:false, error:"ኮፒ የለም። ወደ ወረፋ (Reserve) ይግቡ።", canReserve:true };

    const reqRec = {
      id: uid("rq_"), studentId, bookId, copyId: freeCopy.id,
      status: "pending", requestedAt: todayISO(), approvedAt: null,
      dueDate: null, returnedAt: null, approvedBy: null
    };

    mutate(db => {
      db.requests.push(reqRec);
      const b = db.books.find(x => x.id === bookId);
      const c = b && b.copies.find(x => x.id === freeCopy.id);
      if(c) c.status = 'borrowed';
    });

    return { ok:true, request: reqRec };
  }
  function approveRequest(requestId, staffName, dueDays){
    if(!isLibrarian()) return;
    const db = getDB();
    const r = db.requests.find(x => x.id === requestId);
    if(!r || r.status !== "pending") return;
    const finalDue = addDays(todayISO(), dueDays || db.settings.dueDays || DEFAULT_DUE_DAYS);
    mutate(db => {
      const x = db.requests.find(x => x.id === requestId);
      if(x){ x.status = "borrowed"; x.approvedAt = todayISO(); x.dueDate = finalDue; x.approvedBy = staffName; }
    });
  }
  function rejectRequest(requestId){
    if(!isLibrarian()) return;
    const db = getDB();
    const r = db.requests.find(x => x.id === requestId);
    if(!r || r.status !== "pending") return;
    mutate(db => {
      const x = db.requests.find(x => x.id === requestId);
      if(x) x.status = "rejected";
      const b = db.books.find(x => x.id === r.bookId);
      const c = b && b.copies.find(x => x.id === r.copyId);
      if(c) c.status = 'available';
    });
  }
  function markReturned(requestId, damaged){
    if(!isLibrarian()) return;
    const db = getDB();
    const r = db.requests.find(x => x.id === requestId);
    if(!r || r.status !== "borrowed") return;
    mutate(db => {
      const x = db.requests.find(x => x.id === requestId);
      if(x){ x.status = "returned"; x.returnedAt = todayISO(); }
      const b = db.books.find(x => x.id === r.bookId);
      const c = b && b.copies.find(x => x.id === r.copyId);
      if(c) c.status = damaged ? 'damaged' : 'available';
    });
  }
  function adjustDueDate(requestId, newDueIso){
    if(!isLibrarian()) return;
    mutate(db => {
      const r = db.requests.find(x => x.id === requestId);
      if(r) r.dueDate = newDueIso;
    });
  }
  function reserveBook(studentId, bookId){
    const db = getDB();
    if(db.reservations.some(r => r.studentId===studentId && r.bookId===bookId)) return {ok:false,error:"ቀድመው በወረፋ ውስጥ ነዎት"};
    const rec = { id: uid("wl_"), studentId, bookId, date: todayISO() };
    mutate(db => db.reservations.push(rec));
    return { ok:true, reservation: rec };
  }
  function cancelReservation(id){ if(!isLibrarian()) return; mutate(db => { db.reservations = db.reservations.filter(r => r.id !== id); }); }

  function myRequests(studentId){ return getDB().requests.filter(r => r.studentId === studentId); }
  function myReservations(studentId){ return getDB().reservations.filter(r => r.studentId === studentId); }
  function allOverdue(){
    const db = getDB();
    return db.requests.filter(r => r.status === "borrowed" && isOverdue(r.dueDate));
  }
  function allPending(){ return getDB().requests.filter(r => r.status === "pending"); }
  function allBorrowed(){ return getDB().requests.filter(r => r.status === "borrowed"); }

  /* ---------------- announcements (with view tracking + grade tags) ---------------- */
  // AUDIENCES: "all" (#GENERAL — every student) or a grade string "9"/"10"/"11"/"12"
  // (#GRADE9.."#GRADE12 — only students in that class see/get notified about it).
  const AUDIENCES = ["all", "9", "10", "11", "12"];
  const AUDIENCE_LABEL = { all: "#GENERAL", "9": "#GRADE9", "10": "#GRADE10", "11": "#GRADE11", "12": "#GRADE12" };
  function postAnnouncement({title, body, mediaUrl, mediaType, mediaName, postedBy, postedByRole, postedById, audience}){
    const rec = { id: uid("an_"), title, body, mediaUrl:mediaUrl||"", mediaType:mediaType||"", mediaName:mediaName||"",
      audience: AUDIENCES.includes(audience) ? audience : "all",
      postedBy, postedByRole, postedById: postedById||"", date: todayISO(), views: [] };
    mutate(db => db.announcements.unshift(rec));
    return rec;
  }
  // Edit/delete are restricted to the staff member who originally posted the
  // announcement — staffId must match the record's postedById, or the call is
  // rejected. This is what lets a teacher/library staff fix or take down only
  // what they themselves sent, without touching anyone else's posts.
  function isAnnouncementOwner(annId, staffId){
    const a = getDB().announcements.find(x => x.id === annId);
    return !!(a && staffId && a.postedById === staffId);
  }
  function updateAnnouncement(id, staffId, {title, body, mediaUrl, mediaType, mediaName, audience}){
    if(!isAnnouncementOwner(id, staffId)) return { ok:false, error:"You can only edit announcements you posted yourself." };
    mutate(db => {
      const a = db.announcements.find(x => x.id === id);
      if(!a) return;
      a.title = title; a.body = body;
      a.mediaUrl = mediaUrl||""; a.mediaType = mediaType||""; a.mediaName = mediaName||"";
      a.audience = AUDIENCES.includes(audience) ? audience : "all";
      a.editedAt = todayISO();
    });
    return { ok:true };
  }
  function removeAnnouncement(id, staffId){
    if(!isAnnouncementOwner(id, staffId)) return { ok:false, error:"You can only delete announcements you posted yourself." };
    mutate(db => { db.announcements = db.announcements.filter(a => a.id !== id); });
    return { ok:true };
  }
  function listAnnouncements(){ return getDB().announcements.slice().sort((a,b)=> new Date(b.date)-new Date(a.date)); }
  // Same as listAnnouncements(), but narrowed to what a given student should
  // actually see: #GENERAL posts plus any post tagged for that student's own grade.
  function listAnnouncementsFor(student){
    const klass = String((student&&student.class)||"").trim();
    return listAnnouncements().filter(a => !a.audience || a.audience === "all" || a.audience === klass);
  }
  // Count of posts relevant to this student that they haven't opened yet —
  // drives the notification badge on the Inbox tab.
  function unreadAnnouncementCount(student){
    if(!student) return 0;
    return listAnnouncementsFor(student).filter(a => !(a.views||[]).includes(student.id)).length;
  }
  // Like a Telegram/YouTube view counter — records that this student opened the
  // post at least once; admins see the tally, students don't (keeps it uncluttered).
  function markAnnouncementViewed(id, studentId){
    mutate(db => {
      const a = db.announcements.find(x=>x.id===id);
      if(a && !a.views.includes(studentId)) a.views.push(studentId);
    });
  }

  /* ---------------- comments ---------------- */
  function addComment({targetType, targetId, studentId, text}){
    const rec = { id: uid("cm_"), targetType, targetId, studentId, text, date: todayISO() };
    mutate(db => db.comments.push(rec));
    return rec;
  }
  function commentsFor(targetType, targetId){
    const db = getDB();
    return db.comments.filter(c => c.targetType===targetType && c.targetId===targetId)
      .sort((a,b)=> new Date(a.date)-new Date(b.date));
  }

  /* ---------------- restore demo books ---------------- */
  // Adds back the original sample book titles if they're missing (matched by
  // title, so it's safe to click more than once — it won't create duplicates).
  const DEMO_BOOKS = [
    { title: "Introduction to Biology", author: "Dr. Alemu Worku", category: "Student Text Books", condition: "Good condition, minor cover wear", totalCopies: 5 },
    { title: "Amharic Grammar Guide", author: "W/ro Almaz Tadesse", category: "Teacher Guide", condition: "Brand new", totalCopies: 2 },
    { title: "General Knowledge Encyclopedia", author: "Various", category: "General Books", condition: "Old, but readable", totalCopies: 3 },
    { title: "Physics Reference for Grade 11-12", author: "Mekonnen Girma", category: "Student Reference", condition: "Good", totalCopies: 4 }
  ];
  function restoreDemoBooks(){
    const db = getDB();
    const existingTitles = new Set(db.books.map(b => (b.title||"").trim().toLowerCase()));
    const toAdd = DEMO_BOOKS.filter(b => !existingTitles.has(b.title.trim().toLowerCase()));
    toAdd.forEach(b => addBook(b));
    return { ok:true, added: toAdd.length };
  }

  /* ---------------- reset demo data ---------------- */
  // Wipes the sample students/books/requests/announcements/comments that ship with the
  // demo, but keeps your Settings (school name, logo, accent color, telegram link) and
  // your staff accounts so you don't get locked out.
  function clearDemoData(){
    mutate(db => {
      db.students = [];
      db.books = [];
      db.requests = [];
      db.reservations = [];
      db.announcements = [];
      db.comments = [];
    });
  }

  /* ---------------- backup / restore ---------------- */
  function exportJSON(){
    const db = getDB();
    const blob = new Blob([JSON.stringify(db, null, 2)], { type:"application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `sssdp-backup-${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  }
  function importJSON(file, cb){
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        if(!data.students || !data.books) throw new Error("invalid file");
        saveDB(data);
        cb && cb({ok:true});
      } catch(err){ cb && cb({ok:false, error:"የፋይሉ ቅርጸት ትክክል አይደለም"}); }
    };
    reader.readAsText(file);
  }

  return {
    CATEGORIES, CATEGORY_LABEL, COPY_STATUS_LABEL, DEFAULT_DUE_DAYS,
    uid, todayISO, addDays, fmtDate, fmtDateTime, isOverdue, daysLeft, escapeHtml, escapeAttr, digitsOnly, stars, fuzzyMatch,
    fileToResizedDataURL, fileToDataURL,
    ETH_MONTHS, isEthLeap, daysInEthMonth, ethToday, computeAgeFromEC, fmtEthDate, fmtResidency,
    getDB, mutate, ready, getSettings, updateSettings, applyTheme,
    getSession, setSession, clearSession,
    adminRegisterStudent, activateStudent, studentLogin, studentLoginConfirm, staffLogin, currentStudent, currentStaff,
    adminSetStudentPin, adminEditStudent, adminSetStudentPhoto, searchStudents, removeStudent,
    setupFirstAdmin, addStaff, removeStaff, staffChangeOwnPassword, clearDemoData, restoreDemoBooks,
    addBook, editBook, removeBook, searchBooks, bookStats, setCopyStatus, addCopies,
    requestBook, approveRequest, rejectRequest, markReturned, adjustDueDate,
    reserveBook, cancelReservation, myRequests, myReservations, allOverdue, allPending, allBorrowed,
    AUDIENCES, AUDIENCE_LABEL,
    postAnnouncement, updateAnnouncement, removeAnnouncement, isAnnouncementOwner, listAnnouncements, listAnnouncementsFor, unreadAnnouncementCount, markAnnouncementViewed,
    addComment, commentsFor,
    exportJSON, importJSON
  };
})();
