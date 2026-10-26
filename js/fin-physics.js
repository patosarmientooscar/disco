// Física del footer (js/fin.js): matter-js 0.19 desde cdnjs, cargado solo al acercarse al footer.
// Mundo 2D en px del footer (origen arriba a la izquierda): suelo = borde de arriba de la fila inferior,
// paredes = los lados, techo = el top del footer. Las letras son cuerpos estáticos (columnas sacadas de su
// relleno real); la estrella, un cuerpo compuesto de dos rombos cruzados. Paso fijo de 1/60 s.
const SRC = 'https://cdnjs.cloudflare.com/ajax/libs/matter-js/0.19.0/matter.min.js';
const GRAVITY = 1.4;
const STEP = 1000 / 60;
const MAX_STEPS = 4;            // tras un tirón no recupera más de 4 pasos (sin espiral)
const MAX_SPEED = 42;           // px/paso: un lanzamiento muy fuerte no atraviesa las paredes
const WALL = 400;               // grosor de suelo, paredes y techo (fuera de la vista)
const STAR = { restitution: 0.45, friction: 0.3, frictionAir: 0.012, density: 0.0015 };
const STAR_RATIO = 0.704;       // ancho / alto de la estrella (2.0 / 2.84, como el modelo y el logo)
const WAIST = 0.34;             // grosor de cada rombo respecto a su largo
const HIT = 3;                  // px/paso: por encima, la letra golpeada se tambalea
const GRAB = { stiffness: 0.2, damping: 0.1 };
// muestreo de las letras (unidades del SVG del logo)
const COL = 10;
const ROW = 3;

let loading = null;
export function loadMatter() {
  if (window.Matter) return Promise.resolve(window.Matter);
  loading ||= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = SRC;
    s.async = true;
    s.onload = () => resolve(window.Matter);
    s.onerror = reject;
    document.head.append(s);
  });
  return loading;
}

// Relleno de cada letra por columnas: tramos [y0, y1] en unidades del SVG. Se calcula una vez (no depende
// del tamaño en pantalla). El hueco de la estrella (slot) se recorta: la estrella tiene que poder entrar.
export function sampleLetters(svg, letters, slot) {
  const pt = svg.createSVGPoint();
  const s = slot.getBBox();
  const inSlot = (x, y) => x > s.x - 2 && x < s.x + s.width + 2 && y > s.y - 2 && y < s.y + s.height + 2;
  return letters.map((el) => {
    const b = el.getBBox();
    const n = Math.max(2, Math.round(b.width / COL));
    const w = b.width / n;
    const cols = [];
    for (let c = 0; c < n; c++) {
      pt.x = b.x + w * (c + 0.5);
      const runs = [];
      let run = null;
      for (let y = b.y; y <= b.y + b.height + ROW; y += ROW) {
        pt.y = y;
        const fill = !inSlot(pt.x, y) && el.isPointInFill(pt);
        if (fill) {
          if (!run) run = [y, y];
          run[1] = y;
        } else if (run) {
          runs.push(run);
          run = null;
        }
      }
      if (run) runs.push(run);
      if (runs.length) cols.push({ x0: b.x + w * c, x1: b.x + w * (c + 1), runs });
    }
    return cols;
  });
}

export function createWorld(Matter, { onHit }) {
  const { Engine, Bodies, Body, Composite, Constraint, Events, Sleeping } = Matter;
  const engine = Engine.create({ enableSleeping: true, gravity: { x: 0, y: GRAVITY } });
  let statics = [];
  let star = null;
  let grab = null;
  let acc = 0;
  let box = { w: 1, floor: 1 };

  Events.on(engine, 'collisionStart', (e) => {
    if (!star) return;
    e.pairs.forEach(({ bodyA, bodyB }) => {
      const a = bodyA.parent;
      const b = bodyB.parent;
      const other = a === star ? b : b === star ? a : null;
      if (other && other.letter != null && star.speed > HIT) onHit(other.letter, star.speed);
    });
  });

  // la estrella siempre dentro: si un golpe la saca (o el resize la deja fuera), vuelve dentro y quieta
  // (margen 0.6 × radio: por debajo de lo que permite la forma, así solo actúa si se ha colado)
  const keepInside = () => {
    const m = (star.h / 2) * 0.6;
    const { x: px, y: py } = star.position;
    const x = Math.min(box.w - m, Math.max(m, px));
    const y = Math.min(box.floor - m, Math.max(m, py));
    if (x === px && y === py) return;
    Body.setPosition(star, { x, y });
    Body.setVelocity(star, { x: x === px ? star.velocity.x : 0, y: y === py ? star.velocity.y : 0 });
  };

  return {
    // escena: ancho, suelo y las columnas de las letras en px ({ x, y, w, h, letter })
    setScene({ w, floor, rects }) {
      box = { w, floor };
      Composite.remove(engine.world, statics);
      const wall = { isStatic: true, friction: 0.4, restitution: 0.2 };
      statics = [
        Bodies.rectangle(w / 2, floor + WALL / 2, w + WALL * 2, WALL, wall),
        Bodies.rectangle(-WALL / 2, floor / 2, WALL, floor * 3, wall),
        Bodies.rectangle(w + WALL / 2, floor / 2, WALL, floor * 3, wall),
        Bodies.rectangle(w / 2, -WALL / 2, w + WALL * 2, WALL, wall),
        ...rects.map((r) => {
          const b = Bodies.rectangle(r.x, r.y, r.w, r.h, { isStatic: true, friction: 0.5, restitution: 0.25 });
          b.letter = r.letter;
          return b;
        }),
      ];
      Composite.add(engine.world, statics);
      if (star) { Sleeping.set(star, false); keepInside(); }
    },
    // estrella de alto h (px) en x, y; velocidad inicial y giro (rad/s)
    addStar({ x, y, h, vx = 0, vy = 0, spin = 0 }) {
      this.removeStar();
      const w = h * STAR_RATIO;
      const tall = Bodies.fromVertices(0, 0, [[{ x: 0, y: -h / 2 }, { x: (w * WAIST) / 2, y: 0 }, { x: 0, y: h / 2 }, { x: (-w * WAIST) / 2, y: 0 }]]);
      const wide = Bodies.fromVertices(0, 0, [[{ x: -w / 2, y: 0 }, { x: 0, y: (-h * WAIST) / 2 }, { x: w / 2, y: 0 }, { x: 0, y: (h * WAIST) / 2 }]]);
      Body.setPosition(tall, { x: 0, y: 0 });
      Body.setPosition(wide, { x: 0, y: 0 });
      star = Body.create({ parts: [tall, wide], ...STAR });
      star.h = h;
      Body.setPosition(star, { x, y });
      Body.setVelocity(star, { x: vx, y: vy });
      Body.setAngularVelocity(star, spin / 60);
      Composite.add(engine.world, star);
      keepInside();
      acc = 0;
      return star;
    },
    removeStar() {
      this.drop();
      if (star) Composite.remove(engine.world, star);
      star = null;
    },
    get star() { return star; },
    get dragging() { return !!grab; },
    // coger: solo si el puntero está sobre la estrella (distancia al centro < radio)
    grabAt(x, y) {
      if (!star || Math.hypot(x - star.position.x, y - star.position.y) > star.h * 0.45) return false;
      Sleeping.set(star, false);
      grab = Constraint.create({
        pointA: { x, y },
        bodyB: star,
        pointB: { x: x - star.position.x, y: y - star.position.y },
        length: 0,
        ...GRAB,
      });
      Composite.add(engine.world, grab);
      return true;
    },
    drag(x, y) { if (grab) { grab.pointA.x = x; grab.pointA.y = y; Sleeping.set(star, false); } },
    // al soltar conserva la velocidad: se puede lanzar
    drop() {
      if (grab) Composite.remove(engine.world, grab);
      grab = null;
    },
    step(ms) {
      if (!star) return;
      acc = Math.min(acc + ms, STEP * MAX_STEPS);
      while (acc >= STEP) {
        Engine.update(engine, STEP);
        acc -= STEP;
        if (star.speed > MAX_SPEED) Body.setVelocity(star, { x: (star.velocity.x / star.speed) * MAX_SPEED, y: (star.velocity.y / star.speed) * MAX_SPEED });
        keepInside();
      }
    },
  };
}
