/**
 * ============================================================================
 * APPLICATION CONFIGURATION & CRYPTOGRAPHIC HELPERS (`public/js/config.js`)
 * Target Stack: Supabase (PostgreSQL + Edge Functions) + LINE LIFF v2 + GitHub Pages
 * Architecture Rule: Zero WebSockets for `index.html` and `staff.html`
 * ============================================================================
 */

window.APP_CONFIG = {
  // Live Supabase Project URL and Anon Key (Project ID: pjzxbctiteafmiomnkfj)
  SUPABASE_URL:
    localStorage.getItem("MWA_CFG_SUPABASE_URL") ||
    "https://pjzxbctiteafmiomnkfj.supabase.co",
  SUPABASE_ANON_KEY:
    localStorage.getItem("MWA_CFG_SUPABASE_ANON_KEY") ||
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBqenhiY3RpdGVhZm1pb21ua2ZqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQ0NTA2NDAsImV4cCI6MjExMDAyNjY0MH0.hc9a_z6DoV__u0R008ZbO_plNkCV5WxBD7geDAqcSLM",

  // LINE Front-end Framework (LIFF v2) IDs per screen (can share a single LIFF ID or separate)
  LIFF_ID_MEMBER:
    localStorage.getItem("MWA_CFG_LIFF_MEMBER") || "2000000000-member01",
  LIFF_ID_STAFF:
    localStorage.getItem("MWA_CFG_LIFF_STAFF") || "2000000000-staff001",
  LIFF_ID_ADMIN:
    localStorage.getItem("MWA_CFG_LIFF_ADMIN") || "2000000000-admin001",

  // Public PDPA Salt for client-side SHA-256 pre-hashing (`member_no:phone:SALT`)
  // Must match `PDPA_HASH_SALT` in Supabase Edge Functions
  PDPA_HASH_SALT:
    localStorage.getItem("MWA_CFG_PDPA_SALT") || "MWA_COOP_PDPA_SALT_2026",

  // Kiosk Dynamic QR shared HMAC secret (for offline/stateless tablet Kiosk rotation)
  // Must match `QR_HMAC_SECRET` in Supabase Edge Functions
  KIOSK_HMAC_SECRET:
    localStorage.getItem("MWA_CFG_KIOSK_SECRET") ||
    "MWA_COOP_QR_HMAC_SECRET_2026",

  // Enable local Demo Simulation automatically if SUPABASE_URL is still the placeholder
  ENABLE_LOCAL_SIMULATION_FALLBACK: true,
};

/**
 * Checks whether the Supabase backend URL is configured with a real project.
 */
window.isBackendConfigured = function () {
  const url = window.APP_CONFIG.SUPABASE_URL || "";
  return (
    url.startsWith("http") &&
    !url.includes("your-project-ref.supabase.co") &&
    !url.includes("example.supabase.co")
  );
};

/**
 * Normalizes member number (trims whitespace, pads numeric <= 5 digits with leading zeros)
 */
window.normalizeMemberNo = function (raw) {
  const trimmed = String(raw || "").trim();
  if (/^\d{1,5}$/.test(trimmed)) {
    return trimmed.padStart(5, "0");
  }
  return trimmed.toUpperCase();
};

/**
 * Normalizes Thai phone number (strips dashes/spaces, converts +66 to 0)
 */
window.normalizePhone = function (raw) {
  let digits = String(raw || "").replace(/[^0-9+]/g, "");
  if (digits.startsWith("+66")) {
    digits = "0" + digits.slice(3);
  } else if (digits.startsWith("66") && digits.length === 11) {
    digits = "0" + digits.slice(2);
  }
  return digits.replace(/\D/g, "");
};

/**
 * Computes SHA-256 hex digest in the browser using Web Crypto API.
 * Used to pre-hash (`member_no:phone:SALT`) before transmitting or importing CSV.
 */
window.sha256Hex = async function (message) {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const bytes = new Uint8Array(hashBuffer);
  let hex = "";
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, "0");
  }
  return hex;
};

/**
 * Pre-hashes Member No + Phone Number + Salt for PDPA compliance.
 */
window.hashMemberPhoneClient = async function (memberNo, phone, customSalt) {
  const normMember = window.normalizeMemberNo(memberNo);
  const normPhone = window.normalizePhone(phone);
  const salt = customSalt || window.APP_CONFIG.PDPA_HASH_SALT;
  return await window.sha256Hex(`${normMember}:${normPhone}:${salt}`);
};

/**
 * Computes HMAC-SHA256 hex digest in the browser using Web Crypto API.
 * Used by Kiosk Display mode (`staff.html`) to generate rotating 20-second anti-cheat QR tokens.
 */
window.hmacSha256Hex = async function (message, secret) {
  const encoder = new TextEncoder();
  const resolvedSecret = secret || window.APP_CONFIG.KIOSK_HMAC_SECRET;
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(resolvedSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sigBuffer = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(message),
  );
  const bytes = new Uint8Array(sigBuffer);
  let hex = "";
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, "0");
  }
  return hex;
};

/**
 * Generates a rotating Kiosk Session Token (`KIOSK_BUCKET|<bucket>|<hmac24>`)
 */
window.generateKioskDynamicToken = async function (intervalSec = 20) {
  const bucket = Math.floor(Date.now() / 1000 / intervalSec);
  const mac = await window.hmacSha256Hex(`KIOSK_BUCKET:${bucket}`);
  return `KIOSK_BUCKET|${bucket}|${mac.slice(0, 24)}`;
};

/**
 * Formats an ISO timestamp into readable Thai Date & Time
 */
window.formatThaiDateTime = function (isoString) {
  if (!isoString) return "-";
  try {
    const d = new Date(isoString);
    return d.toLocaleString("th-TH", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch (_) {
    return isoString;
  }
};

window.rpcCall = async function (rpcName, params = {}) {
  if (window.isBackendConfigured()) {
    const endpoint = `${window.APP_CONFIG.SUPABASE_URL.replace(/\/$/, "")}/rest/v1/rpc/${rpcName}`;
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: window.APP_CONFIG.SUPABASE_ANON_KEY,
        Authorization: `Bearer ${window.APP_CONFIG.SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify(params),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const err = new Error(
        data.message || data.error || `RPC Error ${response.status} from ${rpcName}`,
      );
      err.status = response.status;
      err.data = data;
      throw err;
    }
    return data;
  }

  // Local demo fallback for RPCs
  if (window.APP_CONFIG.ENABLE_LOCAL_SIMULATION_FALLBACK) {
    const db = await window.getLocalSimDb();
    if (rpcName === "get_attendance_summary") {
      const total = db.participants.length;
      const checkedIn = db.participants.filter((p) => p.checked_in_at).length;
      const activeMwa = db.participants.filter(
        (p) => p.person_status === "ACTIVE_MWA",
      ).length;
      const activeMwaIn = db.participants.filter(
        (p) => p.person_status === "ACTIVE_MWA" && p.checked_in_at,
      ).length;
      const retired = db.participants.filter(
        (p) => p.person_status === "RETIRED",
      ).length;
      const retiredIn = db.participants.filter(
        (p) => p.person_status === "RETIRED" && p.checked_in_at,
      ).length;
      const souvenirClaimed = db.participants.filter(
        (p) => p.souvenir_received_at,
      ).length;
      const mealClaimed = db.participants.filter(
        (p) => p.meal_voucher_received_at,
      ).length;

      return {
        total_registered: total,
        total_checked_in: checkedIn,
        active_mwa_count: activeMwa,
        active_mwa_checked_in: activeMwaIn,
        retired_count: retired,
        retired_checked_in: retiredIn,
        total_souvenirs_claimed: souvenirClaimed,
        total_meals_claimed: mealClaimed,
      };
    }

    if (rpcName === "get_lucky_draw_candidates") {
      const filter = params.p_status_filter || "ALL";
      const wonIds = new Set(
        (db.lucky_draw_winners || []).map((w) => w.participant_id),
      );
      return db.participants
        .filter(
          (p) =>
            p.checked_in_at &&
            !wonIds.has(p.id) &&
            (filter === "ALL" || p.person_status === filter),
        )
        .map((p) => ({
          id: p.id,
          member_no: p.member_no,
          prefix: p.prefix,
          first_name: p.first_name,
          last_name: p.last_name,
          person_status: p.person_status,
          checked_in_at: p.checked_in_at,
        }));
    }

    if (rpcName === "record_lucky_draw_winner") {
      db.lucky_draw_winners = db.lucky_draw_winners || [];
      const winner = {
        id: "win-" + Date.now(),
        participant_id: params.p_participant_id,
        prize_name: params.p_prize_name,
        prize_tier: params.p_prize_tier || "GENERAL",
        won_at: new Date().toISOString(),
        won_by: params.p_won_by || "DEMO_ADMIN",
      };
      db.lucky_draw_winners.push(winner);
      window.saveLocalSimDb(db);
      return winner;
    }
  }

  throw new Error("RPC Call failed: Backend not configured");
};

/**
 * Calls a Supabase Edge Function via stateless HTTP REST (`fetch`).
 * Automatically falls back to the built-in Local Demo Simulator when running
 * on GitHub Pages / localhost before Supabase URL is configured.
 */
window.invokeEdgeFunction = async function (functionName, payload) {
  if (window.isBackendConfigured()) {
    const endpoint = `${window.APP_CONFIG.SUPABASE_URL.replace(/\/$/, "")}/functions/v1/${functionName}`;
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: window.APP_CONFIG.SUPABASE_ANON_KEY,
        Authorization: `Bearer ${window.APP_CONFIG.SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const err = new Error(
        data.error || `HTTP Error ${response.status} from ${functionName}`,
      );
      err.status = response.status;
      err.data = data;
      err.require_checkout = Boolean(data.require_checkout);
      throw err;
    }
    return data;
  }

  // Fallback to Local Demo Simulator when Supabase URL is not yet configured
  if (window.APP_CONFIG.ENABLE_LOCAL_SIMULATION_FALLBACK) {
    return await window.simulateEdgeFunctionLocal(functionName, payload);
  }

  throw new Error(
    "ยังไม่ได้ตั้งค่า SUPABASE_URL และ SUPABASE_ANON_KEY ใน public/js/config.js",
  );
};

/**
 * ============================================================================
 * LOCAL DEMO SIMULATOR (Zero-Setup Interactive Preview in Browser)
 * Mirrors the exact PostgreSQL schema & Edge Function rules in localStorage
 * when `SUPABASE_URL` has not been set yet, so all 4 pages can be tested
 * end-to-end immediately!
 * ============================================================================
 */
window.getLocalSimDb = async function () {
  const raw = localStorage.getItem("MWA_SIM_DB_V1");
  if (raw) {
    try {
      return JSON.parse(raw);
    } catch (_) {
      // reset if corrupted
    }
  }

  const h1 = await window.hashMemberPhoneClient("00001", "0812345678");
  const h2 = await window.hashMemberPhoneClient("00002", "0898765432");
  const h3 = await window.hashMemberPhoneClient("00003", "0811112222");

  const initialDb = {
    system_settings: {
      id: 1,
      event_name:
        "งานอบรมสัมมนาสมาชิกสหกรณ์ออมทรัพย์พนักงานการประปานครหลวง จำกัด ประจำปี 2569",
      is_system_active: true,
      enable_registration: true,
      enable_checkin: true,
      enable_checkout: false,
      enable_kiosk_mode: true,
      enable_staff_scanner: true,
      enable_dynamic_qr: true,
      dynamic_qr_interval_sec: 20,
      enable_certificate: true,
      require_checkout_for_cert: false,
      enable_photo_consent: true,
      announcement_text:
        "ยินดีต้อนรับสมาชิกสหกรณ์ฯ ทุกท่าน (ตัวอย่างข้อมูลทดสอบ: ทะเบียน 00001 โทร 0812345678 หรือ 00003 โทร 0811112222)",
      enable_souvenir_claim: true,
      enable_meal_claim: true,
      enable_lucky_draw: true,
      enable_badge_printing: true,
      auto_print_badge: false,
      enable_line_flex_ticket: true,
      theme_color: "#006699",
      helpdesk_contact: "โทร 02-500-2222 ต่อ 1234",
      updated_at: new Date().toISOString(),
    },
    participants: [
      {
        id: "sim-uuid-00001",
        member_no: "00001",
        phone_hash: h1,
        prefix: "นาย",
        first_name: "สมชาย",
        last_name: "สายชลชื่น",
        person_status: "ACTIVE_MWA",
        line_user_id: null,
        qr_token: "MWAQR-00001-demo8f92a1c4b7e2-991a2b3c4d5e6f70",
        pdpa_acknowledged_at: null,
        photo_consent: false,
        checked_in_at: null,
        checked_out_at: null,
        checkin_mode: null,
        checked_in_by: null,
        souvenir_received_at: null,
        souvenir_received_by: null,
        meal_voucher_received_at: null,
        meal_voucher_received_by: null,
      },
      {
        id: "sim-uuid-00002",
        member_no: "00002",
        phone_hash: h2,
        prefix: "นางสาว",
        first_name: "วารี",
        last_name: "ศรีประปา",
        person_status: "ACTIVE_MWA",
        line_user_id: "U_DEMO_BOUND_002",
        qr_token: "MWAQR-00002-demo4c21e8a9f0d1-1122334455667788",
        pdpa_acknowledged_at: new Date(Date.now() - 3600000).toISOString(),
        photo_consent: true,
        checked_in_at: new Date(Date.now() - 1800000).toISOString(),
        checked_out_at: null,
        checkin_mode: "KIOSK",
        checked_in_by: "U_DEMO_BOUND_002",
        souvenir_received_at: new Date(Date.now() - 1500000).toISOString(),
        souvenir_received_by: "U_DEMO_STAFF_SCANNER_001",
        meal_voucher_received_at: null,
        meal_voucher_received_by: null,
      },
      {
        id: "sim-uuid-00003",
        member_no: "00003",
        phone_hash: h3,
        prefix: "ร.ต.",
        first_name: "เกษม",
        last_name: "เปรมปรีดิ์",
        person_status: "RETIRED",
        line_user_id: null,
        qr_token: "MWAQR-00003-demo7b33d1f5e6a0-aabbccddeeff0011",
        pdpa_acknowledged_at: null,
        photo_consent: false,
        checked_in_at: new Date(Date.now() - 900000).toISOString(),
        checked_out_at: null,
        checkin_mode: "STAFF",
        checked_in_by: "U_DEMO_STAFF_SCANNER_001",
        souvenir_received_at: null,
        souvenir_received_by: null,
        meal_voucher_received_at: new Date(Date.now() - 800000).toISOString(),
        meal_voucher_received_by: "U_DEMO_STAFF_SCANNER_001",
      },
    ],
    lucky_draw_winners: [],
    staff_roles: [
      {
        id: "staff-1",
        line_user_id: "U_DEMO_SUPER_ADMIN_001",
        display_name: "ผู้ดูแลระบบสูงสุด (Super Admin)",
        role: "ADMIN",
        is_active: true,
        created_at: new Date().toISOString(),
      },
      {
        id: "staff-2",
        line_user_id: "U_DEMO_STAFF_SCANNER_001",
        display_name: "เจ้าหน้าที่จุดลงทะเบียน 1",
        role: "STAFF",
        is_active: true,
        created_at: new Date().toISOString(),
      },
      {
        id: "staff-3",
        line_user_id: "U_DEMO_MEMBER_001",
        display_name: "บัญชีทดสอบ (สิทธิ์ Admin & Member)",
        role: "ADMIN",
        is_active: true,
        created_at: new Date().toISOString(),
      },
    ],
    audit_logs: [
      {
        id: 1,
        actor_line_uid: "U_DEMO_SUPER_ADMIN_001",
        action_type: "SYSTEM_INIT",
        details: { mode: "LOCAL_DEMO_SIMULATION" },
        created_at: new Date().toISOString(),
      },
    ],
  };

  localStorage.setItem("MWA_SIM_DB_V1", JSON.stringify(initialDb));
  return initialDb;
};

window.saveLocalSimDb = function (db) {
  db.system_settings.updated_at = new Date().toISOString();
  localStorage.setItem("MWA_SIM_DB_V1", JSON.stringify(db));
};

window.simulateEdgeFunctionLocal = async function (functionName, payload) {
  await new Promise((r) => setTimeout(r, 180)); // realistic latency
  const db = await window.getLocalSimDb();
  const settings = db.system_settings;

  const parseUid = (token) => {
    if (!token) return "U_DEMO_MEMBER_001";
    if (token.startsWith("DEMO_TOKEN:")) {
      return token.split(":")[1] || "U_DEMO_MEMBER_001";
    }
    return "U_DEMO_MEMBER_001";
  };

  const callerUid = parseUid(payload.idToken);

  if (functionName === "register") {
    const existingBound = db.participants.find(
      (p) => p.line_user_id === callerUid,
    );
    if (payload.action === "STATUS") {
      return {
        bound: Boolean(existingBound),
        member: existingBound || null,
        settings,
      };
    }

    if (!settings.enable_registration) {
      throw new Error("ระบบปิดรับลงทะเบียนแล้ว");
    }

    const normNo = window.normalizeMemberNo(payload.member_no || "");
    const hash =
      payload.phone_hash ||
      (await window.hashMemberPhoneClient(normNo, payload.phone_number || ""));

    if (existingBound && existingBound.member_no !== normNo) {
      throw new Error("บัญชี LINE นี้ถูกผูกกับทะเบียนอื่นแล้ว");
    }

    const member = db.participants.find(
      (p) => p.member_no === normNo && p.phone_hash === hash,
    );
    if (!member) {
      throw new Error(
        "ไม่พบข้อมูลสมาชิก หรือหมายเลขโทรศัพท์ไม่ถูกต้อง กรุณาติดต่อเจ้าหน้าที่",
      );
    }
    if (member.line_user_id && member.line_user_id !== callerUid) {
      throw new Error("บัญชี LINE อื่นได้ผูกกับเลขทะเบียนสมาชิกนี้ไปแล้ว");
    }

    member.line_user_id = callerUid;
    member.pdpa_acknowledged_at = new Date().toISOString();
    member.photo_consent = Boolean(payload.photo_consent);
    window.saveLocalSimDb(db);

    return {
      success: true,
      member,
      qr_token: member.qr_token,
      settings,
    };
  }

  if (functionName === "checkin") {
    if (payload.mode === "VERIFY_STAFF") {
      const staff = db.staff_roles.find(
        (s) => s.line_user_id === callerUid && s.is_active,
      );
      if (!staff) {
        throw new Error(
          `บัญชี LINE (${callerUid}) ไม่มีสิทธิ์เจ้าหน้าที่ใน staff_roles`,
        );
      }
      return { authorized: true, staff, settings };
    }

    const actionType = payload.action_type || "CHECKIN";
    const isCheckout = actionType === "CHECKOUT";
    const isSouvenir = actionType === "CLAIM_SOUVENIR";
    const isMeal = actionType === "CLAIM_MEAL";
    const isCheckoutAndMeal = actionType === "CHECKOUT_AND_CLAIM_MEAL";

    if ((isCheckout || isCheckoutAndMeal) && !settings.enable_checkout) {
      throw new Error("ระบบยังไม่เปิดรับการเช็คเอาท์ (Check-out)");
    }
    if (isSouvenir && !settings.enable_souvenir_claim) {
      throw new Error("ระบบยังไม่เปิดรับของที่ระลึก");
    }
    if ((isMeal || isCheckoutAndMeal) && !settings.enable_meal_claim) {
      throw new Error("ระบบยังไม่เปิดรับอาหารว่าง");
    }
    if (!isCheckout && !isCheckoutAndMeal && !isSouvenir && !isMeal && !settings.enable_checkin) {
      throw new Error("ระบบยังไม่เปิดรับการเช็คอินเข้างาน");
    }

    let member = null;
    if (payload.mode === "KIOSK") {
      if (!settings.enable_kiosk_mode) {
        throw new Error("ระบบปิดโหมดสแกนป้าย Kiosk ชั่วคราว");
      }
      member = db.participants.find((p) => p.line_user_id === callerUid);
    } else if (payload.mode === "STAFF") {
      if (!settings.enable_staff_scanner) {
        throw new Error("ระบบปิดโหมดสแกนผ่านเครื่องเจ้าหน้าที่ชั่วคราว");
      }
      const token = String(payload.target_qr_token || "").trim();
      const norm = window.normalizeMemberNo(token);
      member = db.participants.find(
        (p) => p.qr_token === token || p.member_no === norm,
      );
    }

    if (!member) {
      throw new Error("ไม่พบข้อมูลสมาชิกจาก QR Code ที่สแกน");
    }

    const fullName =
      `${member.prefix}${member.first_name} ${member.last_name}`.trim();

    if (isSouvenir) {
      const alreadyClaimed = Boolean(member.souvenir_received_at);
      if (!alreadyClaimed) {
        member.souvenir_received_at = payload.scanned_at || new Date().toISOString();
        member.souvenir_received_by = callerUid;
        window.saveLocalSimDb(db);
      }
      return {
        success: true,
        already_claimed: alreadyClaimed,
        action_type: "CLAIM_SOUVENIR",
        message: alreadyClaimed
          ? "สมาชิกได้รับของที่ระลึกไปแล้วก่อนหน้านี้"
          : "บันทึกการรับของที่ระลึกสำเร็จ",
        attendee: {
          member_no: member.member_no,
          full_name: fullName,
          person_status: member.person_status,
          checked_in_at: member.checked_in_at,
          checked_out_at: member.checked_out_at,
          souvenir_received_at: member.souvenir_received_at,
          meal_voucher_received_at: member.meal_voucher_received_at,
          checkin_mode: member.checkin_mode,
        },
      };
    }

    if (isMeal || isCheckoutAndMeal) {
      if (!member.checked_in_at) {
        throw new Error("สมาชิกยังไม่ได้เช็คอินเข้างาน ไม่สามารถรับอาหารว่างได้");
      }
      if (isMeal && !member.checked_out_at) {
        const err = new Error("สมาชิกยังไม่ได้เช็คเอาท์ (Check-out) ออกจากห้องประชุม กรุณาเช็คเอาท์ก่อนรับอาหารว่าง");
        err.require_checkout = true;
        err.attendee = {
          member_no: member.member_no,
          full_name: fullName,
          person_status: member.person_status,
          checked_in_at: member.checked_in_at,
          checked_out_at: null,
        };
        throw err;
      }
      const alreadyClaimed = Boolean(member.meal_voucher_received_at);
      if (!alreadyClaimed) {
        const nowIso = payload.scanned_at || new Date().toISOString();
        member.meal_voucher_received_at = nowIso;
        member.meal_voucher_received_by = callerUid;
        if (isCheckoutAndMeal && !member.checked_out_at) {
          member.checked_out_at = nowIso;
        }
        window.saveLocalSimDb(db);
      }
      return {
        success: true,
        already_claimed: alreadyClaimed,
        action_type: actionType,
        message: alreadyClaimed
          ? "สมาชิกได้รับอาหารว่างไปแล้วก่อนหน้านี้"
          : (isCheckoutAndMeal ? "เช็คเอาท์และบันทึกการรับอาหารว่างสำเร็จ" : "บันทึกการรับอาหารว่างสำเร็จ"),
        attendee: {
          member_no: member.member_no,
          full_name: fullName,
          person_status: member.person_status,
          checked_in_at: member.checked_in_at,
          checked_out_at: member.checked_out_at,
          souvenir_received_at: member.souvenir_received_at,
          meal_voucher_received_at: member.meal_voucher_received_at,
          checkin_mode: member.checkin_mode,
        },
      };
    }

    if (isCheckout) {
      if (!member.checked_in_at) {
        throw new Error("สมาชิกยังไม่ได้เช็คอินเข้างาน ไม่สามารถเช็คเอาท์ได้");
      }
      const alreadyOut = Boolean(member.checked_out_at);
      if (!alreadyOut) {
        member.checked_out_at = payload.scanned_at || new Date().toISOString();
        window.saveLocalSimDb(db);
      }
      return {
        success: true,
        already_checked_out: alreadyOut,
        action_type: "CHECKOUT",
        message: alreadyOut
          ? "สมาชิกได้เช็คเอาท์ไปแล้วก่อนหน้านี้"
          : "เช็คเอาท์สำเร็จ",
        attendee: {
          member_no: member.member_no,
          full_name: fullName,
          person_status: member.person_status,
          checked_in_at: member.checked_in_at,
          checked_out_at: member.checked_out_at,
          souvenir_received_at: member.souvenir_received_at,
          meal_voucher_received_at: member.meal_voucher_received_at,
          checkin_mode: member.checkin_mode,
        },
      };
    }

    const alreadyIn = Boolean(member.checked_in_at);
    if (!alreadyIn) {
      member.checked_in_at = payload.scanned_at || new Date().toISOString();
      member.checkin_mode = payload.mode;
      member.checked_in_by = callerUid;
      window.saveLocalSimDb(db);
    }

    return {
      success: true,
      already_checked_in: alreadyIn,
      action_type: "CHECKIN",
      message: alreadyIn
        ? "สมาชิกท่านนี้ได้เช็คอินเข้างานเรียบร้อยแล้ว"
        : "เช็คอินเข้างานสำเร็จ",
      attendee: {
        member_no: member.member_no,
        full_name: fullName,
        person_status: member.person_status,
        checked_in_at: member.checked_in_at,
        checked_out_at: member.checked_out_at,
        souvenir_received_at: member.souvenir_received_at,
        meal_voucher_received_at: member.meal_voucher_received_at,
        checkin_mode: member.checkin_mode,
      },
    };
  }

  if (functionName === "certificate") {
    if (!settings.enable_certificate) {
      throw new Error("ระบบยังไม่เปิดให้ดาวน์โหลดใบประกาศนียบัตร");
    }
    const member = db.participants.find((p) => p.line_user_id === callerUid);
    if (!member) {
      throw new Error("ไม่พบข้อมูลสมาชิกของท่านในระบบ");
    }
    if (!member.checked_in_at) {
      throw new Error(
        "ท่านยังไม่ได้ทำการเช็คอินเข้าร่วมงาน จึงยังไม่ผ่านเกณฑ์รับใบประกาศนียบัตร",
      );
    }
    if (settings.require_checkout_for_cert && !member.checked_out_at) {
      throw new Error(
        "กรุณาทำการเช็คเอาท์ (Check-out) หลังจบงานก่อนดาวน์โหลดใบประกาศนียบัตร",
      );
    }
    const fullName =
      `${member.prefix}${member.first_name} ${member.last_name}`.trim();
    return {
      success: true,
      certificate: {
        member_no: member.member_no,
        full_name: fullName,
        person_status: member.person_status,
        person_status_label:
          member.person_status === "ACTIVE_MWA"
            ? "สมาชิกประเภทพนักงาน กปน."
            : "สมาชิกประเภทผู้เกษียณอายุ",
        event_name: settings.event_name,
        issue_date: "12 พฤศจิกายน พ.ศ. 2569",
        checked_in_at: member.checked_in_at,
        checked_out_at: member.checked_out_at,
        cert_id: `MWACERT-${member.member_no}-9A8B7C6D`,
      },
    };
  }

  if (functionName === "admin-action") {
    const expectedPin = localStorage.getItem("MWA_SIM_ADMIN_PIN") || "123456";
    if (String(payload.admin_pin || "").trim() !== expectedPin) {
      throw new Error("รหัสผ่าน Super Admin PIN 6 หลักไม่ถูกต้อง (ค่าเริ่มต้น Demo: 123456)");
    }

    const action = payload.action;
    const p = payload.payload || {};

    if (action === "VERIFY_ADMIN") {
      return {
        success: true,
        admin: {
          line_user_id: callerUid,
          display_name: "ผู้ดูแลระบบสูงสุด (Admin)",
          role: "ADMIN",
        },
        settings: db.system_settings,
        audit_logs: db.audit_logs.slice(0, 25),
        staff_list: db.staff_roles,
      };
    }

    if (action === "UPDATE_SETTINGS") {
      Object.assign(db.system_settings, p);
      db.audit_logs.unshift({
        id: db.audit_logs.length + 1,
        actor_line_uid: callerUid,
        action_type: "TOGGLE_FEATURE",
        details: p,
        created_at: new Date().toISOString(),
      });
      window.saveLocalSimDb(db);
      return { success: true, settings: db.system_settings };
    }

    if (action === "BULK_IMPORT") {
      const rows = Array.isArray(p.rows) ? p.rows : [];
      let count = 0;
      for (const r of rows) {
        const memberNo = window.normalizeMemberNo(r.member_no || "");
        if (!memberNo) continue;
        const hash =
          r.phone_hash ||
          (await window.hashMemberPhoneClient(memberNo, r.phone || ""));
        const status =
          String(r.status || r.person_status || "ACTIVE_MWA").toUpperCase() ===
          "RETIRED"
            ? "RETIRED"
            : "ACTIVE_MWA";
        const idx = db.participants.findIndex((x) => x.member_no === memberNo);
        const rec = {
          id: `sim-uuid-${memberNo}`,
          member_no: memberNo,
          phone_hash: hash,
          prefix: r.prefix || "",
          first_name: r.first_name || "",
          last_name: r.last_name || "",
          person_status: status,
          line_user_id: idx >= 0 ? db.participants[idx].line_user_id : null,
          qr_token:
            idx >= 0
              ? db.participants[idx].qr_token
              : `MWAQR-${memberNo}-${Math.random().toString(16).slice(2, 14)}`,
          pdpa_acknowledged_at:
            idx >= 0 ? db.participants[idx].pdpa_acknowledged_at : null,
          photo_consent: idx >= 0 ? db.participants[idx].photo_consent : false,
          checked_in_at: idx >= 0 ? db.participants[idx].checked_in_at : null,
          checked_out_at: idx >= 0 ? db.participants[idx].checked_out_at : null,
          checkin_mode: idx >= 0 ? db.participants[idx].checkin_mode : null,
          checked_in_by: idx >= 0 ? db.participants[idx].checked_in_by : null,
        };
        if (idx >= 0) db.participants[idx] = rec;
        else db.participants.push(rec);
        count++;
      }
      db.audit_logs.unshift({
        id: db.audit_logs.length + 1,
        actor_line_uid: callerUid,
        action_type: "BULK_IMPORT",
        details: { imported_count: count },
        created_at: new Date().toISOString(),
      });
      window.saveLocalSimDb(db);
      return { success: true, imported_count: count };
    }

    if (action === "MEMBER_SEARCH") {
      const q = String(p.query || "").trim().toLowerCase();
      const norm = window.normalizeMemberNo(q);
      const matches = db.participants.filter(
        (m) =>
          m.member_no === norm ||
          m.member_no.toLowerCase().includes(q) ||
          m.first_name.toLowerCase().includes(q) ||
          m.last_name.toLowerCase().includes(q),
      );
      return { success: true, members: matches.slice(0, 10) };
    }

    if (action === "MEMBER_OVERRIDE") {
      const norm = window.normalizeMemberNo(p.member_no || "");
      const member = db.participants.find((m) => m.member_no === norm);
      if (!member) throw new Error(`ไม่พบสมาชิกเลขทะเบียน ${norm}`);

      if (p.override_type === "RESET_LINE") {
        member.line_user_id = null;
      } else if (p.override_type === "UPDATE_PHONE") {
        member.phone_hash =
          p.new_phone_hash ||
          (await window.hashMemberPhoneClient(norm, p.new_phone || ""));
      } else if (p.override_type === "MANUAL_CHECKIN") {
        member.checked_in_at = new Date().toISOString();
        member.checkin_mode = "ADMIN_OVERRIDE";
        member.checked_in_by = callerUid;
      } else if (p.override_type === "MANUAL_CHECKOUT") {
        member.checked_out_at = new Date().toISOString();
      } else if (p.override_type === "RESET_CHECKIN") {
        member.checked_in_at = null;
        member.checked_out_at = null;
        member.checkin_mode = null;
        member.checked_in_by = null;
      } else if (p.override_type === "MANUAL_SOUVENIR") {
        member.souvenir_received_at = new Date().toISOString();
        member.souvenir_received_by = callerUid;
      } else if (p.override_type === "MANUAL_MEAL") {
        member.meal_voucher_received_at = new Date().toISOString();
        member.meal_voucher_received_by = callerUid;
      } else if (p.override_type === "RESET_SOUVENIR") {
        member.souvenir_received_at = null;
        member.souvenir_received_by = null;
      } else if (p.override_type === "RESET_MEAL") {
        member.meal_voucher_received_at = null;
        member.meal_voucher_received_by = null;
      }

      db.audit_logs.unshift({
        id: db.audit_logs.length + 1,
        actor_line_uid: callerUid,
        action_type: "STAFF_OVERRIDE",
        details: { member_no: norm, override_type: p.override_type },
        created_at: new Date().toISOString(),
      });
      window.saveLocalSimDb(db);
      return { success: true, member };
    }

    if (action === "MANAGE_STAFF") {
      if (p.sub_action === "DELETE") {
        db.staff_roles = db.staff_roles.filter(
          (s) => s.line_user_id !== p.line_user_id,
        );
      } else {
        const existing = db.staff_roles.find(
          (s) => s.line_user_id === p.line_user_id,
        );
        if (existing) {
          existing.display_name = p.display_name;
          existing.role = p.role;
        } else {
          db.staff_roles.unshift({
            id: "staff-" + Date.now(),
            line_user_id: p.line_user_id,
            display_name: p.display_name,
            role: p.role,
            is_active: true,
            created_at: new Date().toISOString(),
          });
        }
      }
      window.saveLocalSimDb(db);
      return { success: true, staff_list: db.staff_roles };
    }

    if (action === "PDPA_PURGE") {
      if (p.confirmation_phrase !== "CONFIRM_PURGE_EVENT_DATA") {
        throw new Error(
          'คำยืนยันไม่ถูกต้อง กรุณาพิมพ์ "CONFIRM_PURGE_EVENT_DATA"',
        );
      }
      let purgedCount = 0;
      for (const m of db.participants) {
        if (m.first_name !== "[PURGED]") {
          m.prefix = "";
          m.first_name = "[PURGED]";
          m.last_name = "[PURGED]";
          m.phone_hash =
            "0000000000000000000000000000000000000000000000000000000000000000";
          m.line_user_id = null;
          purgedCount++;
        }
      }
      db.system_settings.enable_registration = false;
      db.system_settings.enable_checkin = false;
      db.system_settings.enable_checkout = false;
      db.system_settings.enable_certificate = false;
      db.audit_logs.unshift({
        id: db.audit_logs.length + 1,
        actor_line_uid: callerUid,
        action_type: "PDPA_PURGE",
        details: { purged_records: purgedCount },
        created_at: new Date().toISOString(),
      });
      window.saveLocalSimDb(db);
      return {
        success: true,
        purged_records: purgedCount,
        message: "ลบข้อมูลส่วนบุคคล (PII) ตามมาตรฐาน PDPA สำเร็จเรียบร้อยแล้ว",
      };
    }

    if (action === "LUCKY_DRAW_RESET") {
      db.lucky_draw_winners = [];
      db.audit_logs.unshift({
        id: db.audit_logs.length + 1,
        actor_line_uid: callerUid,
        action_type: "LUCKY_DRAW_RESET",
        details: { reset_at: new Date().toISOString() },
        created_at: new Date().toISOString(),
      });
      window.saveLocalSimDb(db);
      return { success: true, message: "รีเซ็ตรายชื่อผู้ได้รับรางวัลทั้งหมดแล้ว" };
    }
  }

  throw new Error(`Unknown function ${functionName}`);
};
