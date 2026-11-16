/**
 * ============================================================================
 * LINE LIFF v2 AUTHENTICATION & PROFILE MANAGER (`public/js/liff-helper.js`)
 * Handles LINE Login, ID Token retrieval, and Demo Mode fallback for testing
 * ============================================================================
 */

window.LiffHelper = {
  isInitialized: false,
  isDemoMode: false,
  profile: null,
  idToken: null,

  /**
   * Initializes LINE LIFF SDK v2.
   * If LIFF ID is a placeholder or `window.liff` fails on localhost/GitHub Pages
   * before LINE Developers setup, seamlessly activates interactive Demo Profile.
   */
  async init(liffId, defaultDemoRole = "MEMBER") {
    const resolvedLiffId = liffId || window.APP_CONFIG.LIFF_ID_MEMBER;
    const isPlaceholderLiff =
      !resolvedLiffId ||
      resolvedLiffId.startsWith("2000000000-") ||
      resolvedLiffId.includes("YOUR_LIFF_ID");

    const urlParams = new URLSearchParams(window.location.search);
    const forceDemo = urlParams.get("demo") === "1";

    if (!isPlaceholderLiff && !forceDemo && window.liff) {
      try {
        await window.liff.init({ liffId: resolvedLiffId });
        this.isInitialized = true;

        if (!window.liff.isLoggedIn()) {
          window.liff.login({ redirectUri: window.location.href });
          return null;
        }

        this.idToken = window.liff.getIDToken();
        const lineProfile = await window.liff.getProfile();
        this.profile = {
          userId: lineProfile.userId,
          displayName: lineProfile.displayName,
          pictureUrl: lineProfile.pictureUrl || "assets/logo.png",
        };
        return {
          idToken: this.idToken,
          profile: this.profile,
          isDemoMode: false,
        };
      } catch (err) {
        console.warn(
          "[LiffHelper] LIFF init failed, activating Demo fallback:",
          err,
        );
      }
    }

    // Activate Demo Mode (for instant preview or local testing without LINE Channel)
    this.isDemoMode = true;
    this.isInitialized = true;

    const savedDemoUid =
      localStorage.getItem(`MWA_DEMO_UID_${defaultDemoRole}`) ||
      (defaultDemoRole === "ADMIN"
        ? "U_DEMO_SUPER_ADMIN_001"
        : defaultDemoRole === "STAFF"
          ? "U_DEMO_STAFF_SCANNER_001"
          : "U_DEMO_MEMBER_001");

    const savedDemoName =
      localStorage.getItem(`MWA_DEMO_NAME_${defaultDemoRole}`) ||
      (defaultDemoRole === "ADMIN"
        ? "ผู้ดูแลระบบสูงสุด (Demo Admin)"
        : defaultDemoRole === "STAFF"
          ? "เจ้าหน้าที่สแกน (Demo Staff)"
          : "สมาชิกสหกรณ์ กปน. (Demo)");

    this.profile = {
      userId: savedDemoUid,
      displayName: savedDemoName,
      pictureUrl: "assets/logo.png",
    };
    this.idToken = `DEMO_TOKEN:${this.profile.userId}:${this.profile.displayName}`;

    return {
      idToken: this.idToken,
      profile: this.profile,
      isDemoMode: true,
    };
  },

  /**
   * Returns a valid LINE ID Token (or refreshes session if expired)
   */
  getIdToken() {
    if (!this.isDemoMode && window.liff && window.liff.isLoggedIn()) {
      const token = window.liff.getIDToken();
      if (token) {
        this.idToken = token;
      }
    }
    return this.idToken;
  },

  /**
   * Allows switching simulated LINE UID during Demo testing
   */
  setDemoIdentity(roleKey, userId, displayName) {
    localStorage.setItem(`MWA_DEMO_UID_${roleKey}`, userId);
    localStorage.setItem(`MWA_DEMO_NAME_${roleKey}`, displayName);
    window.location.reload();
  },

  /**
   * Logs out from LINE LIFF or clears demo session
   */
  logout() {
    if (!this.isDemoMode && window.liff && window.liff.isLoggedIn()) {
      window.liff.logout();
    }
    window.location.reload();
  },
};
