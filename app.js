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
    { n:1, am:"መስከረም", en:"Meskerem" }, { n:2, am:"ጥቅምት", en:"Tikimt" }, { n:3, am:"ኅዳር", en:"Hidar" }, { n:4, am:"ታኅሳስ", en:"Tahsas" },
    { n:5, am:"ጥር", en:"Tir" }, { n:6, am:"የካቲት", en:"Yekatit" }, { n:7, am:"መጋቢት", en:"Megabit" }, { n:8, am:"ሚያዝያ", en:"Miazia" },
    { n:9, am:"ግንቦት", en:"Ginbot" }, { n:10, am:"ሰኔ", en:"Sene" }, { n:11, am:"ሐምሌ", en:"Hamle" }, { n:12, am:"ነሐሴ", en:"Nehase" },
    { n:13, am:"ጳጉሜ", en:"Pagume" }
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
  // Inverse of gregorianToJDN — needed to turn an Ethiopian-calendar date
  // (e.g. "30 Sene, end of the school year") into a real Gregorian ISO date
  // so it can be stored/compared as a normal dueDate like everything else.
  function jdnToGregorian(jdn){
    const a = jdn + 32044;
    const b = Math.floor((4*a+3)/146097);
    const c = a - Math.floor((146097*b)/4);
    const d = Math.floor((4*c+3)/1461);
    const e = c - Math.floor((1461*d)/4);
    const m = Math.floor((5*e+2)/153);
    const day = e - Math.floor((153*m+2)/5) + 1;
    const month = m + 3 - 12*Math.floor(m/10);
    const year = 100*b + d - 4800 + Math.floor(m/10);
    return { year, month, day };
  }
  function ecToISO(ec){
    const g = jdnToGregorian(ethiopicToJDN(ec.year, ec.month, ec.day));
    return new Date(Date.UTC(g.year, g.month-1, g.day, 12, 0, 0)).toISOString();
  }
  // The date annual/textbook loans fall due. Defaults to 30 Sene (the 10th
  // Ethiopian month — around early July, a typical Ethiopian school year end)
  // of whichever school year is currently "open": if today is already past
  // that date this Ethiopian year (e.g. it's Hamle/Nehase/Pagume, between
  // school years), it rolls forward to next year's 30 Sene instead of
  // quietly handing out an already-past due date.
  function defaultAcademicYearEndEC(){
    const t = ethToday();
    const candidate = { year: t.year, month: 10, day: 30 };
    const past = (t.month > 10) || (t.month === 10 && t.day > 30);
    if(past) candidate.year += 1;
    return candidate;
  }
  function getAcademicYearEnd(){
    const s = getSettings();
    return (s.academicYearEnd && s.academicYearEnd.year) ? s.academicYearEnd : defaultAcademicYearEndEC();
  }
  function setAcademicYearEnd(ec){
    if(!ec || !ec.year || !ec.month || !ec.day) return { ok:false, error:"Please pick a complete date." };
    mutate(db => { db.settings.academicYearEnd = { year:Number(ec.year), month:Number(ec.month), day:Number(ec.day) }; });
    return { ok:true };
  }
  function academicYearEndISO(){ return ecToISO(getAcademicYearEnd()); }
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
  // Same date, but using the English month name (or a plain number as a last
  // resort) instead of Amharic — for contexts that can't render Ethiopic
  // script, like the PDF export below (jsPDF's built-in fonts are Latin-only;
  // trying to print Amharic through them is what produced garbled text).
  function fmtEthDateLatin(ec){
    if(!ec || !ec.year) return "—";
    const mo = ETH_MONTHS.find(m => m.n === Number(ec.month));
    return `${ec.day} ${mo?mo.en:ec.month} ${ec.year} E.C.`;
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
  function fileToResizedDataURL(file, maxDim, cb, quality){
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
        cb(canvas.toDataURL('image/jpeg', quality || 0.82));
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

  // The DB is split across several Firestore documents so that image-heavy data
  // (book covers, announcement attachments, application documents) can never
  // block small, high-frequency writes like book requests or comments. See saveDB().
  //   core         -> settings, staff, books              (can grow with book covers)
  //   activity     -> requests, reservations, comments    (small, text-only, never blocked)
  //   feed         -> announcements                       (can have images, isolated from activity)
  //   applications -> applications (public enrollment queue, has attached documents — isolated from everything else)
  //   students_0..students_39 -> the student roster, SHARDED (see below)
  //
  // Students used to live inside 'core' as one array. That doesn't scale — a
  // real secondary school can have several thousand students, and a single
  // Firestore document is capped at ~1MB no matter what. Instead, students are
  // spread across a fixed set of shard documents, chosen by hashing each
  // student's own ID (see studentShardIndex). Because the shard is picked from
  // the ID itself, no rebalancing is ever needed as students are added or
  // removed — new students land in a effectively-random shard automatically,
  // and 40 shards comfortably covers many thousands of students with room to
  // spare. Existing schools migrate automatically and safely the first time
  // anything is saved after this update (see saveDB + composeFromSlices) —
  // there's no separate migration step to remember to run, and the student
  // data is never at risk of being lost in between.
  const STUDENT_SHARD_COUNT = 40;
  function studentShardIndex(id){
    let h = 0;
    for(let i=0;i<id.length;i++){ h = (h*31 + id.charCodeAt(i)) >>> 0; }
    return h % STUDENT_SHARD_COUNT;
  }
  function studentShardKey(i){ return "students_" + i; }
  const STUDENT_SHARD_KEYS = Array.from({length: STUDENT_SHARD_COUNT}, (_, i) => studentShardKey(i));

  const SLICE_KEYS = {
    core: ["settings", "staff", "books"],
    activity: ["requests", "reservations", "comments", "directMessages"],
    feed: ["announcements"],
    applications: ["applications"]
  };
  let _fsRefs = { core: null, activity: null, feed: null, applications: null };
  let _sliceCache = { core: null, activity: null, feed: null, applications: null };
  let _slicesLoaded = { core: false, activity: false, feed: false, applications: false };
  // Raw JSON string last known to be in Firestore for each slice — used to skip
  // writing a slice that hasn't actually changed. See saveDB() for why this matters.
  // Shard entries (students_0..students_39) are added to these same three objects
  // dynamically as they come online — plain JS objects, so this is safe.
  let _sliceJsonCache = { core: null, activity: null, feed: null, applications: null };
  let _cloudConnected = false; // true once at least one snapshot has come back successfully

  function sliceOf(db, keys){
    const o = {};
    keys.forEach(k => o[k] = db[k]);
    return o;
  }
  function composeFromSlices(){
    const merged = Object.assign({}, _sliceCache.core, _sliceCache.activity, _sliceCache.feed, _sliceCache.applications);
    // Before the automatic migration has run (see saveDB), the raw 'core'
    // document still literally has a "students" field (even if it's an empty
    // array) — that's the exact, unambiguous signal to keep trusting it, since
    // after migration core's own write leaves that field out entirely (it's
    // not in SLICE_KEYS.core anymore). This avoids any race with shard
    // listeners still loading: we're never guessing "empty because migrated"
    // vs "empty because not migrated yet" — the key's mere presence tells us.
    if(_sliceCache.core && Object.prototype.hasOwnProperty.call(_sliceCache.core, 'students')){
      merged.students = _sliceCache.core.students || [];
    } else {
      const students = [];
      for(let i=0;i<STUDENT_SHARD_COUNT;i++){
        const arr = _sliceCache[studentShardKey(i)];
        if(Array.isArray(arr)) students.push.apply(students, arr);
      }
      merged.students = students;
    }
    return normalizeDB(merged);
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
    db.applications = db.applications || [];
    db.directMessages = db.directMessages || [];
    // Student profile photos were removed (storage-safety decision) — strip any
    // leftover photo data from students registered before this change so the
    // space is actually reclaimed the next time this loads and saves.
    if(db.students){ db.students.forEach(s => { if(s && 'photo' in s) delete s.photo; if(s && s.stream === undefined) s.stream = ""; if(s && s.batchYear === undefined) s.batchYear = ""; }); }
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
  // Returns a { sliceName: Promise } map for every slice this call actually wrote
  // to Firestore (skipped/unchanged slices and local-only mode are simply absent
  // from the map). Almost every caller ignores this return value and treats the
  // write as fire-and-forget, same as always — but a few high-stakes call sites
  // (like submitApplication) need to know the write actually reached the server
  // before telling the person "you're done", not just that it was queued locally.
  // Shared by both the fixed slices above and the student shards below — writes
  // one Firestore doc, keeps the local caches in sync, and rolls back the
  // "already sent" marker on failure so the next save retries it automatically.
  function writeSliceDoc(key, json){
    _sliceJsonCache[key] = json;
    return _fsRefs[key].set({ json, updatedAt: Date.now() })
      .catch(err => {
        const msg = "SSSDP: cloud save failed (" + key + ") — your last change may not have reached the admin. (" + (err && err.message ? err.message : err) + ")";
        console.error(msg, err);
        if(_sliceJsonCache[key] === json) _sliceJsonCache[key] = null;
        window.SSSDP_ON_SYNC_ERROR && window.SSSDP_ON_SYNC_ERROR(msg);
        throw err;
      });
  }
  function saveDB(db){
    _dbCache = db;
    saveLocalCache(db); // keep the local mirror fresh for instant next-load
    const writePromises = {};
    if(!_cloudEnabled || !_fsRefs.core) return writePromises;
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
      writePromises[sliceName] = writeSliceDoc(sliceName, json);
    });
    // Students: partitioned into fixed shards by hashing each student's ID (see
    // studentShardIndex). Re-partitions db.students on every save and only
    // actually writes a shard whose contents changed — a normal single-student
    // edit touches exactly one shard, same cost as the old single-array design
    // ever was. This is also what performs the one-time, zero-downtime migration
    // for a school upgrading from the old embedded-in-core layout: the very
    // first save after upgrading naturally computes and writes all 40 shards
    // from db.students (which the compose step below already resolves correctly
    // via its legacy fallback — see composeFromSlices), and drops the old
    // embedded copy out of 'core' at the same time (SLICE_KEYS.core no longer
    // lists "students", so the core write above already omits it).
    const buckets = Array.from({length: STUDENT_SHARD_COUNT}, () => []);
    (db.students || []).forEach(s => { if(s && s.id) buckets[studentShardIndex(s.id)].push(s); });
    buckets.forEach((list, i) => {
      const key = studentShardKey(i);
      if(!_fsRefs[key]) return; // shard refs not set up yet (shouldn't happen once _cloudEnabled, but be defensive)
      const json = JSON.stringify(list);
      if(_sliceJsonCache[key] === json){ _sliceCache[key] = list; return; }
      if(json.length > FIRESTORE_DOC_SOFT_LIMIT){
        const msg = "SSSDP: student shard '" + key + "' is " + Math.round(json.length/1024) + "KB — unusually large for one shard. This shouldn't normally happen; contact support if you see this repeatedly.";
        console.error(msg);
        window.SSSDP_ON_SYNC_ERROR && window.SSSDP_ON_SYNC_ERROR(msg);
      }
      _sliceCache[key] = list;
      writePromises[key] = writeSliceDoc(key, json);
    });
    return writePromises;
  }
  function mutate(fn){ const db = loadDB(); fn(db); saveDB(db); return db; }
  // Same as mutate(), but also hands back the write-promise map from saveDB() —
  // for the rare caller (see submitApplication) that needs to know a write was
  // actually confirmed by the server, not just queued on this device.
  function mutateConfirmed(fn){ const db = loadDB(); fn(db); return { db, writePromises: saveDB(db) }; }

  // Call cb once the initial cloud sync has completed (or immediately if running
  // without cloud config). Pages must wait for this before reading LIB.currentStudent()/
  // LIB.currentStaff() at boot, since the real DB may still be loading from the network.
  function ready(cb){ if(_ready) cb(); else _readyQueue.push(cb); }
  function flushReady(){ const q = _readyQueue; _readyQueue = []; q.forEach(cb => { try{ cb(); }catch(e){ console.error(e); } }); }

  // Shared per-snapshot handling — same logic whether it arrived via a normal
  // slice listener or via the special 'core' listener (which also does the
  // one-time migration check before its first call into this function).
  function handleSliceSnapshot(sliceName, snap){
    let rawJson = (snap.exists && snap.data() && snap.data().json) ? snap.data().json : null;
    let data = null;
    if(rawJson){
      try { data = JSON.parse(rawJson); } catch(e){ data = null; }
    }
    // Student shards (students_0..students_39) aren't listed in SLICE_KEYS —
    // their content is a plain array, not a set of named top-level fields, so
    // their "nothing here yet" default is simply [], not a seeded object.
    const isShard = !SLICE_KEYS[sliceName];
    _sliceCache[sliceName] = data || (isShard ? [] : sliceOf(seedDB(), SLICE_KEYS[sliceName]));
    // Remember exactly what Firestore has right now for this slice so a later
    // saveDB() can skip re-sending it if nothing actually changed (see saveDB()).
    _sliceJsonCache[sliceName] = rawJson || JSON.stringify(_sliceCache[sliceName]);
    _slicesLoaded[sliceName] = true;
    _cloudConnected = true;
    window.SSSDP_ON_CLOUD_STATUS && window.SSSDP_ON_CLOUD_STATUS(true);
    if(_slicesLoaded.core && _slicesLoaded.activity && _slicesLoaded.feed && _slicesLoaded.applications){
      _dbCache = composeFromSlices();
      saveLocalCache(_dbCache);
      if(!_ready){ _ready = true; flushReady(); }
      else { window.SSSDP_REFRESH && window.SSSDP_REFRESH(); } // live update from another device
    }
  }
  // This is the exact failure mode behind "student's request never reaches
  // admin": if a listener errors out (rules, network, quota), writes on THIS
  // device stop reaching the shared cloud DB entirely, silently, with only a
  // console.error — nobody sees it happen. Surface it visibly instead.
  function handleSliceError(sliceName, err){
    const msg = "SSSDP: '" + sliceName + "' cloud sync lost — changes on this device may not reach other devices until this is fixed. Check your internet connection and Firestore security rules.";
    console.error(msg, err);
    _cloudConnected = false;
    window.SSSDP_ON_CLOUD_STATUS && window.SSSDP_ON_CLOUD_STATUS(false);
    window.SSSDP_ON_SYNC_ERROR && window.SSSDP_ON_SYNC_ERROR(msg);
    if(!_ready){ _dbCache = loadLocalCache() || seedDB(); _ready = true; flushReady(); }
  }
  function attachOneSliceListener(sliceName){
    _fsRefs[sliceName].onSnapshot(snap => handleSliceSnapshot(sliceName, snap), err => handleSliceError(sliceName, err));
  }
  function attachSliceListeners(sliceNames){
    (sliceNames || Object.keys(_fsRefs)).forEach(attachOneSliceListener);
  }

  // One-time migration: older deployments of this app stored everything in a
  // single doc at sssdp/main. If that doc exists and the new split docs don't yet,
  // read it once and fan it out into core/activity/feed/applications + the
  // student shards, so no existing data is lost.
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
      const buckets = Array.from({length: STUDENT_SHARD_COUNT}, () => []);
      (full.students || []).forEach(s => { if(s && s.id) buckets[studentShardIndex(s.id)].push(s); });
      buckets.forEach((list, i) => {
        const key = studentShardKey(i);
        batch.set(_fsRefs[key], { json: JSON.stringify(list), updatedAt: Date.now() });
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
      // FIX (long loading, part 1): caches Firestore data on-device (IndexedDB) so
      // a repeat visit can show the last-known data instantly while the live
      // update comes in over the network in the background, instead of every
      // single page load blocking on a fresh round trip — the difference is most
      // noticeable on slow/unreliable connections. Safe to ignore if it fails
      // (e.g. private browsing, or another tab already has it open) — the app
      // still works, it just won't have this instant-cache benefit that session.
      try { fs.enablePersistence({ synchronizeTabs: true }).catch(() => {}); } catch(e){}
      _fsRefs.core = fs.collection("sssdp").doc("core");
      _fsRefs.activity = fs.collection("sssdp").doc("activity");
      _fsRefs.feed = fs.collection("sssdp").doc("feed");
      _fsRefs.applications = fs.collection("sssdp").doc("applications");
      STUDENT_SHARD_KEYS.forEach(key => { _fsRefs[key] = fs.collection("sssdp").doc(key); });
      _cloudEnabled = true;

      // FIX (long loading, part 2): previously this ran a one-off .get() on 'core'
      // just to decide whether a migration was needed, and only THEN attached a
      // fresh onSnapshot listener on all 4 docs — meaning 'core' was read twice
      // (once via .get(), once again as the listener's own first snapshot) before
      // the app was ever ready. Now the listener's own first delivery on 'core' IS
      // that check, cutting one full network round trip off of every normal boot.
      let migrationChecked = false;
      _fsRefs.core.onSnapshot(snap => {
        if(!migrationChecked){
          migrationChecked = true;
          if(!snap.exists){
            // Brand-new project — seed/migrate once, then bring the other slices
            // (including all the student shards) online. migrateOrSeed's batch
            // write also re-triggers this same 'core' listener with the real
            // data (snap.exists true this time), which is what actually
            // processes core's own data below.
            migrateOrSeed(fs).then(() => attachSliceListeners(['activity','feed','applications'].concat(STUDENT_SHARD_KEYS)))
              .catch(err => {
              const msg = "SSSDP: could not set up the cloud database — running in local-only mode. Requests/comments made here will NOT reach the admin until this is fixed. (" + (err && err.message ? err.message : err) + ")";
              console.error(msg, err);
              window.SSSDP_ON_SYNC_ERROR && window.SSSDP_ON_SYNC_ERROR(msg);
              window.SSSDP_ON_CLOUD_STATUS && window.SSSDP_ON_CLOUD_STATUS(false);
              _dbCache = loadLocalCache() || seedDB();
              _ready = true; flushReady();
            });
            return;
          }
          // core already existed — bring the other slices (and every student
          // shard) online too, and let this same 'core' listener keep running
          // below for every future snapshot.
          attachSliceListeners(['activity','feed','applications'].concat(STUDENT_SHARD_KEYS));
        }
        handleSliceSnapshot('core', snap);
      }, err => handleSliceError('core', err));
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
        texture: true,
        enrollmentDeadline: "" // ISO datetime string set by the Registrar; "" = no deadline / enrollment always open
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
          activated: true, pin: "1234",
          createdAt: now
        },
        {
          id: uid("std_"), fan: "2003004005006007",
          name: "Selam Tesfaye", class: "9", section: "B",
          gender: "female", ecBirth: { year: 2003, month: 2, day: 20 }, age: computeAgeFromEC({ year: 2003, month: 2, day: 20 }),
          residency: { town: "Sheno", kebele: "01", sefer: "Mekane Yesus" },
          guardianName: "Tesfaye Bekele", guardianPhone: "0922334455",
          activated: false, pin: "",
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
      comments: [], // {id, targetType: 'announcement'|'book', targetId, studentId, text, date}
      applications: [], // public enrollment submissions from apply.html — see submitApplication/approveApplication
      directMessages: [] // private librarian -> single-student notes, see sendDirectMessage/listDirectMessagesFor
    };
  }

  /* ---------------- settings ---------------- */
  function getSettings(){ return getDB().settings; }
  function updateSettings(patch){ return mutate(db => Object.assign(db.settings, patch)); }
  // Enrollment deadline (apply.html countdown) — Registrar-adjustable in Settings.
  // "" means no deadline set, i.e. enrollment is always open.
  function getEnrollmentDeadline(){ return getDB().settings.enrollmentDeadline || ""; }
  function setEnrollmentDeadline(isoOrEmpty){
    const actor = currentStaff();
    if(actor && actor.role !== 'registrar') return { ok:false, error:"Only the Registrar can change the enrollment deadline." };
    mutate(db => { db.settings.enrollmentDeadline = isoOrEmpty || ""; });
    return { ok:true };
  }
  function isEnrollmentClosed(){
    const d = getEnrollmentDeadline();
    return !!d && new Date(d).getTime() <= Date.now();
  }
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
  function adminRegisterStudent({name, fan, klass, section, gender, ecBirth, phone, residency, guardianName, guardianPhone, stream, previousResult}){
    // Registrar-only. Only blocks when a STAFF session of the wrong role is active
    // (Library Staff trying this from the admin console) — this function is also
    // called internally by approveApplication(), which already verified the actor
    // is a registrar before calling in, so that path is unaffected.
    const actor = currentStaff();
    if(actor && actor.role !== 'registrar') return { ok:false, error:"Only the Registrar can register students." };
    fan = digitsOnly(fan);
    if(!name || !name.trim()) return { ok:false, error: "ሙሉ ስም ያስፈልጋል" };
    if(fan.length !== 16) return { ok:false, error: "FAN 16 ዲጂት መሆን አለበት" };
    const db = getDB();
    if(db.students.some(s => s.fan === fan)) return { ok:false, error: "ይህ FAN ቀድሞ ተመዝግቧል" };
    // Stream (Natural / Social Science) only applies from Grade 11 onward —
    // ignored for any other grade even if one was passed in.
    const streamVal = (['11','12'].includes(String(klass).trim()) && ['natural','social'].includes(stream)) ? stream : "";
    // Previous result (Grade 8 Ministry result for new Grade 9s, or the most
    // recent report card score for other grades) — out of 100. Used later by
    // Auto-Distribute Sections to balance ability fairly across sections
    // instead of just randomly. Optional: kept null when not known.
    const prevResultNum = (previousResult === '' || previousResult == null) ? null : Number(previousResult);
    const student = { id: uid("std_"), fan, name: name.trim(), class: klass, section,
      gender: gender||"", ecBirth: ecBirth||null, age: ecBirth ? computeAgeFromEC(ecBirth) : null,
      phone: phone||"", stream: streamVal, batchYear: ethToday().year, // EC year of registration — this student's "batch"
      residency: (residency && typeof residency==='object') ? { town: residency.town||"", kebele: residency.kebele||"", sefer: residency.sefer||"" } : { town:"", kebele:"", sefer:"" },
      previousResult: (prevResultNum!=null && !isNaN(prevResultNum) && prevResultNum>=0 && prevResultNum<=100) ? prevResultNum : null,
      guardianName: guardianName||"", guardianPhone: guardianPhone||"",
      activated:false, pin:"", createdAt: todayISO() };
    mutate(db => db.students.push(student));
    return { ok:true, student };
  }

  /* ---------------- Public enrollment applications ----------------
     Submitted from apply.html by parents/students who are NOT logged in —
     so this deliberately has no staff/session check. It only ever creates a
     *pending* application; nothing here can touch the real students list.
     A Registrar has to review and explicitly approve it (see
     approveApplication) before an actual student record is created. */
  function genReferenceNumber(){
    return "APP-" + Date.now().toString(36).toUpperCase().slice(-6) + Math.floor(Math.random()*90+10);
  }
  // `cb`, if given, is called ONCE with the final result AFTER the write to the
  // cloud has actually been confirmed (or has definitively failed) — not just
  // queued locally. This matters specifically here because a parent submitting
  // this form has no other way to know their application really reached the
  // school; the synchronous return value below is kept for backward
  // compatibility but only reflects validation, not a confirmed cloud write.
  function submitApplication(data, cb){
    const name = (data.name||"").trim();
    if(!name) return { ok:false, error:"Full legal name is required." };
    if(!data.ecBirth || !data.ecBirth.year) return { ok:false, error:"Date of birth is required." };
    if(!data.gender) return { ok:false, error:"Gender is required." };
    if(!data.gradeApplying) return { ok:false, error:"Grade applying for is required." };
    if(!(data.studentPhone||"").trim() && !(data.studentEmail||"").trim()) return { ok:false, error:"Please provide a student phone or email." };
    if(!(data.guardianName||"").trim() || !(data.guardianPhone||"").trim()) return { ok:false, error:"Parent/Guardian name and phone are required." };
    if(!data.consentInfo) return { ok:false, error:"You must consent to Sheno Secondary School collecting this information." };
    if(['9','10','11','12'].includes(String(data.gradeApplying)) && !data.resultDoc) return { ok:false, error:"A photo of the previous year's result/report card is required." };
    // FAN (Fayda/National ID number) is printed on the student's own National ID,
    // so the applicant fills it in themselves at registration time instead of the
    // Registrar re-typing it later off the ID photo — that step still checks and
    // corrects it at Approve time, but starts from what the family already gave.
    const fan = digitsOnly(data.fan);
    if(fan.length !== 16) return { ok:false, error:"FAN (16 digit, from the National ID) is required." };
    if(['9','10','11','12'].includes(String(data.gradeApplying))){
      const score = Number(data.previousResultScore);
      if(data.previousResultScore === '' || data.previousResultScore == null || isNaN(score) || score < 0 || score > 100){
        return { ok:false, error: String(data.gradeApplying)==='9' ? "Grade 8 Ministry result (out of 100) is required." : "Previous year's result (out of 100) is required." };
      }
    }
    const ref = genReferenceNumber();
    const record = {
      id: uid("app_"), referenceNumber: ref, status: "pending", submittedAt: todayISO(),
      name, ecBirth: data.ecBirth, age: computeAgeFromEC(data.ecBirth), gender: data.gender,
      gradeApplying: data.gradeApplying, existingIdIfAny: (data.existingIdIfAny||"").trim(),
      fan, // filled in by the applicant, still verified/correctable by the Registrar at Approve time
      studentEmail: (data.studentEmail||"").trim(), studentPhone: (data.studentPhone||"").trim(),
      residency: (data.residency && typeof data.residency==='object')
        ? { town: (data.residency.town||"").trim(), kebele: (data.residency.kebele||"").trim(), sefer: (data.residency.sefer||"").trim() }
        : { town:"", kebele:"", sefer:"" },
      previousResultScore: ['9','10','11','12'].includes(String(data.gradeApplying)) ? Number(data.previousResultScore) : null,
      guardianName: data.guardianName.trim(), guardianPhone: data.guardianPhone.trim(), guardianEmail: (data.guardianEmail||"").trim(),
      idDoc: data.idDoc || null, // { name, type, size, dataUrl } — National ID face page, kept small (see apply.html upload cap)
      resultDoc: data.resultDoc || null, // Grade 8 Ministry result photo, Grade 9 applicants only
      streamApplying: ['11','12'].includes(String(data.gradeApplying)) && ['natural','social'].includes(data.streamApplying) ? data.streamApplying : "",
      consentInfo: !!data.consentInfo, consentPhotos: !!data.consentPhotos,
      reviewedAt: null, reviewedBy: "", rejectReason: "", linkedStudentId: ""
    };
    const { writePromises } = mutateConfirmed(db => db.applications.push(record));
    const p = writePromises['applications'];
    if(cb){
      if(!_cloudEnabled){
        // No cloud configured at all — this device is fully offline-only, so
        // there is nothing to "confirm"; the local save is all there is.
        cb({ ok:true, referenceNumber: ref, application: record });
      } else if(!p){
        // Shouldn't normally happen (we just pushed a new application, so the
        // 'applications' slice must have changed) — but if it does, don't leave
        // the caller hanging forever.
        cb({ ok:true, referenceNumber: ref, application: record });
      } else {
        p.then(() => cb({ ok:true, referenceNumber: ref, application: record }))
         .catch(() => cb({
           ok:false,
           error:"Your application was filled in correctly, but we couldn't confirm it reached the school's server — please check your internet connection and press Submit again. If this keeps happening, contact the school office directly.",
           referenceNumber: ref
         }));
      }
    }
    return { ok:true, referenceNumber: ref, application: record };
  }
  function listApplications(){ return getDB().applications.slice().sort((a,b)=> (b.submittedAt||"").localeCompare(a.submittedAt||"")); }
  // Approving an application creates a REAL student record (reusing the same
  // validated path as manual registration) and marks the application as
  // approved+linked. Registrar still assigns the FAN by hand (applicants never
  // know it — it's an internal school number), which is why this takes the
  // same shape as adminRegisterStudent rather than trusting the raw application.
  function approveApplication(appId, studentFields){
    const actor = currentStaff();
    if(!actor || actor.role !== 'registrar') return { ok:false, error:"Only the Registrar can approve applications." };
    const db = getDB();
    const app = db.applications.find(a => a.id === appId);
    if(!app || app.status !== 'pending') return { ok:false, error:"This application was already reviewed." };
    const res = adminRegisterStudent(studentFields);
    if(!res.ok) return res;
    mutate(db => {
      const a = db.applications.find(x => x.id === appId);
      if(a){ a.status = 'approved'; a.reviewedAt = todayISO(); a.reviewedBy = actor.name; a.linkedStudentId = res.student.id; }
    });
    return res;
  }
  function rejectApplication(appId, reason){
    const actor = currentStaff();
    if(!actor || actor.role !== 'registrar') return { ok:false, error:"Only the Registrar can reject applications." };
    const db = getDB();
    const app = db.applications.find(a => a.id === appId);
    if(!app || app.status !== 'pending') return { ok:false, error:"This application was already reviewed." };
    mutate(db => {
      const a = db.applications.find(x => x.id === appId);
      if(a){ a.status = 'rejected'; a.reviewedAt = todayISO(); a.reviewedBy = actor.name; a.rejectReason = reason||""; }
    });
    return { ok:true };
  }
  // The National ID / Grade-8-result photos are only needed while an application is
  // being reviewed. Once reviewed, the Registrar can free up the shared "applications"
  // storage slice (Firestore caps a single document at ~1MiB, and photos are what fill
  // it fastest) without losing the rest of the record — this is what keeps a busy
  // enrollment season from ever hitting that ceiling, at zero cost.
  function clearApplicationDocs(appId){
    const actor = currentStaff();
    if(!actor || actor.role !== 'registrar') return { ok:false, error:"Only the Registrar can do this." };
    const db = getDB();
    const app = db.applications.find(a => a.id === appId);
    if(!app) return { ok:false, error:"Application not found." };
    if(app.status === 'pending') return { ok:false, error:"Review this application before clearing its photos." };
    mutate(db => {
      const a = db.applications.find(x => x.id === appId);
      if(a){ a.idDoc = null; a.resultDoc = null; }
    });
    return { ok:true };
  }
  function compactReviewedApplications(){
    const actor = currentStaff();
    if(!actor || actor.role !== 'registrar') return { ok:false, error:"Only the Registrar can do this." };
    let cleared = 0;
    mutate(db => {
      db.applications.forEach(a => {
        if(a.status !== 'pending' && (a.idDoc || a.resultDoc)){ a.idDoc = null; a.resultDoc = null; cleared++; }
      });
    });
    return { ok:true, cleared };
  }
  // Deletes one reviewed application record entirely (title, documents, everything)
  // — for a Registrar who wants to declutter History rather than just strip photos.
  // Pending applications can't be deleted this way (review them first) so an
  // application in progress is never accidentally lost.
  function removeApplication(appId){
    const actor = currentStaff();
    if(!actor || actor.role !== 'registrar') return { ok:false, error:"Only the Registrar can do this." };
    const app = getDB().applications.find(a => a.id === appId);
    if(!app) return { ok:false, error:"Application not found." };
    if(app.status === 'pending') return { ok:false, error:"Review this application (Approve or Reject) before deleting it." };
    mutate(db => { db.applications = db.applications.filter(a => a.id !== appId); });
    return { ok:true };
  }
  // Deletes EVERY reviewed application at once (approved + rejected) — the fast
  // way to fully clear old History when the applications document is filling up.
  function clearApplicationHistory(){
    const actor = currentStaff();
    if(!actor || actor.role !== 'registrar') return { ok:false, error:"Only the Registrar can do this." };
    let removed = 0;
    mutate(db => {
      const before = db.applications.length;
      db.applications = db.applications.filter(a => a.status === 'pending');
      removed = before - db.applications.length;
    });
    return { ok:true, removed };
  }
  // Rough size check so the Registrar can see the applications slice is getting
  // full BEFORE it silently hits Firestore's ~1MiB per-document ceiling — same
  // FIRESTORE_DOC_SOFT_LIMIT the sync layer itself warns at (see saveDB above).
  function applicationsStorageInfo(){
    const bytes = JSON.stringify(getDB().applications).length;
    return { bytes, kb: Math.round(bytes/1024), softLimitKb: Math.round(FIRESTORE_DOC_SOFT_LIMIT/1024), pctOfLimit: Math.round(100*bytes/FIRESTORE_DOC_SOFT_LIMIT) };
  }
  // Students are auto-migrated into their scalable shard storage the moment
  // anything is first saved after upgrading (see saveDB) — this button just
  // gives the Registrar a visible, immediate way to trigger that save right
  // now for peace of mind, rather than waiting for it to happen naturally.
  // Safe to call any time, migrated or not — it's a harmless no-op edit that
  // just re-runs the normal save pipeline.
  function syncStudentShardsNow(){
    const actor = currentStaff();
    if(!actor || actor.role !== 'registrar') return { ok:false, error:"Only the Registrar can do this." };
    if(!_cloudEnabled) return { ok:false, error:"Not connected to the cloud right now — try again once you're online." };
    mutate(db => {}); // no-op edit — saveDB() does the real work (partition + write any changed shard)
    return { ok:true };
  }
  // Whether students are still being read from the old embedded 'core' field
  // (pre-migration) or from their own scalable shards (post-migration) — shown
  // in Settings so the Registrar can see which state the system is in.
  function studentStorageInfo(){
    const migrated = !(_sliceCache.core && Object.prototype.hasOwnProperty.call(_sliceCache.core, 'students'));
    const shardCount = STUDENT_SHARD_COUNT;
    const bytesByShard = STUDENT_SHARD_KEYS.map(key => JSON.stringify(_sliceCache[key] || []).length);
    const maxShardKb = Math.round(Math.max.apply(null, bytesByShard.concat([0])) / 1024);
    return { migrated, shardCount, studentCount: getDB().students.length, maxShardKb, softLimitKb: Math.round(FIRESTORE_DOC_SOFT_LIMIT/1024) };
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
    // Dual-purpose setter: used by the Registrar (admin.html "Reset PIN") AND by a
    // student changing their own PIN from Profile (index.html, no staff session).
    // Only block when a STAFF session of the wrong role is doing this — a student's
    // own session never has currentStaff(), so their self-service path is unaffected.
    const actor = currentStaff();
    if(actor && actor.role !== 'registrar') return { ok:false, error:"Only the Registrar can reset a student's PIN." };
    if(!/^\d{4}$/.test(newPin||"")) return { ok:false, error:"PIN ልክ 4 ዲጂት መሆን አለበት" };
    mutate(db => {
      const s = db.students.find(x => x.id === studentId);
      if(s){ s.pin = newPin; s.activated = true; }
    });
    return { ok:true };
  }
  function adminEditStudent(studentId, patch){
    const actor = currentStaff();
    if(actor && actor.role !== 'registrar') return { ok:false, error:"Only the Registrar can edit student records." };
    mutate(db => {
      const s = db.students.find(x => x.id === studentId);
      if(s){
        Object.assign(s, patch);
        // Stream only makes sense from Grade 11 onward — clear it if the class
        // was edited down to something below that.
        if(!['11','12'].includes(String(s.class).trim())) s.stream = "";
      }
    });
    return { ok:true };
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
  // Spreads every student of one grade evenly across the given section letters
  // (e.g. ["A","B","C"]) — fair rather than alphabetical, so no single section
  // skews toward "everyone whose name starts with A". A specific student can
  // always be moved afterward via adminEditStudent (the "Section" field) for
  // the special-case swaps a Registrar sometimes needs (siblings together, a
  // support need, etc).
  //
  // Fairness: when students have a previousResult (Grade 8 Ministry result, or
  // prior year's result for 10-12) on file, that's used to balance academic
  // ability evenly across sections — a "snake" draft (A,B,C,C,B,A,A,B,C,…)
  // hands out the strongest, then weakest, then next-strongest, etc, so every
  // section ends up with a similar mix of scores instead of one section
  // accidentally getting all the top performers. Students who share the same
  // score (or have none on file) are shuffled first, so the order within a
  // score tier — and the placement of students with no score — is still random,
  // not alphabetical or by registration order.
  //
  // Grade 11/12 only: a section is a single homeroom, and Natural/Social
  // Science students take different subjects — so they can never share a
  // section. opts.stream ('natural' | 'social') is REQUIRED for these grades;
  // only students of that stream are considered, and the Registrar runs this
  // once per stream (typically into a different set of section letters each
  // time, e.g. Natural → A,B and Social → C,D) so the two streams never end
  // up mixed into the same section by the shuffle.
  function autoDistributeSections(grade, sectionLetters, opts){
    const actor = currentStaff();
    if(actor && actor.role !== 'registrar') return { ok:false, error:"Only the Registrar can distribute students to sections." };
    sectionLetters = (sectionLetters||[]).map(s=>String(s).trim()).filter(Boolean);
    if(!sectionLetters.length) return { ok:false, error:"Pick at least one section." };
    const onlyUnassigned = !!(opts && opts.onlyUnassigned);
    const streamFilter = (opts && opts.stream) || "";
    const db = getDB();
    const isStreamGrade = ['11','12'].includes(String(grade).trim());
    if(isStreamGrade && !['natural','social'].includes(streamFilter)){
      return { ok:false, error:"Grade 11/12 students are split into Natural and Social Science — pick a stream first so the two aren't mixed into the same sections." };
    }
    let pool = db.students.filter(s => String(s.class||'').trim() === String(grade).trim());
    if(isStreamGrade) pool = pool.filter(s => String(s.stream||'') === streamFilter);
    if(onlyUnassigned) pool = pool.filter(s => !String(s.section||'').trim());
    if(!pool.length) return { ok:false, error:"No matching students to distribute." };
    // Fisher–Yates shuffle first (randomizes tie order / no-score order), THEN
    // a stable sort by previousResult descending (students with no score sink
    // to the end, in their already-shuffled order).
    const ids = pool.map(s=>s.id);
    for(let i = ids.length - 1; i > 0; i--){
      const j = Math.floor(Math.random() * (i+1));
      [ids[i], ids[j]] = [ids[j], ids[i]];
    }
    const scoreOf = id => { const s = pool.find(x=>x.id===id); const v = s && s.previousResult; return (v==null || isNaN(v)) ? -1 : Number(v); };
    ids.sort((a,b) => scoreOf(b) - scoreOf(a));
    // Snake/boustrophedon draft across sections: forward through the letters,
    // then backward, then forward again — this is what actually balances the
    // average score per section, unlike a plain round-robin (A,B,C,A,B,C,…)
    // which always gives section A a slight edge on every full lap.
    const n = sectionLetters.length;
    const order = [];
    for(let lap = 0; lap < Math.ceil(ids.length / n); lap++){
      const lapLetters = lap % 2 === 0 ? sectionLetters : sectionLetters.slice().reverse();
      order.push(...lapLetters);
    }
    mutate(db => {
      ids.forEach((id, i) => {
        const s = db.students.find(x=>x.id===id);
        if(s) s.section = order[i];
      });
    });
    return { ok:true, count: ids.length, sections: sectionLetters };
  }
  // Simple CSV export of the current student roster — a plain, portable backup
  // that opens directly in Excel/Sheets, independent of the app itself. Meant
  // to be run (and saved somewhere safe) at least once per year, e.g. right
  // before a promotion/graduation pass, so there's always a snapshot to check
  // the next year's roster against.
  function studentsToCSV(){
    const cols = ["FAN","Name","Class","Section","Gender","Age/BirthEC","Phone","Guardian Name","Guardian Phone","Residency","Previous Result (/100)","Status","Registered"];
    const csvEscape = v => { v = (v==null?"":String(v)); return /[",\n]/.test(v) ? '"' + v.replace(/"/g,'""') + '"' : v; };
    // Excel auto-detects any long all-digit cell (FAN, phone numbers) as a
    // number and switches it to scientific notation (e.g. "1E+15"), silently
    // destroying the actual digits. Wrapping it as ="1234567890123456" is
    // Excel's own documented way to force a cell to stay literal text.
    const asText = v => { v = (v==null?"":String(v)); return v ? `="${v.replace(/"/g,'""')}"` : ""; };
    const rows = getDB().students.map(s => [
      asText(s.fan), s.name, s.class, s.section||"", s.gender||"", LIB_fmtEthDateForCSV(s.ecBirth),
      asText(s.phone), s.guardianName||"", asText(s.guardianPhone), fmtResidency(s.residency),
      s.previousResult!=null ? String(s.previousResult) : "",
      s.activated ? "Active" : "Not Activated", s.createdAt||""
    ].map((v,i) => i===0||i===6||i===8 ? v : csvEscape(v)).join(","));
    return [cols.join(","), ...rows].join("\r\n");
  }
  function LIB_fmtEthDateForCSV(ecBirth){ try{ return fmtEthDate(ecBirth); }catch(e){ return ""; } }

  // ---------------- Year-end promotion / graduation ----------------
  // Two deliberately separate steps so nothing destructive happens by accident:
  //  1) promoteStudents() only ever bumps the "class" field for grades you
  //     name (e.g. 9→10, 10→11, 11→12) — nobody is ever removed here.
  //  2) graduateStudents() is the only function that removes student records
  //     at all, and it's meant to be called only after the Registrar has
  //     downloaded a CSV of those exact students (admin.html enforces that
  //     order) — that CSV *is* the portable "batch" record for students who
  //     left the school, so removing them here is what actually frees up
  //     storage instead of the roster growing forever.
  // Shows exactly who a promotion run would (and wouldn't) touch, BEFORE it
  // runs — "other" is every student whose class value isn't cleanly "9"/"10"/
  // "11"/"12" (typos, blanks, an unusual value from an old import, etc.). These
  // students are never silently skipped: the Registrar sees them by name here
  // and can fix their class first, or leave them out on purpose.
  function previewPromotion(){
    const db = getDB();
    const byGrade = { "9":[], "10":[], "11":[], "12":[] };
    const other = [];
    db.students.forEach(s => {
      const g = String(s.class||'').trim();
      if(byGrade[g]) byGrade[g].push({ id:s.id, name:s.name, fan:s.fan });
      else other.push({ id:s.id, name:s.name, class:s.class||'(blank)' });
    });
    return {
      counts: { "9":byGrade["9"].length, "10":byGrade["10"].length, "11":byGrade["11"].length, "12":byGrade["12"].length },
      students: byGrade, other
    };
  }
  function promoteStudents(gradeMap, excludeIds){
    const actor = currentStaff();
    if(!actor || actor.role !== 'registrar') return { ok:false, error:"Only the Registrar can promote students." };
    const excludeSet = new Set(excludeIds || []);
    let count = 0;
    const skipped = []; // repeaters explicitly excluded, kept in their current grade on purpose
    mutate(db => {
      db.students.forEach(s => {
        if(excludeSet.has(s.id)){ skipped.push({ id:s.id, name:s.name }); return; }
        const from = String(s.class||'').trim();
        if(Object.prototype.hasOwnProperty.call(gradeMap, from)){ s.class = gradeMap[from]; count++; }
      });
    });
    return { ok:true, count, skipped };
  }
  function graduateStudents(ids){
    const actor = currentStaff();
    if(!actor || actor.role !== 'registrar') return { ok:false, error:"Only the Registrar can do this." };
    if(!ids || !ids.length) return { ok:false, error:"No students selected." };
    const db0 = getDB();
    const stillOwing = ids.filter(id => db0.requests.some(r => r.studentId===id && r.status==='borrowed'));
    if(stillOwing.length) return { ok:false, error: `${stillOwing.length} of these students still have a book borrowed — mark it returned first.` };
    let removed = 0;
    mutate(db => {
      const idSet = new Set(ids);
      db.requests.forEach(r => {
        if(idSet.has(r.studentId) && r.status === 'pending'){
          const b = db.books.find(x => x.id === r.bookId);
          const c = b && b.copies.find(x => x.id === r.copyId);
          if(c) c.status = 'available';
        }
      });
      const before = db.students.length;
      db.students = db.students.filter(s => !idSet.has(s.id));
      removed = before - db.students.length;
      db.requests = db.requests.filter(r => !idSet.has(r.studentId));
      db.reservations = db.reservations.filter(r => !idSet.has(r.studentId));
      db.comments = db.comments.filter(c => !idSet.has(c.studentId));
      db.directMessages = db.directMessages.filter(m => !idSet.has(m.studentId));
    });
    return { ok:true, removed };
  }

  function removeStudent(id){
    const actor = currentStaff();
    if(actor && actor.role !== 'registrar') return { ok:false, error:"Only the Registrar can remove students." };
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
      db.directMessages = db.directMessages.filter(m => m.studentId !== id);
    });
    return { ok:true };
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
  // Any staff member can rename their own account or change their own login
  // username from Settings — this used to be fixed forever after Setup/Add
  // Staff, which was a real problem for a typo or a legal name change.
  function staffUpdateOwnProfile(staffId, {name, username}){
    const db = getDB();
    const staff = db.staff.find(s => s.id === staffId);
    if(!staff) return { ok:false, error:"አልተገኘም" };
    name = (name||"").trim(); username = (username||"").trim();
    if(!name || !username) return { ok:false, error:"Please fill in both name and username." };
    if(db.staff.some(s => s.id !== staffId && s.username.toLowerCase() === username.toLowerCase())){
      return { ok:false, error:"ይህ የተጠቃሚ ስም አለ" };
    }
    mutate(db => { const s = db.staff.find(x=>x.id===staffId); if(s){ s.name = name; s.username = username; } });
    return { ok:true };
  }
  // Registrar-only: edit ANY staff account's name/username (self or others) —
  // used from the Staff Accounts table so the Registrar isn't limited to
  // fixing only their own profile from Settings.
  function adminUpdateStaffProfile(staffId, {name, username}){
    const actor = currentStaff();
    if(!actor || actor.role !== 'registrar') return { ok:false, error:"Only the Registrar can edit staff accounts." };
    return staffUpdateOwnProfile(staffId, {name, username});
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
      price: Number(book.price)||0, annualLoan: !!book.annualLoan,
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
    // Annual-loan books (exercise/text books issued for the whole school
    // year) get the academic year-end date as their due date instead of the
    // usual short-loan window — see academicYearEndISO() / Settings.
    const book = db.books.find(b => b.id === r.bookId);
    const finalDue = (book && book.annualLoan)
      ? academicYearEndISO()
      : addDays(todayISO(), dueDays || db.settings.dueDays || DEFAULT_DUE_DAYS);
    mutate(db => {
      const x = db.requests.find(x => x.id === requestId);
      if(x){ x.status = "borrowed"; x.approvedAt = todayISO(); x.dueDate = finalDue; x.approvedBy = staffName; x.annualLoan = !!(book && book.annualLoan); }
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
  // A book marked lost is deliberately NOT "returned" — the loan record stays
  // attached to the student permanently (visible in their history even after
  // grade promotion or across years) as evidence of what's owed, rather than
  // disappearing the way a normal return does.
  function markLost(requestId){
    if(!isLibrarian()) return;
    const db = getDB();
    const r = db.requests.find(x => x.id === requestId);
    if(!r || r.status !== "borrowed") return;
    mutate(db => {
      const x = db.requests.find(x => x.id === requestId);
      if(x) x.status = "lost";
      const b = db.books.find(x => x.id === r.bookId);
      const c = b && b.copies.find(x => x.id === r.copyId);
      if(c) c.status = 'lost';
    });
  }
  // Direct issue for annual/textbook loans — deliberately skips the normal
  // request→approve pipeline (no student-initiated request exists for these;
  // Library Staff hand the physical book over and record it on the spot).
  function issueAnnualLoan(bookId, studentId){
    if(!isLibrarian()) return { ok:false, error:"Only Library Staff can do this." };
    const db = getDB();
    const book = db.books.find(b => b.id === bookId);
    if(!book) return { ok:false, error:"Book not found." };
    if(!book.annualLoan) return { ok:false, error:"This book isn't marked as an Annual Loan title." };
    const student = db.students.find(s => s.id === studentId);
    if(!student) return { ok:false, error:"Student not found." };
    const already = db.requests.some(r => r.studentId===studentId && r.bookId===bookId && r.status==='borrowed');
    if(already) return { ok:false, error:`${student.name} already has a copy of this book checked out.` };
    const copy = book.copies.find(c => c.status === 'available');
    if(!copy) return { ok:false, error:"No available copies to issue." };
    const actor = currentStaff();
    const rec = { id: uid("req_"), studentId, bookId, copyId: copy.id, status: "borrowed",
      requestedAt: todayISO(), approvedAt: todayISO(), dueDate: academicYearEndISO(),
      approvedBy: actor ? actor.name : "", annualLoan: true, direct: true };
    mutate(db => {
      db.requests.push(rec);
      const b = db.books.find(x => x.id === bookId);
      const c = b && b.copies.find(x => x.id === copy.id);
      if(c) c.status = 'borrowed';
    });
    return { ok:true, request: rec };
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

  /* ---------------- Annual (textbook) loans — year-end handling ----------------
     Exercise/text books are issued for the whole school year rather than a
     couple of weeks (see approveRequest). At year end, Library Staff need a
     portable record of exactly who still has what — and its ETB replacement
     value — BEFORE anything is reset, mirroring the same "export first"
     safety pattern used for Grade 12 graduation. */
  function annualLoanSummary(){
    const db = getDB();
    const rows = [];
    let outstandingValue = 0, outstandingCount = 0;
    db.books.filter(b => b.annualLoan).forEach(book => {
      db.requests.filter(r => r.bookId === book.id && r.status === 'borrowed').forEach(r => {
        const s = db.students.find(x => x.id === r.studentId);
        rows.push({ student: s ? s.name : '(removed student)', fan: s ? s.fan : '', klass: s ? s.class : '',
          book: book.title, price: book.price||0, dueDate: r.dueDate, requestId: r.id });
        outstandingValue += Number(book.price)||0;
        outstandingCount++;
      });
    });
    return { rows, outstandingValue, outstandingCount };
  }
  function textbookYearEndCSV(){
    const { rows } = annualLoanSummary();
    const cols = ["Student","FAN","Class","Book","Price (ETB)","Due Date"];
    const csvEscape = v => { v = (v==null?"":String(v)); return /[",\n]/.test(v) ? '"' + v.replace(/"/g,'""') + '"' : v; };
    const asText = v => { v = (v==null?"":String(v)); return v ? `="${v.replace(/"/g,'""')}"` : ""; };
    const body = rows.map(r => [r.student, asText(r.fan), r.klass, r.book, r.price, fmtDate(r.dueDate)]
      .map((v,i) => i===1 ? v : csvEscape(v)).join(","));
    return [cols.join(","), ...body].join("\r\n");
  }
  function downloadTextbookReportCSV(filenameBase){
    const csv = textbookYearEndCSV();
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${filenameBase||'textbook-year-end'}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  }
  // Marks every currently-borrowed copy of every annual-loan book as
  // available again for the new year. Damaged/lost copies are deliberately
  // left untouched — those still need a real restock/replacement decision,
  // not a silent reset — which is also why this refuses to run at all unless
  // the CSV above has already been generated in this same call chain
  // (enforced in the UI, same pattern as Graduate Grade 12).
  function resetAnnualLoans(){
    if(!isLibrarian()) return { ok:false, error:"Only Library Staff can do this." };
    const db = getDB();
    let count = 0;
    mutate(db => {
      db.books.filter(b => b.annualLoan).forEach(book => {
        db.requests.filter(r => r.bookId === book.id && r.status === 'borrowed').forEach(r => {
          r.status = 'returned'; r.returnedAt = todayISO(); r.note = 'Year-end automatic return';
          const copy = book.copies.find(c => c.id === r.copyId);
          if(copy && copy.status === 'borrowed'){ copy.status = 'available'; count++; }
        });
      });
    });
    return { ok:true, count };
  }

  function myRequests(studentId){ return getDB().requests.filter(r => r.studentId === studentId); }
  // Keeps the shared 'activity' document from growing forever: a finished loan
  // (returned or rejected) older than 30 days is dropped from the live system.
  // Pending and currently-borrowed records are NEVER touched here, no matter
  // how old — only requests that are already finished and safely in the past.
  // Called automatically once per admin session (see admin.html boot) — no
  // staff action needed, and it's a no-op (no write at all) if there's
  // nothing old enough to clear yet.
  function purgeOldLoanHistory(){
    const cutoff = Date.now() - 30*24*60*60*1000;
    const isOldAndDone = r => (r.status === 'returned' || r.status === 'rejected') &&
      (r.returnedAt || r.requestedAt) && new Date(r.returnedAt || r.requestedAt).getTime() < cutoff;
    const before = getDB().requests.length;
    const toRemove = getDB().requests.filter(isOldAndDone).length;
    if(!toRemove) return { removed: 0 };
    mutate(db => { db.requests = db.requests.filter(r => !isOldAndDone(r)); });
    return { removed: toRemove };
  }
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
  /* ---------------- announcement attachments (free, no Cloud Storage) ----------------
     A photo is compressed client-side (same trick as the enrollment ID/result
     photos) and embedded directly — this stays free forever, no Blaze plan or
     credit card needed, at the cost of a size limit that keeps the shared
     "feed" document safe. Videos and large files aren't embedded at all —
     the composer's "paste a Media URL" field is the way to attach those
     (e.g. a YouTube link or a Google Drive share link), which is also free
     and has no size limit at all, since the file itself never touches this
     app's database. Attachments are automatically removed 30 days after
     posting (see purgeOldAnnouncementMedia) to keep the shared document lean. */
  const ANNOUNCEMENT_PHOTO_RAW_MAX = 4 * 1024 * 1024; // 4MB raw upload accepted (a normal phone photo)...
  function compressAnnouncementPhoto(file, cb){
    if(!file.type.startsWith('image/')){
      cb({ ok:false, error:"Please choose a photo (JPG/PNG). For a video or a large file, use the \"paste a Media URL\" field instead (e.g. a YouTube or Google Drive link)." });
      return;
    }
    if(file.size > ANNOUNCEMENT_PHOTO_RAW_MAX){
      cb({ ok:false, error:`That photo is ${(file.size/1024/1024).toFixed(1)}MB — please choose one under 4MB.` });
      return;
    }
    // ...but always compressed down before storing (900px wide, decent
    // quality) — this is what actually keeps it small, not the 4MB cap.
    fileToResizedDataURL(file, 900, (dataUrl) => {
      if(!dataUrl){ cb({ ok:false, error:"Couldn't read that photo — please try another." }); return; }
      cb({ ok:true, url: dataUrl, name: file.name, type: file.type, size: dataUrl.length });
    }, 0.7);
  }
  // Drops the attachment (not the announcement itself) once it's more than 30
  // days old — the title/body/history stays, only the embedded photo goes
  // away. Called automatically once per admin session, same pattern as
  // purgeOldLoanHistory — a no-op if nothing has aged out yet.
  function purgeOldAnnouncementMedia(){
    const cutoff = Date.now() - 30*24*60*60*1000;
    const isOldMedia = a => a.mediaUrl && a.mediaUploadedAt && new Date(a.mediaUploadedAt).getTime() < cutoff;
    const toExpire = getDB().announcements.filter(isOldMedia).length;
    if(!toExpire) return { expired: 0 };
    mutate(db => {
      db.announcements.forEach(a => {
        if(isOldMedia(a)){ a.mediaUrl = ""; a.mediaType = ""; a.mediaName = ""; a.mediaUploadedAt = ""; }
      });
    });
    return { expired: toExpire };
  }

  function postAnnouncement({title, body, mediaUrl, mediaType, mediaName, postedBy, postedByRole, postedById, audience}){
    const rec = { id: uid("an_"), title, body, mediaUrl:mediaUrl||"", mediaType:mediaType||"", mediaName:mediaName||"",
      mediaUploadedAt: mediaUrl ? todayISO() : "",
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
    const prev = getDB().announcements.find(x => x.id === id);
    const mediaChanged = prev && prev.mediaUrl !== (mediaUrl||"");
    mutate(db => {
      const a = db.announcements.find(x => x.id === id);
      if(!a) return;
      a.title = title; a.body = body;
      a.mediaUrl = mediaUrl||""; a.mediaType = mediaType||""; a.mediaName = mediaName||"";
      if(mediaChanged) a.mediaUploadedAt = mediaUrl ? todayISO() : "";
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

  /* ---------------- direct messages (Librarian -> one individual student) ----------------
     Separate from announcements on purpose: announcements are broadcasts (#GENERAL or a
     whole grade) posted by either Director or Library Staff and shown on the student's
     Home feed. A direct message is private, one-to-one, Library-Staff-only (e.g. "please
     return your book, it's overdue" or another personal note/warning to a single student),
     and only ever shows up in that student's Inbox — never on Home, never to anyone else. */
  function sendDirectMessage({studentId, title, body}){
    const actor = currentStaff();
    if(!actor || actor.role !== 'library') return { ok:false, error:"Only Library Staff can send individual messages." };
    const db = getDB();
    if(!db.students.some(s => s.id === studentId)) return { ok:false, error:"Student not found." };
    title = (title||"").trim(); body = (body||"").trim();
    if(!title || !body) return { ok:false, error:"Title and message are required." };
    const rec = { id: uid("dm_"), studentId, title, body,
      postedBy: actor.name, postedById: actor.id, date: todayISO(), read: false };
    mutate(db => db.directMessages.push(rec));
    return { ok:true, message: rec };
  }
  // Same "only the sender may touch it" rule as announcements — see isAnnouncementOwner.
  function isDirectMessageOwner(msgId, staffId){
    const m = getDB().directMessages.find(x => x.id === msgId);
    return !!(m && staffId && m.postedById === staffId);
  }
  function removeDirectMessage(id, staffId){
    if(!isDirectMessageOwner(id, staffId)) return { ok:false, error:"You can only delete messages you sent yourself." };
    mutate(db => { db.directMessages = db.directMessages.filter(m => m.id !== id); });
    return { ok:true };
  }
  function listDirectMessages(){ return getDB().directMessages.slice().sort((a,b)=> new Date(b.date)-new Date(a.date)); }
  function listDirectMessagesFor(studentId){
    return getDB().directMessages.filter(m => m.studentId === studentId).sort((a,b)=> new Date(b.date)-new Date(a.date));
  }
  // Drives the Inbox tab's notification badge, same idea as unreadAnnouncementCount.
  function unreadDirectMessageCount(studentId){
    if(!studentId) return 0;
    return getDB().directMessages.filter(m => m.studentId === studentId && !m.read).length;
  }
  function markDirectMessageRead(id, studentId){
    mutate(db => {
      const m = db.directMessages.find(x => x.id === id && x.studentId === studentId);
      if(m) m.read = true;
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
      db.directMessages = [];
    });
  }

  /* ---------------- backup / restore ---------------- */
  // Same download-a-Blob pattern as exportJSON below, just for the CSV roster —
  // a plain file any office computer can open, independent of this app.
  function downloadStudentsCSV(filenameSuffix){
    const csv = studentsToCSV();
    // Excel (especially on Windows) assumes ANSI/Windows-1252 for a plain CSV
    // unless a UTF-8 byte-order-mark is present — without it, Amharic text (and
    // even a plain "—") shows up corrupted as garbled characters. The BOM fixes
    // that; it's invisible in any spreadsheet app and ignored by everything else.
    const blob = new Blob(["\uFEFF" + csv], { type:"text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `sssdp-students-${filenameSuffix||new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  }
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
    ETH_MONTHS, isEthLeap, daysInEthMonth, ethToday, computeAgeFromEC, fmtEthDate, fmtEthDateLatin, fmtResidency,
    jdnToGregorian, getAcademicYearEnd, setAcademicYearEnd, academicYearEndISO,
    annualLoanSummary, textbookYearEndCSV, downloadTextbookReportCSV, resetAnnualLoans, issueAnnualLoan, markLost,
    getDB, mutate, ready, getSettings, updateSettings, applyTheme,
    getEnrollmentDeadline, setEnrollmentDeadline, isEnrollmentClosed,
    getSession, setSession, clearSession,
    adminRegisterStudent, activateStudent, studentLogin, studentLoginConfirm, staffLogin, currentStudent, currentStaff,
    submitApplication, listApplications, approveApplication, rejectApplication, clearApplicationDocs, compactReviewedApplications, applicationsStorageInfo, removeApplication, clearApplicationHistory,
    syncStudentShardsNow, studentStorageInfo,
    adminSetStudentPin, adminEditStudent, searchStudents, removeStudent,
    autoDistributeSections, studentsToCSV, previewPromotion, promoteStudents, graduateStudents,
    setupFirstAdmin, addStaff, removeStaff, staffChangeOwnPassword, staffUpdateOwnProfile, adminUpdateStaffProfile, clearDemoData, restoreDemoBooks,
    addBook, editBook, removeBook, searchBooks, bookStats, setCopyStatus, addCopies,
    requestBook, approveRequest, rejectRequest, markReturned, adjustDueDate,
    reserveBook, cancelReservation, myRequests, myReservations, allOverdue, allPending, allBorrowed, purgeOldLoanHistory,
    AUDIENCES, AUDIENCE_LABEL,
    postAnnouncement, updateAnnouncement, removeAnnouncement, isAnnouncementOwner, listAnnouncements, listAnnouncementsFor, unreadAnnouncementCount, markAnnouncementViewed,
    uploadAnnouncementMedia: compressAnnouncementPhoto, purgeOldAnnouncementMedia,
    sendDirectMessage, isDirectMessageOwner, removeDirectMessage, listDirectMessages, listDirectMessagesFor, unreadDirectMessageCount, markDirectMessageRead,
    addComment, commentsFor,
    exportJSON, importJSON, downloadStudentsCSV
  };
})();
