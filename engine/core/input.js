// One place for all player input.
//   Phones: joystick (left), buttons (right; mine is held), drag on the world to turn the camera, tap a block to aim at it.
//   Desktop: WASD / arrows, Space jump, mouse points at blocks; left button held = dig or hit, right click = place or eat,
//            right-drag = turn the camera, wheel = zoom, 1-6 = hotbar, E = bag, V = view.
// Systems read `move` (x right, y down, -1..1), `hover` (mouse position or null) and `takeLook()`; actions are events.
export class Input {
  constructor({ joy, knob, canvas, buttons = {}, holds = {}, onAny }){
    this.move = { x: 0, y: 0 }; this.look = { dx: 0, dy: 0, zoom: 0 }; this.keys = {}; this.actions = {}; this.onAny = onAny || (() => {}); this.hover = null; this.stick = { x: 0, y: 0 };
    const J = { id: null };
    const joyMove = e => { const r = joy.getBoundingClientRect(), R = r.width / 2, dx = e.clientX - r.left - R, dy = e.clientY - r.top - R, d = Math.hypot(dx, dy), m = R - 18, k = d > m ? m / d : 1;
      knob.style.transform = `translate(${dx * k}px,${dy * k}px)`; this.stick = { x: dx * k / m, y: dy * k / m }; this.onAny(); };
    joy.addEventListener('pointerdown', e => { J.id = e.pointerId; joy.setPointerCapture(e.pointerId); joyMove(e); });
    joy.addEventListener('pointermove', e => { if (e.pointerId === J.id) joyMove(e); });
    const joyEnd = e => { if (e.pointerId === J.id){ J.id = null; this.stick = { x: 0, y: 0 }; knob.style.transform = ''; } };
    joy.addEventListener('pointerup', joyEnd); joy.addEventListener('pointercancel', joyEnd);
    // the world canvas
    const drags = new Map();
    canvas.addEventListener('contextmenu', e => e.preventDefault());
    canvas.addEventListener('pointerdown', e => {
      this.onAny(); canvas.setPointerCapture(e.pointerId);
      const mouse = e.pointerType === 'mouse';
      if (mouse && e.button === 0){ this.fire('mineDown'); drags.set(e.pointerId, { mine: true }); return; }
      drags.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: performance.now(), moved: false, right: mouse && e.button === 2 });
    });
    canvas.addEventListener('pointermove', e => {
      if (e.pointerType === 'mouse') this.hover = { x: e.clientX, y: e.clientY };
      const d = drags.get(e.pointerId); if (!d || d.mine) return;
      if (Math.hypot(e.clientX - d.sx, e.clientY - d.sy) > 7) d.moved = true;
      if (d.moved){ this.look.dx += e.clientX - d.x; this.look.dy += e.clientY - d.y; } d.x = e.clientX; d.y = e.clientY;
    });
    const up = e => { const d = drags.get(e.pointerId); drags.delete(e.pointerId); if (!d) return;
      if (d.mine){ this.fire('mineUp'); return; }
      if (!d.moved){ if (d.right) this.fire('use'); else if (e.pointerType !== 'mouse' && performance.now() - d.t < 400) this.fire('tap', { x: e.clientX, y: e.clientY }); } };
    canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
    canvas.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') this.hover = null; });
    canvas.addEventListener('wheel', e => { this.look.zoom += e.deltaY; }, { passive: true });
    // on-screen buttons: tap buttons fire once; hold buttons fire name+'Down' / name+'Up'
    for (const [name, el] of Object.entries(buttons)){
      el.addEventListener('pointerdown', e => { e.preventDefault(); el.classList.add('down'); this.fire(name); });
      ['pointerup', 'pointerleave', 'pointercancel'].forEach(t => el.addEventListener(t, () => el.classList.remove('down')));
    }
    for (const [name, el] of Object.entries(holds)){
      let on = false;
      el.addEventListener('pointerdown', e => { e.preventDefault(); el.setPointerCapture(e.pointerId); el.classList.add('down'); on = true; this.fire(name + 'Down'); });
      const end = () => { if (!on) return; on = false; el.classList.remove('down'); this.fire(name + 'Up'); };
      el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end); el.addEventListener('lostpointercapture', end);
    }
    const KEYMAP = { Space: 'jump', KeyE: 'bag', KeyV: 'view', KeyF: 'use', KeyX: 'sit', KeyC: 'craft' };
    addEventListener('keydown', e => { if (e.target.closest && e.target.closest('input,textarea')) return; this.keys[e.code] = true; this.onAny();
      if (KEYMAP[e.code] && !e.repeat){ this.fire(KEYMAP[e.code]); if (e.code === 'Space') e.preventDefault(); }
      if (e.code === 'KeyQ' && !e.repeat) this.fire('mineDown');
      if (/^Digit[1-8]$/.test(e.code)) this.fire('slot', +e.code[5] - 1); });
    addEventListener('keyup', e => { this.keys[e.code] = false; if (e.code === 'KeyQ') this.fire('mineUp'); });
    addEventListener('blur', () => { this.keys = {}; this.fire('mineUp'); });
  }
  on(action, fn){ (this.actions[action] = this.actions[action] || []).push(fn); }
  fire(action, arg){ this.onAny(); (this.actions[action] || []).forEach(f => f(arg)); }
  update(){
    const k = this.keys;
    this.move.x = this.stick.x + ((k.KeyD || k.ArrowRight) ? 1 : 0) - ((k.KeyA || k.ArrowLeft) ? 1 : 0);
    this.move.y = this.stick.y + ((k.KeyS || k.ArrowDown) ? 1 : 0) - ((k.KeyW || k.ArrowUp) ? 1 : 0);
    const m = Math.hypot(this.move.x, this.move.y); if (m > 1){ this.move.x /= m; this.move.y /= m; }
  }
  takeLook(){ const l = { ...this.look }; this.look.dx = this.look.dy = this.look.zoom = 0; return l; }
}
