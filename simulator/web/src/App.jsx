import React, { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Html, Environment } from '@react-three/drei';
import PepperModel from './components/PepperModel';
import Room from './components/Room';
import Dashboard from './components/Dashboard';
import ChatPopup from './components/ChatPopup';
import SearchResultPopup from './components/SearchResultPopup';
import ControlPanel from './components/ControlPanel';
import TopBar from './components/TopBar';
import CommandPalette from './components/CommandPalette';
import { usePepperWebSocket, usePepperStore, useBrowserTTS, useBridgeTarget } from './hooks/usePepperState';

function SpeechOverlay() {
  const isSpeaking = usePepperStore((s) => s.isSpeaking);
  const currentSpeech = usePepperStore((s) => s.currentSpeech);
  const speechLanguage = usePepperStore((s) => s.speechLanguage);

  if (!isSpeaking || !currentSpeech) return null;

  return (
    <div style={{
      position: 'absolute',
      bottom: '80px',
      left: '50%',
      transform: 'translateX(-50%)',
      maxWidth: '500px',
      padding: '14px 24px',
      background: 'rgba(44, 44, 46, 0.95)',
      border: '1px solid #3a3a3c',
      borderRadius: '10px',
      fontFamily: "-apple-system, 'Segoe UI', Roboto, sans-serif",
      fontSize: '15px',
      color: '#e5e5e5',
      textAlign: 'center',
      zIndex: 100,
      pointerEvents: 'none',
    }}>
      <div style={{
        fontSize: '9px',
        color: '#999',
        textTransform: 'uppercase',
        letterSpacing: '2px',
        marginBottom: '6px',
      }}>
        Speaking ({speechLanguage})
      </div>
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
      <div style={{
        fontFamily: "-apple-system, 'Segoe UI', Roboto, sans-serif",
        color: '#999',
        fontSize: '18px',
      }}>
        Loading Simulator...
      </div>
    </Html>
  );
}

export default function App() {
  usePepperWebSocket();
  useBrowserTTS();
  useBridgeTarget();

  return (
    <div className="flex flex-col w-screen h-screen bg-bg">
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

      <div className="flex flex-1 min-h-0">
        <ControlPanel />
        {/* 3D Viewport */}
        <div className="flex-1 relative">
          <Canvas
            camera={{ position: [3, 4, 6], fov: 50, near: 0.1, far: 100 }}
            shadows
            gl={{ antialias: true }}
            style={{ background: '#1c1c1e' }}
          >
            <Suspense fallback={<LoadingFallback />}>
              <Room />
              <PepperModel />
            </Suspense>

            <OrbitControls
              enableDamping
              dampingFactor={0.05}
              maxPolarAngle={Math.PI / 2.1}
              minDistance={2}
              maxDistance={15}
              target={[0, 0.5, 0]}
            />

            {/* Fog for atmosphere */}
            <fog attach="fog" args={['#1c1c1e', 8, 20]} />
          </Canvas>

          <SpeechOverlay />
          <ChatPopup />
          <SearchResultPopup />
        </div>

        {/* Dashboard */}
        <Dashboard />
      </div>
    </div>
  );
}
