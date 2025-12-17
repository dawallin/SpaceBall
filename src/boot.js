const status = document.getElementById('status-bar');

const CDN_SOURCES = {
  babylon: [
    'https://cdn.babylonjs.com/babylon.js',
    'https://unpkg.com/babylonjs@7.20.0/babylon.js',
  ],
  havok: [
    'https://cdn.babylonjs.com/havok/HavokPhysics_umd.js',
    'https://unpkg.com/@babylonjs/havok@1.3.8/HavokPhysics_umd.js',
  ],
};

const MAX_POLLS = 60;
const POLL_INTERVAL_MS = 150;

function setStatus(text, color = '#003366') {
  if (!status) return;
  status.textContent = text;
  status.style.background = color;
}

function loadScript(label, sources) {
  return new Promise((resolve, reject) => {
    let index = 0;
    const tryLoad = () => {
      const src = sources[index];
      if (!src) {
        reject(new Error(`All ${label} sources failed`));
        return;
      }
      const tag = document.createElement('script');
      tag.src = src;
      tag.onload = () => resolve(src);
      tag.onerror = () => {
        index += 1;
        setStatus(`⚠️ ${label} failed from ${src}. Retrying…`, '#aa5a00');
        tryLoad();
      };
      document.head.appendChild(tag);
    };

    tryLoad();
  });
}

async function waitForGlobals() {
  let polls = 0;
  return new Promise((resolve, reject) => {
    const poll = () => {
      if (window.BABYLON && window.HavokPhysics) {
        resolve();
        return;
      }
      polls += 1;
      if (polls >= MAX_POLLS) {
        reject(new Error('Timed out waiting for Babylon/Havok globals.'));
        return;
      }
      setTimeout(poll, POLL_INTERVAL_MS);
    };
    poll();
  });
}

function getEntryPath() {
  const script = document.currentScript;
  return script?.dataset?.entry || './src/main.js';
}

async function bootstrap() {
  try {
    setStatus('⬇️ Loading Babylon.js…');
    const babylonSrc = await loadScript('Babylon.js', CDN_SOURCES.babylon);
    setStatus(`✅ Babylon.js ready (${babylonSrc})`);

    setStatus('⬇️ Loading Havok physics…');
    const havokSrc = await loadScript('Havok physics', CDN_SOURCES.havok);
    setStatus(`✅ Havok physics ready (${havokSrc})`);

    setStatus('⏳ Waiting for engines to initialise…');
    await waitForGlobals();

    const entry = getEntryPath();
    const script = document.createElement('script');
    script.type = 'module';
    script.src = `${entry}?v=${Date.now()}`;
    script.onerror = () => setStatus('❌ Failed to load game module.', '#b00020');
    document.body.appendChild(script);
    setStatus('🚀 Starting Space Ball…', '#118833');
  } catch (error) {
    console.error('[SpaceBall] bootstrap failed', error);
    setStatus(`❌ ${error.message}`, '#b00020');
  }
}

bootstrap();
