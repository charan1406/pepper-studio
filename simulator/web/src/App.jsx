import React, { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Html, Environment } from '@react-three/drei';
import PepperModel from './components/PepperModel';
import Room from './components/Room';
import Dashboard from './components/Dashboard';
import ChatPopup from './components/ChatPopup';
import FaultToast from './components/FaultToast';
import SearchResultPopup from './components/SearchResultPopup';
import ControlPanel from './components/ControlPanel';
import TopBar from './components/TopBar';
import CommandPalette from './components/CommandPalette';
import Onboarding from './components/Onboarding';
import SettingsDrawer from './components/SettingsDrawer';
import { usePepperWebSocket, usePepperStore, useBrowserTTS, useBridgeTarget } from './hooks/usePepperState';

function SpeechOverlay() {
  const isSpeaking = usePepperStore((s) => s.isSpeaking);
  const currentSpeech = usePepperStore((s) => s.currentSpeech);
  const speechLanguage = usePepperStore((s) => s.speechLanguage);

  if (!isSpeaking || !currentSpeech) return null;

  return (
    <div className="absolute bottom-20 left-1/2 -translate-x-1/2 max-w-[500px] px-6 py-3.5
                    bg-surface-1/95 border border-border rounded-lg text-[15px] text-text text-center
                    z-[100] pointer-events-none">
      <div className="text-[9px] text-muted uppercase tracking-[2px] mb-1.5">Speaking ({speechLanguage})</div>
      "{currentSpeech}"
    </div>
  );
}

function RealModeBanner() {
  const mode = usePepperStore((s) => s.mode);
  const robotBridgeUrl = usePepperStore((s) => s.robotBridgeUrl);
  if (mode !== 'real') return null;
  const connected = Boolean(robotBridgeUrl);
  return (
    <div className={'flex items-center justify-center gap-2 h-7 text-xs font-medium shrink-0 border-b '
      + (connected ? 'bg-danger/15 border-danger/30 text-danger' : 'bg-warn/15 border-warn/30 text-warn')}>
      {connected
        ? '⚠ Real-robot mode — control commands drive a physical Pepper. Keep the e-stop within reach.'
        : '○ Real-robot mode armed, but no robot is connected — connect one in the Robot panel. Commands route to the simulator until then.'}
    </div>
  );
}

function LoadingFallback() {
  return (
    <Html center>
      <div className="text-muted text-lg whitespace-nowrap">Loading Simulator...</div>
    </Html>
  );
}

export default function App() {
  usePepperWebSocket();
  useBrowserTTS();
  useBridgeTarget();

  return (
    <div className="flex flex-col w-screen h-screen hmi-panel">
      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100px); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes shrinkWidth {
          from { width: 100%; }
          to { width: 0%; }
        }
      `}</style>
      <TopBar />
      <RealModeBanner />
      <CommandPalette />
      <Onboarding />
      <SettingsDrawer />

      <div className="flex flex-1 min-h-0">
        <ControlPanel />
        {/* 3D Viewport — recessed in a metal bezel, like a panel screen */}
        <div className="flex-1 min-w-0 p-3 flex flex-col gap-3">
          <div className="hmi-bezel flex-1 min-h-0 w-full rounded-xl p-1.5">
            <div className="relative h-full w-full rounded-lg overflow-hidden hmi-glass">
              <Canvas
                camera={{ position: [-1.3, 1.8, 0.1], fov: 50, near: 0.1, far: 100 }}
                shadows
                gl={{ antialias: true }}
                style={{ background: '#1a1611' }}
              >
                <Suspense fallback={<LoadingFallback />}>
                  <Room />
                  <PepperModel />
                </Suspense>

                {/* Default framing: Pepper spawns at sim (0.5, 0.5) → scene (-3.5, -2.5).
                    Camera sits ~3m out at head height, aimed at the robot's chest. */}
                <OrbitControls
                  enableDamping
                  dampingFactor={0.05}
                  maxPolarAngle={Math.PI / 2.1}
                  minDistance={1.2}
                  maxDistance={15}
                  target={[-3.2, 0.7, -2.2]}
                />

                {/* Warm atmospheric fade beyond the room */}
                <fog attach="fog" args={['#1a1611', 18, 38]} />
              </Canvas>

              <SpeechOverlay />
              <SearchResultPopup />
              <FaultToast />
            </div>
          </div>
          <ChatPopup />
        </div>

        {/* Dashboard */}
        <Dashboard />
      </div>
    </div>
  );
}
