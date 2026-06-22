import { create } from 'zustand';
import { useEffect, useRef, useCallback } from 'react';
import { setBridgeUrl } from '../lib/bridge';

/**
 * Zustand store for Pepper's state.
 * Updated in real-time via WebSocket from the simulator bridge.
 */
export const usePepperStore = create((set) => ({
  connected: false,
  serverTts: false,   // bridge plays audio via Piper → browser TTS stays silent
  state: null,

  // Bridge target: 'sim' (localhost simulator) or 'real' (a physical Pepper).
  // `mode` is the single dial; useBridgeTarget() maps it (+ robotBridgeUrl) to
  // the actual bridge URL that control commands hit. 'real' with no connected
  // robot routes to the sim (harmless) — the banner says so.
  mode: 'sim',
  robotBridgeUrl: '',  // set by RobotConnection while a real Pepper is connected

  // ⌘K command palette open state (lifted so the TopBar affordance and the
  // global hotkey share one source of truth).
  paletteOpen: false,

  // Setup drawer (AI / bridge / robot / services). Config lives here, off the
  // control rail, so the rail stays pure operation.
  settingsOpen: false,
  // AI settings panel open state + an optional source to preselect, so the
  // first-run onboarding can deep-link the user straight into AI setup.
  aiPanelOpen: false,
  aiInitialSource: null,

  // Position
  x: 0.5, y: 0.5, theta: 0,
  isMoving: false,

  // Joints
  joints: {},

  // Status
  battery: 100,
  posture: 'StandInit',
  isSpeaking: false,
  currentSpeech: '',
  speechLanguage: 'en',

  // Eyes
  eyeColor: { r: 255, g: 255, b: 255 },

  // Tablet
  tabletVisible: false,
  tabletUrl: '',

  // Awareness
  autonomousLife: true,
  faceTracking: false,

  // Animation
  currentAnimation: null,

  // Navigation
  hasMap: false,
  isExploring: false,
  navTarget: null,
  roomObjects: {},

  // API log
  apiLog: [],

  // Uptime
  uptime: 0,

  // Chat
  chatMessages: [],
  chatLoading: false,

  // Search results
  searchResults: [],

  // Derived robot state
  robotState: 'idle',

  // Update from WebSocket message
  updateFromWS: (data) => set((state) => {
    let robotState = 'idle';
    if (data.is_speaking) robotState = 'speaking';
    else if (data.current_animation?.includes('Think')) robotState = 'thinking';

    const newSearchResults = data.search_results?.length
      ? [...state.searchResults, ...data.search_results.map((r) => ({ ...r, id: Date.now() + Math.random(), dismissAt: Date.now() + 8000 }))]
        .slice(-3)
      : state.searchResults;

    return {
      connected: true,
      state: data,
      x: data.position?.x ?? 0.5,
      y: data.position?.y ?? 0.5,
      theta: data.position?.theta ?? 0,
      isMoving: data.is_moving ?? false,
      joints: data.joints ?? {},
      battery: data.battery ?? 100,
      posture: data.posture ?? 'StandInit',
      isSpeaking: data.is_speaking ?? false,
      currentSpeech: data.current_speech ?? '',
      speechLanguage: data.speech_language ?? 'en',
      serverTts: data.server_tts ?? false,
      eyeColor: data.eye_color ?? { r: 255, g: 255, b: 255 },
      tabletVisible: data.tablet?.visible ?? false,
      tabletUrl: data.tablet?.url ?? '',
      tabletImage: data.tablet?.image ?? '',
      autonomousLife: data.autonomous_life ?? true,
      faceTracking: data.face_tracking ?? false,
      currentAnimation: data.current_animation,
      hasMap: data.has_map ?? false,
      isExploring: data.is_exploring ?? false,
      navTarget: data.nav_target,
      roomObjects: data.room_objects ?? {},
      apiLog: data.api_log ?? [],
      uptime: data.uptime ?? 0,
      robotState,
      searchResults: newSearchResults,
    };
  }),

  addChatMessage: (msg) => set((state) => ({
    chatMessages: [...state.chatMessages, msg],
  })),

  setChatLoading: (loading) => set({ chatLoading: loading }),

  addSearchResult: (result) => set((state) => ({
    searchResults: [...state.searchResults.slice(-2), { ...result, id: Date.now(), dismissAt: Date.now() + 8000 }],
  })),

  dismissSearchResult: (id) => set((state) => ({
    searchResults: state.searchResults.filter((r) => r.id !== id),
  })),

  setDisconnected: () => set({ connected: false }),

  setMode: (mode) => set({ mode }),
  setRobotBridgeUrl: (robotBridgeUrl) => set({ robotBridgeUrl }),
  setPaletteOpen: (paletteOpen) => set({ paletteOpen }),
  togglePalette: () => set((s) => ({ paletteOpen: !s.paletteOpen })),
  setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
  toggleSettings: () => set((s) => ({ settingsOpen: !s.settingsOpen })),
  setAiPanelOpen: (aiPanelOpen) => set({ aiPanelOpen }),
  // Open the setup drawer focused on AI, optionally jumping to a source tab.
  openAiPanel: (source = null) => set({ settingsOpen: true, aiPanelOpen: true, aiInitialSource: source }),
  clearAiInitialSource: () => set({ aiInitialSource: null }),
}));


/**
 * Maps the bridge-target dial (mode + robotBridgeUrl) to the actual bridge URL
 * the control helpers hit. 'sim' (or 'real' with no robot) → app origin; 'real'
 * with a connected robot → that robot's bridge. One place owns this side effect.
 */
export function useBridgeTarget() {
  const mode = usePepperStore((s) => s.mode);
  const robotBridgeUrl = usePepperStore((s) => s.robotBridgeUrl);

  useEffect(() => {
    setBridgeUrl(mode === 'real' && robotBridgeUrl ? robotBridgeUrl : '');
  }, [mode, robotBridgeUrl]);
}


/**
 * Hook for browser-side TTS — speaks Pepper's speech aloud.
 */
export function useBrowserTTS() {
  const currentSpeech = usePepperStore((s) => s.currentSpeech);
  const speechLanguage = usePepperStore((s) => s.speechLanguage);
  const serverTts = usePepperStore((s) => s.serverTts);
  const lastSpoken = useRef('');

  useEffect(() => {
    if (serverTts) return;   // bridge speaks via Piper — don't double up in the browser
    if (!currentSpeech || currentSpeech === lastSpoken.current) return;
    if (!window.speechSynthesis) {
      console.warn('[TTS] speechSynthesis not available');
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(currentSpeech);
    utterance.lang = speechLanguage === 'de' ? 'de-DE' : 'en-US';
    utterance.rate = 1.0;
    utterance.pitch = 1.1;
    console.log('[TTS] Speaking:', currentSpeech);
    window.speechSynthesis.speak(utterance);
    lastSpoken.current = currentSpeech;
  }, [currentSpeech, speechLanguage, serverTts]);
}


/**
 * Hook to maintain WebSocket connection to the simulator bridge.
 * Automatically reconnects on disconnect.
 */
// WS runs on a separate fixed port (5003) from the HTTP page; scheme tracks the
// page protocol so an HTTPS-served page uses wss:// (avoids mixed-content blocks).
const WS_PORT = 5003;
const WS_SCHEME = window.location.protocol === 'https:' ? 'wss' : 'ws';
const DEFAULT_WS_URL = `${WS_SCHEME}://${window.location.hostname}:${WS_PORT}`;

export function usePepperWebSocket(url = DEFAULT_WS_URL) {
  const wsRef = useRef(null);
  const reconnectRef = useRef(null);
  const updateFromWS = usePepperStore((s) => s.updateFromWS);
  const setDisconnected = usePepperStore((s) => s.setDisconnected);

  useEffect(() => {
    function connect() {
      if (wsRef.current?.readyState === WebSocket.OPEN) return;

      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('[WS] Connected to simulator');
        if (reconnectRef.current) {
          clearInterval(reconnectRef.current);
          reconnectRef.current = null;
        }
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          updateFromWS(data);
        } catch (e) {
          // ignore parse errors
        }
      };

      ws.onclose = () => {
        setDisconnected();
        console.log('[WS] Disconnected. Reconnecting...');
        if (!reconnectRef.current) {
          reconnectRef.current = setInterval(() => connect(), 2000);
        }
      };

      ws.onerror = () => {
        ws.close();
      };
    }

    connect();

    return () => {
      if (reconnectRef.current) clearInterval(reconnectRef.current);
      if (wsRef.current) wsRef.current.close();
    };
  }, [url, updateFromWS, setDisconnected]);
}
