import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

const DIRECTION_ACTIONS = new Set(['up', 'left', 'down', 'right']);

function ControlButton({ input, onDown, onUp, onKeyboardActivate }) {
  return (
    <button
      type="button"
      className={`browser-control-button control-${input.action}`}
      aria-label={`${input.label} (${input.code})`}
      title={input.code}
      onPointerDown={(event) => onDown(event, input)}
      onPointerUp={(event) => onUp(event, input)}
      onPointerCancel={(event) => onUp(event, input)}
      onContextMenu={(event) => event.preventDefault()}
      onClick={(event) => {
        if (event.detail === 0) onKeyboardActivate(input);
      }}
    >
      <span>{input.label}</span>
      {!DIRECTION_ACTIONS.has(input.action) && <small>{input.code}</small>}
    </button>
  );
}

export default function BrowserGameFrame({ game, showLargeLink = false }) {
  const iframeRef = useRef(null);
  const stageRef = useRef(null);
  const repeatTimers = useRef(new Map());
  const [sessionStatus, setSessionStatus] = useState('Loading secure player…');

  useEffect(() => {
    function onMessage(event) {
      if (event.source !== iframeRef.current?.contentWindow) return;
      const message = event.data;
      if (!message || message.source !== 'iscsteam-game') return;
      if (message.type === 'bridge-ready') setSessionStatus('Controls connected');
      if (message.type === 'loading') setSessionStatus(message.message || 'Loading game…');
      if (message.type === 'ready') setSessionStatus('Ready — click inside the game to start');
      if (message.type === 'started') setSessionStatus('Playing now');
      if (message.type === 'level-complete') setSessionStatus(`Level ${message.level} complete`);
      if (message.type === 'complete') setSessionStatus('Game complete');
      if (message.type === 'error') setSessionStatus(message.message || 'Browser build failed to start');
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  useEffect(() => () => {
    for (const timer of repeatTimers.current.values()) window.clearInterval(timer);
    repeatTimers.current.clear();
  }, []);

  function sendInput(input, phase, repeat = false) {
    iframeRef.current?.contentWindow?.postMessage({
      source: 'iscsteam-player',
      type: 'input',
      action: input.action,
      code: input.code,
      phase,
      repeat,
    }, '*');
  }

  function pressInput(event, input) {
    event.preventDefault();
    try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* pointer already released */ }
    if (repeatTimers.current.has(input.action)) return;
    sendInput(input, 'down');
    if (input.mode === 'hold') {
      repeatTimers.current.set(input.action, window.setInterval(() => sendInput(input, 'down', true), 120));
    }
  }

  function releaseInput(event, input) {
    event.preventDefault();
    const timer = repeatTimers.current.get(input.action);
    if (timer != null) window.clearInterval(timer);
    repeatTimers.current.delete(input.action);
    sendInput(input, 'up');
  }

  function keyboardActivate(input) {
    sendInput(input, 'down');
    window.setTimeout(() => sendInput(input, 'up'), 60);
  }

  async function enterFullscreen() {
    try {
      await stageRef.current?.requestFullscreen?.();
    } catch {
      setSessionStatus('Fullscreen is not available in this browser');
    }
  }

  const inputs = game.browserInputs ?? [];
  const directions = inputs.filter((input) => DIRECTION_ACTIONS.has(input.action));
  const actions = inputs.filter((input) => !DIRECTION_ACTIONS.has(input.action));
  const viewport = game.browserViewport ?? { width: 960, height: 600 };
  const runtimeLabel = game.browserRuntime === 'canvas-module' ? 'optimized game.js' : 'web build';

  return (
    <div className="browser-stage" ref={stageRef}>
      <div className="browser-stage-bar">
        <span><i /> {sessionStatus}</span>
        <div className="browser-stage-actions">
          <span className="mono">{runtimeLabel}</span>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => iframeRef.current?.focus()}>Focus</button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={enterFullscreen}>Fullscreen</button>
          {showLargeLink && <Link className="btn btn-ghost btn-sm" to={`/beta/${game.slug}`}>Open large</Link>}
        </div>
      </div>
      <iframe
        ref={iframeRef}
        src={game.playUrl}
        title={`${game.title} browser game`}
        sandbox="allow-scripts allow-pointer-lock allow-forms"
        allow="autoplay; fullscreen; gamepad"
        allowFullScreen
        referrerPolicy="no-referrer"
        style={{ aspectRatio: `${viewport.width} / ${viewport.height}` }}
        onLoad={() => setSessionStatus('Game loaded — controls connecting…')}
      />
      {inputs.length > 0 && (
        <div className="browser-control-deck" aria-label="On-screen game controls">
          {directions.length > 0 && (
            <div className="browser-dpad">
              {directions.map((input) => (
                <ControlButton key={input.action} input={input} onDown={pressInput} onUp={releaseInput} onKeyboardActivate={keyboardActivate} />
              ))}
            </div>
          )}
          {actions.length > 0 && (
            <div className="browser-action-buttons">
              {actions.map((input) => (
                <ControlButton key={input.action} input={input} onDown={pressInput} onUp={releaseInput} onKeyboardActivate={keyboardActivate} />
              ))}
            </div>
          )}
          <p>Generated by ISC Steam from <code>isc.json</code></p>
        </div>
      )}
    </div>
  );
}
