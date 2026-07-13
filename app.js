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
  const stars = (n) => "★".repeat(n) + "☆".repeat(5-n);
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

  /* ---------------- DB ---------------- */
  function loadDB(){
    let raw = localStorage.getItem(DB_KEY);
    if(!raw){ const seeded = seedDB(); saveDB(seeded); return seeded; }
    try { return JSON.parse(raw); } catch(e){ const seeded = seedDB(); saveDB(seeded); return seeded; }
  }
  function saveDB(db){ localStorage.setItem(DB_KEY, JSON.stringify(db)); }
  function getDB(){ return loadDB(); }
  function mutate(fn){ const db = loadDB(); fn(db); saveDB(db); return db; }

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
      staff: [
        { id: uid("stf_"), username: "director", password: "director123", role: "director", name: "Director Admin" },
        { id: uid("stf_"), username: "library", password: "library123", role: "library", name: "Library Staff" }
      ],
      students: [
        {
          id: uid("std_"), fan: "1002003004005006",
          name: "Abebe Kebede", class: "10", section: "A", age: 16,
          activated: true, pin: "1234", photo: "",
          createdAt: now
        },
        {
          id: uid("std_"), fan: "2003004005006007",
          name: "Selam Tesfaye", class: "9", section: "B", age: 15,
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
  function adminRegisterStudent({name, fan, klass, section, age}){
    fan = digitsOnly(fan);
    if(!name || !name.trim()) return { ok:false, error: "ሙሉ ስም ያስፈልጋል" };
    if(fan.length !== 16) return { ok:false, error: "FAN 16 ዲጂት መሆን አለበት" };
    const db = getDB();
    if(db.students.some(s => s.fan === fan)) return { ok:false, error: "ይህ FAN ቀድሞ ተመዝግቧል" };
    const student = { id: uid("std_"), fan, name: name.trim(), class: klass, section, age: Number(age)||null,
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
    const staff = db.staff.find(s => s.username.toLowerCase() === username.trim().toLowerCase());
    if(!staff || staff.password !== password) return { ok:false, error:"የተጠቃሚ ስም ወይም የይለፍ ቃል ትክክል አይደለም" };
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
    return db.students.filter(s => fuzzyMatch(query, s.name) || (s.fan||"").includes(digitsOnly(query)));
  }

  /* ---------------- staff management (director only) ---------------- */
  function addStaff({username, password, role, name}){
    const db = getDB();
    if(db.staff.some(s => s.username.toLowerCase() === username.toLowerCase())) return {ok:false,error:"ይህ የተጠቃሚ ስም አለ"};
    const staff = { id: uid("stf_"), username, password, role, name };
    mutate(db => db.staff.push(staff));
    return { ok:true, staff };
  }
  function removeStaff(id){ mutate(db => { db.staff = db.staff.filter(s => s.id !== id); }); }
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
  function addBook(book){
    const rec = { id: uid("bk_"), title:book.title, author:book.author, category:book.category,
      quality:Number(book.quality)||3, condition:book.condition||"", coverUrl:book.coverUrl||"",
      copies: makeCopies(book.totalCopies), addedAt: todayISO() };
    mutate(db => db.books.push(rec));
    return rec;
  }
  function editBook(id, patch){
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
    mutate(db => {
      const b = db.books.find(x=>x.id===bookId); if(!b) return;
      const c = b.copies.find(x=>x.id===copyId); if(c) c.status = status;
    });
  }
  function addCopies(bookId, n){
    mutate(db => { const b = db.books.find(x=>x.id===bookId); if(b) b.copies = b.copies.concat(makeCopies(n)); });
  }
  function removeBook(id){ mutate(db => { db.books = db.books.filter(b => b.id !== id); }); }
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

  /* ---------------- borrow / approval workflow ---------------- */
  // Student requests a book -> goes to 'pending' and one copy is held (not yet in the student's hand).
  function requestBook(studentId, bookId){
    const db = getDB();
    const book = db.books.find(b => b.id === bookId);
    if(!book) return { ok:false, error:"መጽሐፍ አልተገኘም" };
    const already = db.requests.some(r => r.studentId===studentId && r.bookId===bookId && (r.status==="pending"||r.status==="borrowed"));
    if(already) return { ok:false, error:"ይህን መጽሐፍ ቀድመው ጠይቀዋል/ወስደዋል" };
    const freeCopy = (book.copies||[]).find(c => c.status === 'available');
    if(!freeCopy){
      return { ok:false, error:"ኮፒ የለም። ወደ ወረፋ (Reserve) ይግቡ።", canReserve:true };
    }
    const reqRec = { id: uid("rq_"), studentId, bookId, copyId: freeCopy.id, status:"pending", requestedAt: todayISO(),
      approvedAt:null, dueDate:null, returnedAt:null, approvedBy:null };
    mutate(db => {
      db.requests.push(reqRec);
      const b = db.books.find(x => x.id === bookId);
      const c = b.copies.find(x => x.id === freeCopy.id);
      if(c) c.status = 'borrowed'; // held pending approval
    });
    return { ok:true, request: reqRec };
  }
  function approveRequest(requestId, staffName, dueDays){
    mutate(db => {
      const r = db.requests.find(x => x.id === requestId);
      if(!r || r.status !== "pending") return;
      r.status = "borrowed";
      r.approvedAt = todayISO();
      r.dueDate = addDays(todayISO(), dueDays || db.settings.dueDays || DEFAULT_DUE_DAYS);
      r.approvedBy = staffName;
    });
  }
  function rejectRequest(requestId){
    mutate(db => {
      const r = db.requests.find(x => x.id === requestId);
      if(!r || r.status !== "pending") return;
      r.status = "rejected";
      const b = db.books.find(x => x.id === r.bookId);
      const c = b && b.copies.find(x => x.id === r.copyId);
      if(c) c.status = 'available'; // release the hold
    });
  }
  function markReturned(requestId, damaged){
    mutate(db => {
      const r = db.requests.find(x => x.id === requestId);
      if(!r || r.status !== "borrowed") return;
      r.status = "returned";
      r.returnedAt = todayISO();
      const b = db.books.find(x => x.id === r.bookId);
      const c = b && b.copies.find(x => x.id === r.copyId);
      if(c) c.status = damaged ? 'damaged' : 'available';
    });
  }
  function adjustDueDate(requestId, newDueIso){
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
  function cancelReservation(id){ mutate(db => { db.reservations = db.reservations.filter(r => r.id !== id); }); }

  function myRequests(studentId){ return getDB().requests.filter(r => r.studentId === studentId); }
  function myReservations(studentId){ return getDB().reservations.filter(r => r.studentId === studentId); }
  function allOverdue(){
    const db = getDB();
    return db.requests.filter(r => r.status === "borrowed" && isOverdue(r.dueDate));
  }
  function allPending(){ return getDB().requests.filter(r => r.status === "pending"); }
  function allBorrowed(){ return getDB().requests.filter(r => r.status === "borrowed"); }

  /* ---------------- announcements (with view tracking) ---------------- */
  function postAnnouncement({title, body, mediaUrl, mediaType, postedBy, postedByRole}){
    const rec = { id: uid("an_"), title, body, mediaUrl:mediaUrl||"", mediaType:mediaType||"",
      postedBy, postedByRole, date: todayISO(), views: [] };
    mutate(db => db.announcements.unshift(rec));
    return rec;
  }
  function removeAnnouncement(id){ mutate(db => { db.announcements = db.announcements.filter(a => a.id !== id); }); }
  function listAnnouncements(){ return getDB().announcements.slice().sort((a,b)=> new Date(b.date)-new Date(a.date)); }
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
    fileToResizedDataURL,
    getDB, mutate, getSettings, updateSettings, applyTheme,
    getSession, setSession, clearSession,
    adminRegisterStudent, activateStudent, studentLogin, studentLoginConfirm, staffLogin, currentStudent, currentStaff,
    adminSetStudentPin, adminEditStudent, adminSetStudentPhoto, searchStudents,
    addStaff, removeStaff, staffChangeOwnPassword, clearDemoData,
    addBook, editBook, removeBook, searchBooks, bookStats, setCopyStatus, addCopies,
    requestBook, approveRequest, rejectRequest, markReturned, adjustDueDate,
    reserveBook, cancelReservation, myRequests, myReservations, allOverdue, allPending, allBorrowed,
    postAnnouncement, removeAnnouncement, listAnnouncements, markAnnouncementViewed,
    addComment, commentsFor,
    exportJSON, importJSON
  };
})();
