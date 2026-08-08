/* ============================================================
   SSSDP — Language switcher (English / Amharic / Afaan Oromoo)

   HOW IT WORKS
   - Any element with data-i18n="KEY" gets its text replaced with
     the translation for the current language.
   - Any element with data-i18n-ph="KEY" gets its placeholder
     attribute translated instead (for <input>).
   - The chosen language is saved in localStorage so it's
     remembered across pages and visits.
   - A small floating switcher (EN / አማ / OM) is injected
     automatically into every page that includes this script —
     you don't need to add any HTML for it.
   - A MutationObserver re-applies translations automatically to
     any NEW content the app renders later (e.g. renderHome(),
     renderProfile() in app.js build their HTML dynamically) —
     so translations don't just work once at page load.

   NOTE: the school/brand name ("SSSDP", "Sheno Secondary School")
   is intentionally NEVER translated, per instruction — it's not
   included in the dictionary below, so it's left exactly as
   written in the HTML no matter which language is active.

   ADDING MORE TEXT LATER: tag any element with data-i18n="some_key"
   in the HTML, then add "some_key" to the three language blocks
   below. That's the whole process — the engine picks it up
   automatically, no other code changes needed.
   ============================================================ */

(function () {
  const DICT = {
    en: {
      nav_home: "Home", nav_library: "Library", nav_inbox: "Inbox", nav_profile: "Profile",
      logout: "Log out",
      login_fan_label: "First 4 digits of your FAN",
      login_pin_label: "PIN (4-digit)",
      login_submit: "Log in",
      login_admin_q: "Admin / Library staff?",
      login_admin_link: "Admin login →",
      login_new_q: "New student?",
      login_apply_link: "Apply to enroll →",
      hero_title: "Enroll for the New Academic Year",
      hero_desc: "Grades 9–12 registration — complete the secure form below in about 5 minutes. Your information is encrypted in transit and only visible to the school's authorized Registrar.",
      trust_https: "🔒 HTTPS Encrypted",
      trust_consent: "👪 Parent/Guardian Consent Required",
      trust_registrar: "🔐 Reviewed by Registrar Only",
      step1_title: "Student Information",
      lbl_full_name: "Full Legal Name *",
      lbl_dob: "Date of Birth (Ethiopian Calendar) *",
      lbl_gender: "Gender *",
      opt_select: "— Select —",
      opt_male: "Male",
      opt_female: "Female",
      lbl_grade: "Grade Applying For *",
      opt_g9: "Grade 9", opt_g10: "Grade 10", opt_g11: "Grade 11", opt_g12: "Grade 12",
      lbl_existing_id: "School-Issued ID (leave blank if new)",
      lbl_fan: "FAN (16 digit, from your National ID) *",
      hint_fan: "This is the 16-digit number printed on the student's National ID (Fayda) — copy it exactly.",
      mock_fan_caption: "Example — the FAN is the number above the barcode, labeled \"FAN\".",
      step2_title: "Contact & Address",
      lbl_stu_email: "Student Email",
      lbl_stu_phone: "Student Phone",
      hint_email_phone: "Provide at least one — email or phone.",
      lbl_residence: "Residence (Town / Kebele / Sefer)",
      step3_title: "Parent / Guardian Details",
      lbl_guardian_name: "Parent / Guardian Full Name *",
      lbl_guardian_phone: "Parent / Guardian Phone *",
      lbl_guardian_email: "Parent / Guardian Email",
      step4_title: "Supporting Documents",
      lbl_id_doc: "National ID (Face Page) — photo, max 4MB",
      btn_choose_file: "🪪 Tap to choose a file",
      btn_choose_file2: "📄 Tap to choose a file",
      mock_id_caption: "Example — take a clear, well-lit photo of the front (obverse) of the National ID, like this.",
      hint_placement: "This helps the school place students fairly and evenly across sections.",
      mock_result_caption: "Example (Grades 10–12) — photograph your previous grade's report card fully and clearly, like this.",
      step5_title: "Consent",
      consent_info: "As the parent/guardian (or the student, if 18+), I consent to Sheno Secondary School collecting and storing this information for enrollment review purposes. *",
      consent_photos: "I also consent to the student appearing in official school photos or publications (optional — you can decline and still register).",
      btn_submit: "Submit Application",
      footnote_required: "Fields marked * are required. You'll receive a reference number after submitting.",
      admin_username: "Username", admin_password: "Password",
      admin_student_q: "Student?", admin_student_link: "Student login →"
    },
    am: {
      nav_home: "መነሻ", nav_library: "ቤተ-መጽሐፍት", nav_inbox: "መልእክት", nav_profile: "መገለጫ",
      logout: "ውጣ",
      login_fan_label: "የFAN መጀመሪያ 4 ዲጂት",
      login_pin_label: "የይለፍ ቁጥር (4-digit PIN)",
      login_submit: "ግባ",
      login_admin_q: "አድሚን / ላይብረሪ ነዎት?",
      login_admin_link: "የአድሚን መግቢያ →",
      login_new_q: "አዲስ ተማሪ ነዎት?",
      login_apply_link: "ለምዝገባ ያመልክቱ →",
      hero_title: "ለአዲሱ የትምህርት ዓመት ይመዝገቡ",
      hero_desc: "የ9–12 ክፍል ምዝገባ — ከታች ያለውን ደህንነቱ የተጠበቀ ቅጽ በ5 ደቂቃ ውስጥ ይሙሉ። መረጃዎ በስርጭት ላይ ተመስጥሮ የሚቀመጥ ሲሆን ለትምህርት ቤቱ ተመዝጋቢ ሹም ብቻ ይታያል።",
      trust_https: "🔒 በHTTPS የተመሰጠረ",
      trust_consent: "👪 የወላጅ/አሳዳጊ ፈቃድ ያስፈልጋል",
      trust_registrar: "🔐 በተመዝጋቢ ሹም ብቻ ይታያል",
      step1_title: "የተማሪ መረጃ",
      lbl_full_name: "ሙሉ ስም (በህጋዊ) *",
      lbl_dob: "የልደት ቀን (ኢትዮጵያዊ አቆጣጠር) *",
      lbl_gender: "ጾታ *",
      opt_select: "— ይምረጡ —",
      opt_male: "ወንድ",
      opt_female: "ሴት",
      lbl_grade: "የሚመዘገቡበት ክፍል *",
      opt_g9: "ክፍል 9", opt_g10: "ክፍል 10", opt_g11: "ክፍል 11", opt_g12: "ክፍል 12",
      lbl_existing_id: "የትምህርት ቤት መታወቂያ (አዲስ ከሆኑ ባዶ ይተዉት)",
      lbl_fan: "FAN (ከብሔራዊ መታወቂያዎ የ16 አሃዝ ቁጥር) *",
      hint_fan: "ይህ በተማሪው ብሔራዊ መታወቂያ (ፋይዳ) ላይ የተጻፈው የ16 አሃዝ ቁጥር ነው — በትክክል ይቅዱት።",
      mock_fan_caption: "ምሳሌ — FAN ማለት ከባርኮዱ በላይ ያለው \"FAN\" ተብሎ የተጻፈው ቁጥር ነው።",
      step2_title: "አድራሻ እና ግንኙነት",
      lbl_stu_email: "የተማሪ ኢሜይል",
      lbl_stu_phone: "የተማሪ ስልክ",
      hint_email_phone: "ቢያንስ አንዱን ያቅርቡ — ኢሜይል ወይም ስልክ።",
      lbl_residence: "መኖሪያ (ከተማ / ቀበሌ / ሰፈር)",
      step3_title: "የወላጅ / አሳዳጊ መረጃ",
      lbl_guardian_name: "የወላጅ/አሳዳጊ ሙሉ ስም *",
      lbl_guardian_phone: "የወላጅ/አሳዳጊ ስልክ *",
      lbl_guardian_email: "የወላጅ/አሳዳጊ ኢሜይል",
      step4_title: "አጋዥ ሰነዶች",
      lbl_id_doc: "ብሔራዊ መታወቂያ (የፊት ገጽ) — ፎቶ፣ ቢበዛ 4MB",
      btn_choose_file: "🪪 ፋይል ለመምረጥ ይንኩ",
      btn_choose_file2: "📄 ፋይል ለመምረጥ ይንኩ",
      mock_id_caption: "ምሳሌ — የብሔራዊ መታወቂያውን የፊት ገጽ ግልጽ እና በደንብ በሚታይ ብርሃን እንደዚህ ፎቶ ያንሱ።",
      hint_placement: "ይህ ትምህርት ቤቱ ተማሪዎችን በትክክል እና በእኩልነት በክፍሎች እንዲያሰማራ ይረዳል።",
      mock_result_caption: "ምሳሌ (ክፍል 10–12) — የቀድሞ ክፍልዎን ሪፖርት ካርድ ሙሉ እና ግልጽ አድርገው እንደዚህ ፎቶ ያንሱ።",
      step5_title: "ፈቃድ",
      consent_info: "እንደ ወላጅ/አሳዳጊ (ወይም ተማሪው 18+ ከሆነ) ይህንን መረጃ ሸኖ ሁለተኛ ደረጃ ትምህርት ቤት ለምዝገባ ግምገማ ዓላማ እንዲሰበስብ እና እንዲያስቀምጥ እፈቅዳለሁ። *",
      consent_photos: "እንዲሁም ተማሪው በኦፊሴላዊ የትምህርት ቤት ፎቶዎች ወይም ህትመቶች ላይ እንዲታይ እፈቅዳለሁ (አማራጭ — ባይፈቅዱም መመዝገብ ይችላሉ)።",
      btn_submit: "ማመልከቻ ላክ",
      footnote_required: "በ * የተመለከቱ መስኮች ያስፈልጋሉ። ካስገቡ በኋላ የማጣቀሻ ቁጥር ይደርስዎታል።",
      admin_username: "የተጠቃሚ ስም", admin_password: "የይለፍ ቃል",
      admin_student_q: "ተማሪ ነዎት?", admin_student_link: "የተማሪ መግቢያ →"
    },
    om: {
      nav_home: "Mana", nav_library: "Mana Kitaabaa", nav_inbox: "Ergaa", nav_profile: "Piroofaayilii",
      logout: "Ba'i",
      login_fan_label: "Lakkoofsa FAN kee jalqaba 4",
      login_pin_label: "PIN (lakkoofsa 4)",
      login_submit: "Seeni",
      login_admin_q: "Admin / hojjetaa mana kitaabaati?",
      login_admin_link: "Seensa Admin →",
      login_new_q: "Barataa haaraadhaa?",
      login_apply_link: "Galmaa'uuf iyyadhu →",
      hero_title: "Bara Barnootaa Haaraadhaaf Galmaa'i",
      hero_desc: "Galmee kutaa 9–12 — unka nageenya qabu armaan gadii daqiiqaa 5 keessatti guuti. Odeeffannoon kee karaa itti fufiinsaan iccitiin qabame, geggeessaa galmee mana barumsaa qofaan kan mul'atu.",
      trust_https: "🔒 HTTPS Iccitii qabu",
      trust_consent: "👪 Hayyama Warra/Kunuunsituu Barbaachisa",
      trust_registrar: "🔐 Geggeessaa Galmeetiin Qofa Ilaalama",
      step1_title: "Odeeffannoo Barataa",
      lbl_full_name: "Maqaa Guutuu Seeraa *",
      lbl_dob: "Guyyaa Dhalootaa (Kalandara Itiyoophiyaa) *",
      lbl_gender: "Saala *",
      opt_select: "— Filadhu —",
      opt_male: "Dhiira",
      opt_female: "Dubara",
      lbl_grade: "Kutaa Galmaa'uuf Barbaaddu *",
      opt_g9: "Kutaa 9", opt_g10: "Kutaa 10", opt_g11: "Kutaa 11", opt_g12: "Kutaa 12",
      lbl_existing_id: "ID Mana Barumsaa (yoo haaraa taate duwwaa dhiisi)",
      lbl_fan: "FAN (lakkoofsa 16, ID Biyyaalessaa kee irraa) *",
      hint_fan: "Kun lakkoofsa 16 kan ID Biyyaalessaa barataa (Fayda) irratti barreeffamedha — sirriitti garagalchi.",
      mock_fan_caption: "Fakkeenya — FAN jechuun lakkoofsa barkoodii olitti \"FAN\" jedhamee barreeffamedha.",
      step2_title: "Qunnamtii fi Teessoo",
      lbl_stu_email: "Imeelii Barataa",
      lbl_stu_phone: "Bilbila Barataa",
      hint_email_phone: "Yoo xiqqaate tokko kenni — imeelii ykn bilbila.",
      lbl_residence: "Iddoo Jireenyaa (Magaalaa / Ganda / Sefer)",
      step3_title: "Odeeffannoo Warra / Kunuunsituu",
      lbl_guardian_name: "Maqaa Guutuu Warraa/Kunuunsituu *",
      lbl_guardian_phone: "Bilbila Warraa/Kunuunsituu *",
      lbl_guardian_email: "Imeelii Warraa/Kunuunsituu",
      step4_title: "Ragaalee Deeggarsaa",
      lbl_id_doc: "ID Biyyaalessaa (Fuula Duraa) — suuraa, hanga 4MB",
      btn_choose_file: "🪪 Faayilii filachuuf tuqi",
      btn_choose_file2: "📄 Faayilii filachuuf tuqi",
      mock_id_caption: "Fakkeenya — fuula duraa (obverse) ID Biyyaalessaa ifaa fi ifa gaarii keessatti akkana suuraa kaasi.",
      hint_placement: "Kun mana barumsaa akka baratoota qixxeen kutaalee gidduutti ramaduuf gargaara.",
      mock_result_caption: "Fakkeenya (Kutaa 10–12) — gabaasa kutaa darbe guutuu fi ifaan akkana suuraa kaasi.",
      step5_title: "Hayyama",
      consent_info: "Akka warraa/kunuunsituutti (ykn barataan yoo umuriin 18+ ta'e), odeeffannoo kana Mana Barumsaa Sheno Sadarkaa 2ffaa akka walitti qabuu fi kuusuuf kaayyoo ilaalcha galmee hayyama kenneera. *",
      consent_photos: "Akkasumas barataan suuraalee ykn maxxansaalee mana barumsaa seeraa keessatti akka mul'atu hayyama kenneera (filannoo — didanii galmaa'uu ni dandeessu).",
      btn_submit: "Iyyata Ergi",
      footnote_required: "Dirreewwan * qaban barbaachisoodha. Erga ergitanii booda lakkoofsa wabii ni argattu.",
      admin_username: "Maqaa Fayyadamaa", admin_password: "Jecha Iccitii",
      admin_student_q: "Barataadhaa?", admin_student_link: "Seensa Barataa →"
    }
  };

  const LANG_KEY = "sssdp_lang";
  const LABELS = { en: "EN", am: "አማ", om: "OM" };

  function getLang() {
    return localStorage.getItem(LANG_KEY) || "en";
  }

  function translateNode(root, lang) {
    const dict = DICT[lang] || DICT.en;
    (root.querySelectorAll ? root.querySelectorAll("[data-i18n]") : []).forEach((el) => {
      const key = el.getAttribute("data-i18n");
      if (dict[key]) el.textContent = dict[key];
    });
    (root.querySelectorAll ? root.querySelectorAll("[data-i18n-ph]") : []).forEach((el) => {
      const key = el.getAttribute("data-i18n-ph");
      if (dict[key]) el.setAttribute("placeholder", dict[key]);
    });
    // Handle the root element itself, in case it carries the attribute
    if (root.nodeType === 1 && root.hasAttribute && root.hasAttribute("data-i18n")) {
      const key = root.getAttribute("data-i18n");
      if (dict[key]) root.textContent = dict[key];
    }
  }

  function applyLang(lang) {
    if (!DICT[lang]) lang = "en";
    localStorage.setItem(LANG_KEY, lang);
    document.documentElement.setAttribute("data-active-lang", lang);
    translateNode(document, lang);
    updateSwitcherUI(lang);
  }

  let switcherEl = null;
  function updateSwitcherUI(lang) {
    if (!switcherEl) return;
    switcherEl.querySelectorAll("button").forEach((b) => {
      b.classList.toggle("active", b.getAttribute("data-lang") === lang);
    });
  }

  function injectSwitcher() {
    if (document.getElementById("langSwitcher")) return;
    const box = document.createElement("div");
    box.id = "langSwitcher";
    box.style.cssText =
      "position:fixed;top:8px;right:8px;z-index:9999;display:flex;gap:2px;" +
      "background:rgba(20,20,20,.78);backdrop-filter:blur(4px);border-radius:20px;padding:3px;" +
      "box-shadow:0 2px 8px rgba(0,0,0,.25);";
    Object.keys(LABELS).forEach((code) => {
      const b = document.createElement("button");
      b.type = "button";
      b.setAttribute("data-lang", code);
      b.textContent = LABELS[code];
      b.style.cssText =
        "border:none;border-radius:16px;padding:5px 9px;font-size:11px;font-weight:700;" +
        "cursor:pointer;background:transparent;color:#fff;line-height:1;";
      b.addEventListener("click", () => applyLang(code));
      box.appendChild(b);
    });
    const style = document.createElement("style");
    style.textContent = "#langSwitcher button.active{background:var(--red,#C8102E);color:#fff;}";
    document.head.appendChild(style);
    document.body.appendChild(box);
    switcherEl = box;
  }

  function boot() {
    injectSwitcher();
    applyLang(getLang());

    // Re-apply translations to anything the app renders dynamically later
    // (renderHome/renderProfile/etc in app.js build HTML via innerHTML).
    const mo = new MutationObserver((mutations) => {
      const lang = getLang();
      for (const m of mutations) {
        m.addedNodes.forEach((n) => {
          if (n.nodeType === 1) translateNode(n, lang);
        });
      }
    });
    mo.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  // Exposed in case other scripts want to trigger it manually
  window.SSSDP_I18N = { applyLang, getLang };
})();
