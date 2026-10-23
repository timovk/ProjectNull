import './styles/main.css';
import { Game } from './core/Game.js';

function supportsWebGL() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGL2RenderingContext && c.getContext('webgl2'));
  } catch {
    return false;
  }
}

const viewport = document.getElementById('viewport');
const ui = document.getElementById('ui');

if (!supportsWebGL()) {
  ui.innerHTML = '<div class="screen opaque visible"><div class="menu-card"><h1 class="title">PROJECT NULL</h1><p class="prose">This game needs WebGL 2. Please use a current desktop browser with hardware acceleration enabled.</p></div></div>';
} else {
  const game = new Game(viewport, ui);
  if (import.meta.env.DEV || new URLSearchParams(location.search).has('debug')) window.__PROJECT_NULL__ = game;
}
