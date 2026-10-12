// ==============================================================================
// Centralized Firebase Service
// ==============================================================================
// Manages Firebase App initialization, Anonymous Authentication,
// Realtime Database connection monitoring, and network error handling.
//
// Designed to:
// - Initialize Firebase once only
// - Support offline fallback (Play with System/Bot works with zero Firebase)
// - Expose authenticated UID for room identification
// - Track real-time connectivity via .info/connected
// - Preserve existing app features and Android WebView compatibility
// ==============================================================================

(function () {
  'use strict';

  let _app = null;
  let _auth = null;
  let _database = null;

  let _userUid = null;
  let _currentUser = null;
  let _isAuthenticated = false;
  let _isAuthenticating = false;
  let _authError = null;

  let _isRtdbConnected = false;
  let _connectionListeners = [];
  let _authStateListeners = [];

  // --- Initialize Firebase App (Singleton) ---
  function initFirebase() {
    if (_app) return { app: _app, auth: _auth, database: _database };

    if (typeof firebase === 'undefined') {
      console.warn('[FirebaseService] Firebase SDK is not loaded in window. Check script tags in index.html.');
      return null;
    }

    if (!isFirebaseConfigured()) {
      console.info('[FirebaseService] Firebase configuration has placeholder values. To enable online multiplayer, insert your Firebase Web config in js/firebase-config.js.');
      return null;
    }

    try {
      if (firebase.apps && firebase.apps.length > 0) {
        _app = firebase.apps[0];
      } else {
        _app = firebase.initializeApp(FIREBASE_CONFIG);
      }

      _auth = firebase.auth(_app);
      _database = firebase.database(_app);

      // Setup listeners
      _setupAuthStateListener();
      _setupRtdbConnectionListener();

      console.info('[FirebaseService] Firebase initialized successfully with project:', FIREBASE_CONFIG.projectId);
      return { app: _app, auth: _auth, database: _database };
    } catch (err) {
      console.error('[FirebaseService] Firebase initialization error:', err);
      _authError = err.message || String(err);
      return null;
    }
  }

  // --- Anonymous Authentication ---
  function _setupAuthStateListener() {
    if (!_auth) return;

    _auth.onAuthStateChanged(user => {
      _isAuthenticating = false;
      if (user) {
        _currentUser = user;
        _userUid = user.uid;
        _isAuthenticated = true;
        _authError = null;
        console.info('[FirebaseService] Anonymous user signed in. UID:', _userUid);
      } else {
        _currentUser = null;
        _userUid = null;
        _isAuthenticated = false;
      }
      _notifyAuthStateChange();
    }, err => {
      _isAuthenticating = false;
      _authError = err ? err.message : 'Auth state change error';
      console.error('[FirebaseService] Auth listener error:', err);
      _notifyAuthStateChange();
    });
  }

  async function ensureAnonymousAuth() {
    if (!initFirebase()) {
      return { success: false, error: 'Firebase is not initialized or not configured yet.' };
    }

    if (_isAuthenticated && _userUid) {
      return { success: true, uid: _userUid, user: _currentUser };
    }

    if (_isAuthenticating) {
      // Wait for in-flight auth
      return new Promise(resolve => {
        const timeout = setTimeout(() => {
          resolve({ success: false, error: 'Auth timed out' });
        }, 8000);

        const unregister = onAuthStateChange(state => {
          if (state.isAuthenticated && state.uid) {
            clearTimeout(timeout);
            unregister();
            resolve({ success: true, uid: state.uid, user: state.user });
          } else if (state.error) {
            clearTimeout(timeout);
            unregister();
            resolve({ success: false, error: state.error });
          }
        });
      });
    }

    _isAuthenticating = true;
    _authError = null;
    _notifyAuthStateChange();

    try {
      const cred = await _auth.signInAnonymously();
      _currentUser = cred.user;
      _userUid = cred.user.uid;
      _isAuthenticated = true;
      _isAuthenticating = false;
      _notifyAuthStateChange();
      return { success: true, uid: _userUid, user: _currentUser };
    } catch (err) {
      _isAuthenticating = false;
      _authError = err.message || String(err);
      console.error('[FirebaseService] signInAnonymously failed:', err);
      _notifyAuthStateChange();
      return { success: false, error: _authError };
    }
  }

  // --- Realtime Database Connection Monitor ---
  function _setupRtdbConnectionListener() {
    if (!_database) return;

    try {
      const connectedRef = _database.ref('.info/connected');
      connectedRef.on('value', snap => {
        _isRtdbConnected = Boolean(snap.val());
        console.info('[FirebaseService] RTDB Connection status:', _isRtdbConnected ? 'ONLINE' : 'OFFLINE');
        _notifyConnectionChange();
      });
    } catch (err) {
      console.warn('[FirebaseService] Failed to listen to .info/connected:', err);
    }
  }

  // --- Subscriptions ---
  function onAuthStateChange(callback) {
    if (typeof callback !== 'function') return () => {};
    _authStateListeners.push(callback);
    // Call immediately with current state
    try {
      callback({
        isAuthenticated: _isAuthenticated,
        isAuthenticating: _isAuthenticating,
        uid: _userUid,
        user: _currentUser,
        error: _authError
      });
    } catch (e) {}

    return () => {
      _authStateListeners = _authStateListeners.filter(cb => cb !== callback);
    };
  }

  function _notifyAuthStateChange() {
    const data = {
      isAuthenticated: _isAuthenticated,
      isAuthenticating: _isAuthenticating,
      uid: _userUid,
      user: _currentUser,
      error: _authError
    };
    _authStateListeners.forEach(cb => {
      try { cb(data); } catch (e) { console.warn(e); }
    });
  }

  function onConnectionChange(callback) {
    if (typeof callback !== 'function') return () => {};
    _connectionListeners.push(callback);
    try { callback(_isRtdbConnected); } catch (e) {}
    return () => {
      _connectionListeners = _connectionListeners.filter(cb => cb !== callback);
    };
  }

  function _notifyConnectionChange() {
    _connectionListeners.forEach(cb => {
      try { cb(_isRtdbConnected); } catch (e) { console.warn(e); }
    });
  }

  // --- Diagnostics Test Runner (Phase 2) ---
  async function runDiagnostics() {
    const results = {
      sdkLoaded: typeof firebase !== 'undefined' && !!firebase.initializeApp,
      configured: isFirebaseConfigured(),
      projectId: isFirebaseConfigured() ? FIREBASE_CONFIG.projectId : null,
      authReady: false,
      uid: null,
      rtdbConnected: false,
      databaseURL: isFirebaseConfigured() ? FIREBASE_CONFIG.databaseURL : null,
      error: null
    };

    if (!results.sdkLoaded) {
      results.error = 'Firebase JavaScript SDK is not loaded. Please verify script tags in index.html.';
      return results;
    }

    if (!results.configured) {
      results.error = 'Firebase configuration contains placeholders. Update js/firebase-config.js with your project credentials.';
      return results;
    }

    // Try initializing
    const instances = initFirebase();
    if (!instances) {
      results.error = _authError || 'Failed to initialize Firebase instance.';
      return results;
    }

    // Test Anonymous Auth
    const authRes = await ensureAnonymousAuth();
    if (authRes.success) {
      results.authReady = true;
      results.uid = authRes.uid;
    } else {
      results.error = `Authentication failed: ${authRes.error}`;
      return results;
    }

    // Check RTDB connection (.info/connected is safe and requires NO public read/write rules!)
    results.rtdbConnected = _isRtdbConnected;

    return results;
  }

  // --- Public API Export ---
  window.FirebaseService = {
    init: initFirebase,
    ensureAuth: ensureAnonymousAuth,
    getApp: () => _app,
    getAuth: () => _auth,
    getDatabase: () => {
      if (!_database) {
        initFirebase();
      }
      return _database;
    },
    getUid: () => _userUid,
    getCurrentUser: () => _currentUser,
    isAuthenticated: () => _isAuthenticated,
    isRtdbConnected: () => _isRtdbConnected,
    onAuthStateChange,
    onConnectionChange,
    runDiagnostics
  };

})();
