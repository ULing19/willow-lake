import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Water } from 'three/addons/objects/Water.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const TAU = Math.PI * 2;
let seed = 82314;
const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const range = (a, b) => a + random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const hash = (x, z) => { const n = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return n - Math.floor(n); };
function noise(x, z) {
  const ix = Math.floor(x), iz = Math.floor(z), fx = x - ix, fz = z - iz;
  const u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz);
  return THREE.MathUtils.lerp(THREE.MathUtils.lerp(hash(ix, iz), hash(ix + 1, iz), u), THREE.MathUtils.lerp(hash(ix, iz + 1), hash(ix + 1, iz + 1), u), v);
}
const islands = [{ x: 9, z: -5, rx: 15, rz: 10, h: 9.2 }, { x: -25, z: -25, rx: 9, rz: 8, h: 7.5 }, { x: 34, z: 15, rx: 8, rz: 6, h: 6.3 }];
export function lakeDistance(x, z) {
  const angle = Math.atan2((z + 3) / 44, (x - 1) / 65);
  return Math.hypot((x - 1) / 65, (z + 3) / 44) + Math.sin(angle * 5 + .8) * .045 + Math.cos(angle * 3) * .036;
}
export function heightAt(x, z) {
  const q = lakeDistance(x, z);
  const n = noise(x * .038, z * .038) * 2 + noise(x * .11, z * .11) * .65;
  let h = -3.6 + smooth(.84, 1.23, q) * (7.8 + n);
  h += smooth(1.25, 2.9, q) * (noise(x * .018 + 31, z * .021 + 65) * 30 + noise(x * .046, z * .05) * 12);
  h += smooth(95, 220, -z) * (noise(x * .015, z * .014) * 52 + 12);
  h += smooth(140, 280, Math.abs(x)) * noise(x * .025 + 5, z * .02) * 27;
  for (const island of islands) {
    const d = ((x - island.x) / island.rx) ** 2 + ((z - island.z) / island.rz) ** 2;
    h = Math.max(h, -3.7 + island.h * Math.exp(-d * 1.45) + noise(x * .35, z * .35) * .3);
  }
  return h;
}

function standard(color, opts = {}) { return new THREE.MeshStandardMaterial({ color, roughness: .93, ...opts }); }
const materials = {
  wood: standard('#806446'), darkWood: standard('#544839'), cutWood: standard('#b29a70'), roof: standard('#39483d', { roughness: .87 }),
  stone: standard('#898a76'), stoneDark: standard('#646b58'), plaster: standard('#beb597'), metal: standard('#424e43'), moss: standard('#657651'),
  glass: standard('#d4b271', { emissive: '#db9945', emissiveIntensity: .32, roughness: .32 }), black: standard('#303c34'), deer: standard('#ab7950'),
  leaf: standard('#586d3d'), green: standard('#71814f'), orange: standard('#a96c3b'), reed: standard('#a3995d'), cream: standard('#d0c5a0')
};
function mesh(geometry, material, parent, x = 0, y = 0, z = 0, shadow = true) {
  const object = new THREE.Mesh(geometry, material); object.position.set(x, y, z); object.castShadow = shadow; object.receiveShadow = true; parent.add(object); return object;
}
function box(parent, size, position, material, rotation) {
  const object = mesh(new THREE.BoxGeometry(...size), material, parent, ...position);
  if (rotation) object.rotation.set(...rotation); return object;
}
function beam(parent, from, to, radius, material = materials.wood, sides = 6) {
  const a = new THREE.Vector3(...from), b = new THREE.Vector3(...to), vector = b.clone().sub(a);
  const object = mesh(new THREE.CylinderGeometry(radius * .82, radius, vector.length(), sides), material, parent);
  object.position.copy(a).add(b).multiplyScalar(.5); object.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), vector.normalize()); return object;
}
function stone(parent, x, y, z, sx, sy, sz, material = materials.stone) {
  const object = mesh(new THREE.IcosahedronGeometry(1, 1), material, parent, x, y, z); object.scale.set(sx, sy, sz); object.rotation.set(range(0, .4), range(0, TAU), range(0, .3)); return object;
}
function radialTexture(size = 128, haze = false) {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = size; const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, haze ? 'rgba(241,239,219,.2)' : 'rgba(255,255,245,1)');
  gradient.addColorStop(.25, haze ? 'rgba(241,239,219,.12)' : 'rgba(255,255,245,.6)');
  gradient.addColorStop(1, 'rgba(255,255,245,0)'); ctx.fillStyle = gradient; ctx.fillRect(0, 0, size, size); return new THREE.CanvasTexture(canvas);
}

function createCabin(scene) {
  const group = new THREE.Group(); group.position.set(-49, heightAt(-49, 31) + .15, 31); group.rotation.y = .22; scene.add(group);
  box(group, [10.5, .8, 10], [0, .3, 0], materials.stoneDark);
  for (let row = 0; row < 4; row++) for (let col = 0; col < 8; col++) {
    if (row < 2) box(group, [1.23, .35, .3], [col * 1.29 - 4.55 + (row % 2) * .14, .2 + row * .28, 5.07], row % 2 ? materials.stoneDark : materials.stone);
  }
  box(group, [10, 5.7, 9], [0, 3.6, 0], materials.wood);
  for (let row = 0; row < 20; row++) {
    const y = 1.02 + row * .273;
    box(group, [10.15, .21, .17], [0, y, 4.55], row % 4 ? materials.wood : materials.cutWood);
    box(group, [.17, .21, 9.15], [5.03, y, 0], row % 6 ? materials.wood : materials.darkWood);
    box(group, [.17, .21, 9.15], [-5.03, y, 0], row % 6 ? materials.wood : materials.darkWood);
  }
  const gableShape = new THREE.Shape(); gableShape.moveTo(-5, 0); gableShape.lineTo(5, 0); gableShape.lineTo(0, 5.6); gableShape.closePath();
  const gableGeo = new THREE.ExtrudeGeometry(gableShape, { depth: 9, bevelEnabled: false }); mesh(gableGeo, materials.darkWood, group, 0, 6.45, -4.5);
  const slope = Math.atan2(5.9, 5.9);
  for (const side of [-1, 1]) {
    box(group, [8.35, .27, 11.4], [side * 2.94, 9.28, .0], materials.roof, [0, 0, side * -slope]);
    for (let i = 0; i < 19; i++) box(group, [8.5, .1, .075], [side * 2.94, 9.43, -5.48 + i * .61], materials.metal, [0, 0, side * -slope]);
    beam(group, [0, 12.26, 5.85], [side * 6.13, 6.15, 5.85], .15, materials.cutWood);
  }
  beam(group, [0, 12.26, -5.8], [0, 12.26, 5.9], .14, materials.metal);
  box(group, [1.9, 3.7, .2], [0, 2.85, 4.68], materials.darkWood);
  box(group, [1.5, 3.2, .24], [0, 2.65, 4.8], materials.cutWood);
  for (let i = 0; i < 5; i++) box(group, [.045, 3.1, .04], [-.57 + i * .29, 2.64, 4.95], materials.darkWood);
  mesh(new THREE.SphereGeometry(.09, 6, 6), materials.metal, group, .48, 2.8, 5.03);
  function windowAt(x, y, z, rotate = false) {
    const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = rotate ? Math.PI / 2 : 0; group.add(g);
    box(g, [2.1, 2.12, .16], [0, 0, 0], materials.darkWood);
    box(g, [1.67, 1.72, .2], [0, 0, .1], materials.glass);
    box(g, [.12, 1.87, .12], [0, 0, .28], materials.cutWood); box(g, [1.8, .12, .12], [0, 0, .28], materials.cutWood);
    box(g, [2.35, .18, .48], [0, -1.13, .15], materials.darkWood);
    for (const side of [-1, 1]) box(g, [.53, 2.1, .12], [side * 1.4, 0, 0], materials.roof, [0, side * -.3, 0]);
  }
  windowAt(-3.12, 3.9, 4.68); windowAt(3.12, 3.9, 4.68); windowAt(5.12, 3.9, -.4, true);
  box(group, [1.3, 1.5, .15], [0, 8, 4.62], materials.glass);
  box(group, [.12, 1.6, .17], [0, 8, 4.75], materials.darkWood); box(group, [1.4, .12, .17], [0, 8, 4.75], materials.darkWood);
  for (let i = 0; i < 18; i++) box(group, [.56, .22, 3.75], [-5.02 + i * .59, .94, 6.4], materials.cutWood);
  for (const x of [-5.1, 5.1]) {
    for (const z of [4.8, 8]) { box(group, [.21, 3, .21], [x, 2.3, z], materials.darkWood); box(group, [.4, .1, .4], [x, 3.87, z], materials.cutWood); }
    box(group, [.14, .14, 3.5], [x, 3.3, 6.5], materials.cutWood);
    for (let j = 0; j < 7; j++) box(group, [.08, 2.15, .08], [x, 2.2, 5 + j * .47], materials.cutWood);
  }
  for (let i = 0; i < 3; i++) box(group, [2.6, .3, .65], [0, .78 - i * .26, 8.6 + i * .58], materials.cutWood);
  box(group, [1.24, 5.3, 1.25], [3.1, 9, -2.55], materials.stoneDark);
  for (let i = 0; i < 9; i++) box(group, [1.35, .09, 1.35], [3.1, 7 + i * .54, -2.55], materials.stone);
  box(group, [1.8, .19, 1.8], [3.1, 11.8, -2.55], materials.stoneDark);
  for (let i = 0; i < 7; i++) {
    const log = mesh(new THREE.CylinderGeometry(.26, .29, 2.25, 8), materials.darkWood, group, -5.56 - (i % 2) * .45, 1 + Math.floor(i / 2) * .44, 2.4);
    log.rotation.x = Math.PI / 2; mesh(new THREE.CircleGeometry(.23, 8), materials.cutWood, group, log.position.x, log.position.y, 3.54);
  }
  function chair(x, z, rot) {
    const g = new THREE.Group(); group.add(g); g.position.set(x, 1.12, z); g.rotation.y = rot;
    box(g, [1.1, .11, 1.05], [0, .64, 0], materials.darkWood);
    for (const xx of [-.45, .45]) for (const zz of [-.4, .4]) box(g, [.12, .75, .12], [xx, .31, zz], materials.cutWood, [0, 0, xx * .2]);
    for (let i = 0; i < 5; i++) box(g, [.18, 1.1, .12], [-.42 + i * .21, 1.2, -.45], materials.cutWood, [-.18, 0, 0]);
  }
  chair(-3.15, 6.25, .25); chair(-1.65, 6.2, -.2);
  const table = mesh(new THREE.CylinderGeometry(.55, .55, .12, 12), materials.cutWood, group, -2.45, 1.9, 7.15);
  beam(group, [-2.45, 1, 7.15], [-2.45, 1.88, 7.15], .12);
  mesh(new THREE.CylinderGeometry(.09, .08, .16, 10), materials.cream, group, -2.4, 2.04, 7.15);
  for (const x of [-3, 3]) { box(group, [1.25, .6, .65], [x, 1.2, 8], materials.darkWood); for (let i = 0; i < 8; i++) stone(group, x + range(-.55, .55), 1.65, 8 + range(-.25, .25), .26, .36, .25, materials.leaf); }
  return { group, chimney: new THREE.Vector3(3.1, 12.2, -2.55).applyMatrix4(group.updateWorldMatrix(true, false) || group.matrixWorld) };
}

function createRuins(scene) {
  const group = new THREE.Group(); group.position.set(47, heightAt(47, -36), -36); group.rotation.y = -.35; scene.add(group);
  box(group, [10, .45, 8], [0, .2, 0], materials.stoneDark);
  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 9; col++) {
      const x = col * 1.1 - 4.4, y = .8 + row * .48;
      if (!(Math.abs(x) < 1.1 && row < 6) && !(x > 2 && row > 5)) box(group, [1.04, .43, .62], [x + (row % 2) * .16, y, 3.6], row % 3 ? materials.stone : materials.stoneDark);
      if (row < 5 || col < 4) box(group, [1.04, .43, .62], [x + (row % 2) * .16, y, -3.6], materials.stoneDark);
    }
    for (let col = 0; col < 7; col++) {
      if (row > 6 && col > 3) continue;
      if (!(col > 2 && col < 5 && row > 2 && row < 7)) box(group, [.65, .43, 1], [-4.8, .8 + row * .48, col * 1.03 - 3.1], materials.stone);
      if (row < 4 || col < 3) box(group, [.65, .43, 1], [4.8, .8 + row * .48, col * 1.03 - 3.1], materials.stoneDark);
    }
  }
  for (let i = 0; i < 4; i++) {
    const z = -3.35 + i * 1.7;
    beam(group, [-5.2, 4.85, z], [0, 8.2, z], .15, materials.darkWood); beam(group, [0, 8.2, z], [5.2, 4.85, z], .15, materials.darkWood);
    beam(group, [-4.9, 4.8, z], [4.9, 4.8, z], .13, materials.darkWood);
  }
  for (let i = 0; i < 10; i++) box(group, [5.8, .16, .49], [-2.6, 6.58, -3.5 + i * .52], materials.roof, [0, 0, .58]);
  box(group, [.9, 7.4, 1.2], [-3.3, 4.2, -2.6], materials.stoneDark);
  for (let i = 0; i < 24; i++) stone(group, range(-6.3, 6.3), range(.4, .7), range(-4.5, 5), range(.25, .8), range(.3, .55), range(.3, .9), random() > .4 ? materials.stone : materials.moss);
  for (let i = 0; i < 23; i++) stone(group, -4.97 + range(-.2, .3), range(.7, 4.5), range(-3.2, 3.1), .22, .4, .6, materials.moss);
  box(group, [1.75, .11, .8], [.15, .7, 4.7], materials.darkWood, [.1, .1, .13]);
  return group;
}

function createDock(scene) {
  const dock = new THREE.Group(); scene.add(dock); dock.position.set(-36.7, 1.12, 26.5); dock.rotation.y = -.52;
  for (let i = 0; i < 23; i++) box(dock, [3.25, .16, .44], [0, 0, -5.2 + i * .47], i % 6 ? materials.cutWood : materials.wood);
  for (const x of [-1.32, 1.32]) {
    box(dock, [.2, .28, 11.2], [x, -.25, 0], materials.darkWood);
    for (const z of [-4.7, 0, 4.7]) { beam(dock, [x, -3, z], [x, .68, z], .16, materials.darkWood); mesh(new THREE.CylinderGeometry(.19, .19, .09, 8), materials.cutWood, dock, x, .73, z); }
  }
  const shore=new THREE.Vector3(-44,Math.max(1.12,heightAt(-44,35)+.16),35),landing=new THREE.Vector3(-39.38,1.12,31.19);
  const walkwayDirection=landing.clone().sub(shore),walkwayAngle=Math.atan2(walkwayDirection.x,walkwayDirection.z);
  for(let i=0;i<16;i++){
    const point=shore.clone().lerp(landing,i/15);
    box(scene,[1.6,.16,.41],point.toArray(),i%5?materials.cutWood:materials.wood,[0,walkwayAngle,0]);
    if(i%5===0)beam(scene,[point.x,point.y-2.5,point.z],[point.x,point.y-.05,point.z],.13,materials.darkWood);
  }
  const boat = new THREE.Group(); boat.position.set(-28.2, .55, 23.5); boat.rotation.y = .2; scene.add(boat);
  const verts = [], inds = [], sections = 17;
  for (let i = 0; i <= sections; i++) {
    const z = -3.45 + i / sections * 6.9, w = Math.sin(i / sections * Math.PI) ** .64 * 1.22 + .03;
    for (const [px, py] of [[-w, .58], [-w * .65, -.08], [0, -.31], [w * .65, -.08], [w, .58]]) verts.push(px, py + Math.abs(z / 3.45) ** 4 * .48, z);
    if (i < sections) for (let j = 0; j < 4; j++) { const a = i * 5 + j; inds.push(a, a + 5, a + 1, a + 1, a + 5, a + 6); }
  }
  const hull = new THREE.BufferGeometry(); hull.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3)); hull.setIndex(inds); hull.computeVertexNormals();
  mesh(hull, standard('#976b43', { side: THREE.DoubleSide }), boat);
  for (const side of [-1, 1]) {
    const points = [];
    for (let i = 0; i <= sections; i++) { const z = -3.45 + i / sections * 6.9; points.push(new THREE.Vector3(side * (Math.sin(i / sections * Math.PI) ** .64 * 1.22 + .03), .61 + Math.abs(z / 3.45) ** 4 * .48, z)); }
    mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 32, .075, 5, false), materials.cutWood, boat);
  }
  for (const z of [-1.3, 1.2]) box(boat, [1.93, .15, .52], [0, .38, z], materials.cutWood);
  beam(boat, [-1.55, .8, -.7], [1.85, .8, 1.5], .065, materials.cutWood);
  box(boat, [.5, .075, 1.08], [1.84, .8, 1.5], materials.cutWood, [0, -.97, 0]);
  const ropePoints = [new THREE.Vector3(-.6, .7, -3.1), new THREE.Vector3(-2.2, .2, -3.5), new THREE.Vector3(-4.7, .72, -2.5)];
  mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(ropePoints), 16, .026, 4, false), materials.cream, boat);
  return boat;
}

function pineGeometry() {
  const geos = [];
  function addFoliage(g, light) {
    const pos = g.attributes.position, colors = [];
    for (let v = 0; v < pos.count; v++) { const c = new THREE.Color().setHSL(.307 + range(-.018, .012), .31 + range(-.04, .04), light + range(-.02, .025)); colors.push(c.r, c.g, c.b); }
    g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3)); geos.push(g);
  }
  for (let i = 0; i < 9; i++) {
    const t = i / 9, r = (.23 * (1 - t) + .013) * range(.88, 1.1), h = .27 - t * .095;
    const g = new THREE.ConeGeometry(r, h, 10, 1); g.rotateY(i * .51); g.translate(range(-.01, .01), .31 + t * .66, range(-.01, .01));
    addFoliage(g,.165+t*.045);
    if(i>7)continue;
    for(let j=0;j<7;j++){
      const a=j/7*TAU+i*.79, length=r*range(.55,.9);
      const branch=new THREE.ConeGeometry(r*.34,length,5,1);
      branch.rotateZ(Math.PI*.36);branch.rotateY(a);
      branch.translate(Math.cos(a)*r*.65,.24+t*.68+range(-.014,.015),-Math.sin(a)*r*.65);
      addFoliage(branch,.18+t*.04);
    }
  }
  return mergeGeometries(geos);
}
const trailPoints = [[-51, 42], [-65, 22], [-70, -7], [-61, -29], [-38, -49], [-12, -53], [16, -50], [40, -45], [62, -26], [70, -1], [66, 22], [53, 39], [27, 49], [0, 51], [-26, 46], [-51, 42]];
const trailCurve = new THREE.CatmullRomCurve3(trailPoints.map(([x, z]) => new THREE.Vector3(x, 0, z)), true, 'catmullrom', .3);
const pathSamples = Array.from({ length: 230 }, (_, i) => trailCurve.getPoint(i / 229));
function nearPath(x, z, distance = 3.2) { return pathSamples.some(p => (p.x - x) ** 2 + (p.z - z) ** 2 < distance ** 2); }
function isBuilding(x, z) { return Math.hypot(x + 49, z - 31) < 14 || Math.hypot(x - 47, z + 36) < 12 || Math.hypot(x - 59, z - 31) < 10; }
function blocksView(x,z){
  const corridors=[[-8,77,-46,30,12],[89,5,47,-36,11],[53,49,9,-5,10],[101,73,59,30,11]];
  return corridors.some(([sx,sz,tx,tz,width])=>{const dx=tx-sx,dz=tz-sz,t=((x-sx)*dx+(z-sz)*dz)/(dx*dx+dz*dz);return t>-.1&&t<1&&Math.hypot(x-sx-dx*t,z-sz-dz*t)<width;});
}

function populateForest(scene, mobile) {
  const positions = []; const targetCount = mobile ? 1050 : 1850;
  for (let i = 0; i < 22000 && positions.length < targetCount; i++) {
    const x = range(-245, 245), z = range(-250, 160), y = heightAt(x, z), q = lakeDistance(x, z);
    if (y < 1.05 || isBuilding(x, z) || nearPath(x, z, 2.8) || blocksView(x,z)) continue;
    if (q < 1.1 && random() < .4 || q > 3.5 && random() < .32) continue;
    if (z > 40 && x > -90 && x < 100 && random() < .86) continue;
    positions.push({ x, y, z, h: range(9, 21) * (q > 2 ? 1.1 : 1), r: range(.8, 1.15), angle: range(0, TAU), broad: random() < .13 && q < 2.4 });
  }
  const pines = positions.filter(p => !p.broad), broad = positions.filter(p => p.broad);
  const pine = new THREE.InstancedMesh(pineGeometry(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }), pines.length);
  const trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(.024, .044, 1, 6).translate(0, .5, 0), materials.darkWood, positions.length);
  pine.castShadow = pine.receiveShadow = true; trunks.castShadow = true; trunks.receiveShadow = true; scene.add(pine, trunks);
  const dummy = new THREE.Object3D(), color = new THREE.Color();
  pines.forEach((p, i) => { dummy.position.set(p.x, p.y, p.z); dummy.rotation.set(0, p.angle, range(-.035, .035)); dummy.scale.set(p.h * p.r, p.h, p.h * p.r); dummy.updateMatrix(); pine.setMatrixAt(i, dummy.matrix); color.setHSL(range(.25, .32), range(.04, .14), range(.73, .93)); pine.setColorAt(i, color); });
  positions.forEach((p, i) => { dummy.position.set(p.x, p.y, p.z); dummy.rotation.set(0, p.angle, 0); dummy.scale.set(p.h, p.h * (p.broad ? .65 : .9), p.h); dummy.updateMatrix(); trunks.setMatrixAt(i, dummy.matrix); });
  const leafGeo = new THREE.IcosahedronGeometry(1, 2);
  const leaves = new THREE.InstancedMesh(leafGeo, standard('#7d9159', { flatShading: true }), broad.length * 5);
  leaves.castShadow = leaves.receiveShadow = true; scene.add(leaves);
  broad.forEach((p, i) => { for (let j = 0; j < 5; j++) { dummy.position.set(p.x + Math.sin(j * 2.4) * p.h * .16, p.y + p.h * (.48 + j * .07), p.z + Math.cos(j * 2.4) * p.h * .15); dummy.rotation.set(range(0, 1), range(0, 3), range(0, 1)); dummy.scale.set(p.h * range(.13, .2), p.h * .17, p.h * range(.14, .2)); dummy.updateMatrix(); leaves.setMatrixAt(i * 5 + j, dummy.matrix); color.setHSL(range(.22, .29), range(.18, .35), range(.4, .58)); leaves.setColorAt(i * 5 + j, color); } });
  // A small grove makes the principal island readable from across the lake.
  const islandPine = new THREE.InstancedMesh(pine.geometry, pine.material, 14); scene.add(islandPine); islandPine.castShadow = islandPine.receiveShadow = true;
  for (let i = 0; i < 14; i++) { const angle = i * 2.4, r = i < 3 ? 1.3 : range(2, 8), x = 9 + Math.sin(angle) * r, z = -5 + Math.cos(angle) * r * .58; const h = range(9, 15); dummy.position.set(x, Math.max(.8, heightAt(x, z)), z); dummy.rotation.set(0, angle, 0); dummy.scale.set(h * .8, h, h * .8); dummy.updateMatrix(); islandPine.setMatrixAt(i, dummy.matrix); }
  return { positions, pine };
}

function createTerrain(scene) {
  const geo = new THREE.PlaneGeometry(760, 760, 300, 300); geo.rotateX(-Math.PI / 2);
  const p = geo.attributes.position, colors = [], grass = new THREE.Color('#8e9862'), sand = new THREE.Color('#b4ac83'), rock = new THREE.Color('#858b75'), darkGrass = new THREE.Color('#5e754d');
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i), h = heightAt(x, z); p.setY(i, h);
    const n = noise(x * .24, z * .24); let color = grass.clone().lerp(darkGrass, noise(x * .037 + 80, z * .037) * .76);
    if (h < 2.3) color.lerp(sand, 1 - smooth(-1, 3.1, h));
    if (h > 24) color.lerp(rock, smooth(24, 65, h) * .82);
    color.multiplyScalar(.91 + n * .17); colors.push(color.r, color.g, color.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3)); geo.computeVertexNormals();
  const terrain = mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 }), scene, 0, 0, 0, false);
  terrain.receiveShadow = true;
  const verts = [], indices = [], pathColor = [];
  for (let i = 0; i <= 400; i++) {
    const t = i / 400, point = trailCurve.getPoint(t), tangent = trailCurve.getTangent(t), normal = new THREE.Vector3(-tangent.z, 0, tangent.x);
    const width = 1.05 + Math.sin(t * 33) * .18;
    for (const side of [-1, 1]) { const x = point.x + normal.x * width * side, z = point.z + normal.z * width * side; verts.push(x, heightAt(x, z) + .075, z); const c = new THREE.Color('#b1a47b').multiplyScalar(range(.93, 1.08)); pathColor.push(c.r, c.g, c.b); }
    if (i < 400) { const k = i * 2; indices.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); }
  }
  const trailGeo = new THREE.BufferGeometry(); trailGeo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3)); trailGeo.setAttribute('color', new THREE.Float32BufferAttribute(pathColor, 3)); trailGeo.setIndex(indices); trailGeo.computeVertexNormals();
  mesh(trailGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, side: THREE.DoubleSide }), scene, 0, 0, 0, false);
  return terrain;
}

function scatterDetails(scene, mobile) {
  const dummy = new THREE.Object3D(), color = new THREE.Color();
  const rockPoints = [];
  for (let i = 0; i < 1200; i++) { const x = range(-120, 120), z = range(-100, 95), y = heightAt(x, z); if (y < -.45 || isBuilding(x, z) || nearPath(x, z, 1.2)) continue; const size = range(.25, 1.35) * (y < 2 ? 1.4 : 1); rockPoints.push({ x, y, z, size }); }
  const rocks = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), standard('#92947c'), rockPoints.length); rocks.castShadow = rocks.receiveShadow = true; scene.add(rocks);
  rockPoints.forEach((p, i) => { dummy.position.set(p.x, p.y + p.size * .15, p.z); dummy.rotation.set(range(0, 3), range(0, 6), range(0, 1)); dummy.scale.set(p.size, p.size * range(.4, .8), p.size * range(.8, 1.8)); dummy.updateMatrix(); rocks.setMatrixAt(i, dummy.matrix); color.setHSL(range(.15, .2), range(.06, .16), range(.37, .56)); rocks.setColorAt(i, color); });
  const grassGeo = new THREE.BufferGeometry();
  grassGeo.setAttribute('position', new THREE.Float32BufferAttribute([-.11,0,0, .12,0,0, .06,.85,0, -.06,0,-.1, .06,0,.12, -.04,.62,.06],3)); grassGeo.computeVertexNormals();
  const count = mobile ? 10000 : 23000, blades = new THREE.InstancedMesh(grassGeo, standard('#809353', { side: THREE.DoubleSide }), count); let filled = 0;
  for (let i = 0; i < count * 6 && filled < count; i++) {
    const x = range(-111, 110), z = range(-90, 82), y = heightAt(x, z); if (y < 1 || y > 17 || isBuilding(x, z) || nearPath(x, z, 1.2)) continue;
    dummy.position.set(x, y, z); dummy.rotation.set(0, range(0, TAU), range(-.15, .15)); dummy.scale.setScalar(range(.35, 1.1)); dummy.updateMatrix(); blades.setMatrixAt(filled, dummy.matrix); color.setHSL(range(.18,.25), range(.23,.36), range(.28,.52)); blades.setColorAt(filled, color); filled++;
  }
  blades.count = filled; blades.receiveShadow = true; scene.add(blades);
  const reeds = new THREE.Group(); scene.add(reeds);
  const reedData = [];
  for (let i = 0; i < 430; i++) { const a = range(0, TAU), r = range(.98,1.09), x = 1 + Math.cos(a) * 65 * r, z = -3 + Math.sin(a) * 44 * r, y = heightAt(x,z); if(y > -.1 && y < 1.25 && !isBuilding(x,z)) reedData.push({x,y,z,h:range(.9,1.7)}); }
  const stems = new THREE.InstancedMesh(new THREE.CylinderGeometry(.025, .037, 1, 4).translate(0,.5,0), materials.reed, reedData.length);
  const heads = new THREE.InstancedMesh(new THREE.CylinderGeometry(.09,.085,.35,5), materials.darkWood, reedData.length);
  reedData.forEach((p,i) => {dummy.position.set(p.x,p.y,p.z); dummy.rotation.set(range(-.08,.08),0,range(-.12,.12)); dummy.scale.set(1,p.h,1); dummy.updateMatrix(); stems.setMatrixAt(i,dummy.matrix);dummy.position.y += p.h;dummy.scale.set(1,1,1);dummy.updateMatrix();heads.setMatrixAt(i,dummy.matrix);});
  reeds.add(stems,heads);
  // Branches, tree stumps and a direction post alongside the trail.
  for(const [x,z] of [[-58,18], [66,22], [26,-52], [-33,49]]) { const y=heightAt(x,z); const log=mesh(new THREE.CylinderGeometry(.65,.78,5.5,9),materials.darkWood,scene,x,y+.65,z);log.rotation.z=1.4;log.rotation.y=.9; }
  const x=58,z=35,y=heightAt(x,z);beam(scene,[x,y,z],[x,y+3,z],.13);box(scene,[2.6,.55,.17],[x,y+2.6,z],materials.cutWood,[0,-.35,0]);box(scene,[2,.5,.17],[x+.2,y+1.9,z],materials.darkWood,[0,.2,.1]);
  const bushData=[];
  for(let i=0;i<650;i++){const x=range(-90,90),z=range(-72,70),y=heightAt(x,z);if(y<1.2||isBuilding(x,z)||nearPath(x,z,1.8))continue;bushData.push({x,y,z,r:range(.5,1.6)});}
  const bushes=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,1),standard('#758343'),bushData.length);bushes.receiveShadow=true;bushes.castShadow=true;scene.add(bushes);
  bushData.forEach((p,i)=>{dummy.position.set(p.x,p.y+p.r*.35,p.z);dummy.scale.set(p.r,p.r*.6,p.r*.8);dummy.rotation.set(0,range(0,6),0);dummy.updateMatrix();bushes.setMatrixAt(i,dummy.matrix);color.setHSL(range(.19,.26),range(.25,.4),range(.29,.44));bushes.setColorAt(i,color);});
}

function createDeer(scene, x, z, scale, antlers = true) {
  const group = new THREE.Group(); group.position.set(x,heightAt(x,z),z);group.scale.setScalar(scale);scene.add(group);
  const body=mesh(new THREE.SphereGeometry(1,10,8),materials.deer,group,0,1.65,0);body.scale.set(.59,.69,1.15);
  const rump=mesh(new THREE.SphereGeometry(.6,9,7),materials.deer,group,0,1.7,-.76);rump.scale.set(.82,1,1);
  const white=mesh(new THREE.SphereGeometry(.4,8,6),materials.cream,group,0,1.75,-1.18);white.scale.set(.8,1,.22);
  const legs=[];
  for(const xx of [-.35,.35]) for(const zz of [-.75,.7]) {const leg=beam(group,[xx,.13,zz],[xx,1.5,zz+.14],.09,materials.deer);legs.push(leg);box(group,[.17,.18,.25],[xx,.1,zz],materials.darkWood);}
  const head=new THREE.Group();group.add(head);head.position.set(0,2.02,.7);head.rotation.x=.1;
  beam(head,[0,-.4,0],[0,1.02,.46],.27,materials.deer,8);
  const face=mesh(new THREE.SphereGeometry(.38,9,7),materials.deer,head,0,1.04,.67);face.scale.set(.72,1,1.3);
  const nose=mesh(new THREE.SphereGeometry(.14,8,6),materials.darkWood,head,0,.99,1.07);nose.scale.set(1,.7,1);
  for(const s of [-1,1]){const ear=mesh(new THREE.SphereGeometry(.19,7,6),materials.deer,head,s*.3,1.29,.51);ear.scale.set(.65,2.1,.45);ear.rotation.z=-s*.55;mesh(new THREE.SphereGeometry(.042,6,5),materials.black,head,s*.24,1.11,.83);}
  if(antlers)for(const s of [-1,1]){beam(head,[s*.14,1.29,.48],[s*.44,2.12,.21],.041,materials.cutWood);beam(head,[s*.36,1.9,.26],[s*.78,2.23,.4],.03,materials.cutWood);beam(head,[s*.32,1.77,.29],[s*.64,1.98,.65],.029,materials.cutWood);beam(head,[s*.44,2.12,.21],[s*.52,2.36,.46],.028,materials.cutWood);}
  return {group,head,legs,x,z};
}

function createWildlife(scene) {
  const deer=[createDeer(scene,57,28,1.12,true),createDeer(scene,62,31,.87,false),createDeer(scene,59,35,.62,false)];deer.forEach((d,i)=>d.group.rotation.y=-.9+i*.65);
  const birds=[];
  for(let i=0;i<12;i++){
    const group=new THREE.Group();scene.add(group);const body=mesh(new THREE.SphereGeometry(.17,6,5),materials.black,group);body.scale.set(.6,.7,2);
    const wings=[];for(const side of [-1,1]){const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute([0,0,0,side*1.25,.13,-.12,side*.5,0,.4],3));geometry.computeVertexNormals();const wing=mesh(geometry,standard('#424e45',{side:THREE.DoubleSide}),group);wings.push(wing);}birds.push({group,wings,phase:i*.68,radius:range(24,48),height:range(23,36),speed:range(.045,.075)});
  }
  const ducks=[];
  for(let i=0;i<5;i++){
    const group=new THREE.Group();scene.add(group);const body=mesh(new THREE.SphereGeometry(.35,9,7),i%2?materials.wood:materials.cream,group,0,.14,0);body.scale.set(.75,.75,1.5);
    mesh(new THREE.SphereGeometry(.21,8,6),i%2?materials.deer:materials.roof,group,0,.51,.34);box(group,[.15,.065,.25],[0,.5,.57],materials.orange);
    const wake=mesh(new THREE.RingGeometry(.55,.59,30),new THREE.MeshBasicMaterial({color:'#b9c5a1',transparent:true,opacity:.18,side:THREE.DoubleSide}),group,0,-.1,-.35,false);wake.rotation.x=-Math.PI/2;wake.scale.set(1,1.9,1);ducks.push({group,phase:i*.4});
  }
  return {deer,birds,ducks};
}

function waterNormals() {
  const size=256, data=new Uint8Array(size*size*4);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const i=(y*size+x)*4;
    data[i]=128+Math.round(24*Math.sin(x*.4+y*.15)+13*Math.sin(y*.7-x*.2));
    data[i+1]=128+Math.round(24*Math.cos(y*.35+x*.12)+12*Math.cos(x*.65-y*.2)); data[i+2]=238;data[i+3]=255;
  }
  const texture=new THREE.DataTexture(data,size,size);texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.needsUpdate=true;return texture;
}

export function createWorld(container) {
  const mobile=window.matchMedia('(max-width: 760px)').matches;
  const scene=new THREE.Scene();scene.fog=new THREE.Fog('#e4e8d7',135,390);scene.background=new THREE.Color('#e5e8d7');
  const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance',preserveDrawingBuffer:true});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, mobile?1.5:1.65));renderer.setSize(innerWidth,innerHeight);
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.04;renderer.outputColorSpace=THREE.SRGBColorSpace;
  container.appendChild(renderer.domElement);
  const camera=new THREE.PerspectiveCamera(40,innerWidth/innerHeight,.5,1500);camera.position.set(113,92,156);
  const controls=new OrbitControls(camera,renderer.domElement);controls.target.set(0,3,-5);controls.enableDamping=true;controls.dampingFactor=.055;controls.minDistance=17;controls.maxDistance=255;controls.maxPolarAngle=Math.PI*.475;controls.minPolarAngle=.12;controls.enablePan=true;controls.panSpeed=.65;controls.rotateSpeed=.48;controls.zoomSpeed=.75;controls.update();
  controls.addEventListener('change',()=>{controls.target.x=clamp(controls.target.x,-120,120);controls.target.z=clamp(controls.target.z,-125,105);controls.target.y=clamp(controls.target.y,1,50);});
  const hemisphere=new THREE.HemisphereLight('#dce8ed','#596542',1.6);scene.add(hemisphere);
  const sun=new THREE.DirectionalLight('#ffe0a6',2.8);sun.position.set(-85,100,55);sun.castShadow=true;
  sun.shadow.mapSize.set(mobile?1024:2048,mobile?1024:2048);sun.shadow.camera.left=-130;sun.shadow.camera.right=130;sun.shadow.camera.top=120;sun.shadow.camera.bottom=-120;sun.shadow.camera.near=1;sun.shadow.camera.far=340;sun.shadow.bias=-.0004;sun.shadow.normalBias=.13;sun.shadow.radius=3;scene.add(sun);scene.add(sun.target);sun.target.position.set(0,0,-4);
  const skyGeo=new THREE.SphereGeometry(950,32,20);
  const skyMaterial=new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,uniforms:{top:{value:new THREE.Color('#aebfaf')},bottom:{value:new THREE.Color('#f0ebd2')},sunPosition:{value:sun.position.clone().normalize()}},vertexShader:'varying vec3 vWorld; void main(){vec4 world=modelMatrix*vec4(position,1.);vWorld=world.xyz;gl_Position=projectionMatrix*viewMatrix*world;}',fragmentShader:'uniform vec3 top;uniform vec3 bottom;uniform vec3 sunPosition;varying vec3 vWorld;void main(){vec3 p=normalize(vWorld);float h=clamp(p.y*.9,0.,1.);vec3 c=mix(bottom,top,pow(h,.6));float s=pow(max(dot(p,sunPosition),0.),48.);c+=vec3(.13,.08,.005)*s;gl_FragColor=vec4(c,1.); #include <tonemapping_fragment>\n#include <colorspace_fragment> }'});
  // Shader chunks need their own lines for the WebGL preprocessor.
  skyMaterial.fragmentShader=skyMaterial.fragmentShader.replace(' #include','\n#include');scene.add(new THREE.Mesh(skyGeo,skyMaterial));
  createTerrain(scene);
  const water=new Water(new THREE.PlaneGeometry(1600,1600),{textureWidth:mobile?512:1024,textureHeight:mobile?512:1024,waterNormals:waterNormals(),sunDirection:sun.position.clone().normalize(),sunColor:'#ffe3af',waterColor:'#296b60',distortionScale:1.8,alpha:1,fog:true});
  water.material.fragmentShader=water.material.fragmentShader.replace('float rf0 = 0.3;', 'float rf0 = 0.23;').replace('sunColor * diffuseLight * 0.3','sunColor * diffuseLight * 0.12').replace('vec3 outgoingLight = albedo;', 'vec3 outgoingLight = mix(albedo, waterColor * 1.4 + reflectionSample * 0.15, 0.28);');
  water.rotation.x=-Math.PI/2;water.position.y=.4;water.material.uniforms.size.value=5.2;scene.add(water);
  const forest=populateForest(scene,mobile);scatterDetails(scene,mobile);
  const cabin=createCabin(scene);const ruins=createRuins(scene);const boat=createDock(scene);const wildlife=createWildlife(scene);
  // Soft smoke and low drifting wisps share generated textures, with no network assets.
  const smokeTexture=radialTexture();const smoke=[];
  for(let i=0;i<16;i++){const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:smokeTexture,color:'#d4d5c6',transparent:true,opacity:.1,depthWrite:false}));scene.add(sprite);smoke.push({sprite,offset:i/16});}
  const mistTexture=radialTexture(128,true),mists=[];
  for(let i=0;i<16;i++){const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:mistTexture,color:'#e9e9d3',transparent:true,opacity:range(.12,.23),depthWrite:false}));sprite.position.set(range(-75,75),range(3.5,10),range(-85,25));sprite.scale.set(range(28,55),range(5,11),1);scene.add(sprite);mists.push({sprite,x:sprite.position.x,phase:range(0,TAU)});}
  const particlePositions=new Float32Array(110*3);
  for(let i=0;i<110;i++){particlePositions[i*3]=range(-70,80);particlePositions[i*3+1]=range(2,23);particlePositions[i*3+2]=range(-40,60);}
  const particleGeo=new THREE.BufferGeometry();particleGeo.setAttribute('position',new THREE.BufferAttribute(particlePositions,3));
  const particles=new THREE.Points(particleGeo,new THREE.PointsMaterial({map:smokeTexture,color:'#fff7c3',size:.2,transparent:true,opacity:.55,depthWrite:false,blending:THREE.AdditiveBlending}));scene.add(particles);
  let dusk=false;
  function setMood(value){
    dusk=value;sun.color.set(dusk?'#ffb274':'#ffe0a6');sun.intensity=dusk?2.1:2.8;sun.position.set(dusk?-100:-85,dusk?44:100,dusk?25:55);
    hemisphere.color.set(dusk?'#c0c3d9':'#dce8ed');hemisphere.groundColor.set(dusk?'#686445':'#596542');hemisphere.intensity=dusk?1.35:1.6;
    scene.fog.color.set(dusk?'#c9bbb0':'#e4e8d7');scene.background.copy(scene.fog.color);skyMaterial.uniforms.top.value.set(dusk?'#9aadc0':'#aebfaf');skyMaterial.uniforms.bottom.value.set(dusk?'#e8c1a0':'#f0ebd2');skyMaterial.uniforms.sunPosition.value.copy(sun.position).normalize();
    water.material.uniforms.sunDirection.value.copy(sun.position).normalize();water.material.uniforms.sunColor.value.set(dusk?'#f4b27f':'#ffe3af');water.material.uniforms.waterColor.value.set(dusk?'#466c69':'#296b60');renderer.toneMappingExposure=dusk?1:1.04;
    materials.glass.emissiveIntensity=dusk?1.6:.32;renderer.shadowMap.needsUpdate=true;
  }
  function resize(){renderer.setSize(innerWidth,innerHeight);camera.aspect=innerWidth/innerHeight;camera.fov=innerWidth<761?54:40;camera.setViewOffset(innerWidth,innerHeight,-innerWidth*(innerWidth<761?.06:.145),innerWidth<761?-innerHeight*.1:0,innerWidth,innerHeight);camera.updateProjectionMatrix();}
  function update(t,delta){
    water.material.uniforms.time.value=t*.28;boat.position.y=.58+Math.sin(t*.8)*.09;boat.rotation.z=Math.sin(t*.65)*.013;
    wildlife.birds.forEach((bird,i)=>{const angle=t*bird.speed+bird.phase;bird.group.position.set(Math.cos(angle)*bird.radius+5,bird.height+Math.sin(angle*2)*2,Math.sin(angle)*bird.radius*.6-12);bird.group.rotation.y=-angle-Math.PI/2;bird.wings.forEach((wing,j)=>wing.rotation.z=Math.sin(t*4.5+i)*.42*(j===0?1:-1));});
    wildlife.ducks.forEach((duck,i)=>{const a=t*.035+duck.phase;duck.group.position.set(26+Math.cos(a)*9,.6+Math.sin(t*2+i)*.025,28+Math.sin(a)*4);duck.group.rotation.y=-a-Math.PI/2;});
    wildlife.deer.forEach((deer,i)=>{deer.head.rotation.x=.15+Math.sin(t*.32+i*2)*.28;deer.head.rotation.y=Math.sin(t*.23+i)*.16;});
    smoke.forEach(({sprite,offset})=>{const age=(t*.065+offset)%1; sprite.position.copy(cabin.chimney).add(new THREE.Vector3(age*4,age*10,Math.sin(age*4+t*.1)*.5));sprite.scale.setScalar(1+age*4);sprite.material.opacity=Math.sin(age*Math.PI)*.07;});
    mists.forEach(({sprite,x,phase})=>{sprite.position.x=x+Math.sin(t*.022+phase)*7;});particles.rotation.y=Math.sin(t*.025)*.025;
    controls.update();renderer.render(scene,camera);
  }
  function capture(position,target){
    const oldPosition=camera.position.clone(),oldTarget=controls.target.clone(),oldAspect=camera.aspect,oldView={...camera.view};
    camera.clearViewOffset();camera.aspect=1.8;camera.position.fromArray(position);camera.lookAt(new THREE.Vector3(...target));camera.updateProjectionMatrix();renderer.setSize(288,160,false);renderer.render(scene,camera);const data=renderer.domElement.toDataURL('image/jpeg',.87);
    camera.position.copy(oldPosition);controls.target.copy(oldTarget);camera.aspect=oldAspect;if(oldView.enabled)camera.setViewOffset(oldView.fullWidth,oldView.fullHeight,oldView.offsetX,oldView.offsetY,oldView.width,oldView.height);camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);controls.update();return data;
  }
  resize();
  return {scene,renderer,camera,controls,water,resize,update,setMood,capture,stats:{trees:forest.positions.length,animals:20},landmarks:{cabin:cabin.group.position.clone(),ruins:ruins.position.clone()}};
}
