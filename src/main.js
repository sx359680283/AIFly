import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import './styles.css';

const MODEL_URL = '/hawk_209_idn/scene.gltf';

document.querySelector('#app').innerHTML = `
  <main class="sim-shell">
    <aside class="side-panel">
      <div class="brand-block">
        <span class="eyebrow">Hawk 209 IDN Asset</span>
        <h1>机械拆装仿真</h1>
      </div>

      <section class="status-panel">
        <div>
          <span class="label">当前步骤</span>
          <strong id="stepTitle">加载 Hawk 209 IDN</strong>
        </div>
        <div class="progress-track" aria-hidden="true">
          <span id="progressFill"></span>
        </div>
        <p id="stepDescription">正在加载 public 目录中的 Hawk 209 IDN 模型。</p>
      </section>

      <section class="controls">
        <button id="prevStep" type="button" title="上一步">‹</button>
        <button id="playPause" type="button">播放</button>
        <button id="nextStep" type="button" title="下一步">›</button>
      </section>

      <section class="control-grid">
        <label>
          <span>拆解进度</span>
          <input id="progressSlider" type="range" min="0" max="100" value="0" />
        </label>
        <label>
          <span>爆炸视图</span>
          <input id="explodeSlider" type="range" min="0" max="100" value="0" />
        </label>
      </section>

      <section>
        <h2>工序</h2>
        <ol id="stepList" class="step-list"></ol>
      </section>
    </aside>

    <section class="viewport-wrap">
      <div id="viewport"></div>
      <div class="viewport-topbar">
        <div>
          <span>当前资产</span>
          <strong>Hawk 209 IDN</strong>
        </div>
        <div>
          <span>模型状态</span>
          <strong id="modelStats">加载中</strong>
        </div>
        <div>
          <span>视图模式</span>
          <strong>拆装仿真</strong>
        </div>
      </div>
      <div class="hud">
        <div>
          <span>选中对象</span>
          <strong id="partName">未选择</strong>
        </div>
        <div>
          <span>操作提示</span>
          <strong id="hintText">拖拽旋转，滚轮缩放，点击模型部件查看名称</strong>
        </div>
      </div>
    </section>
  </main>
`;

const viewport = document.querySelector('#viewport');
const stepTitle = document.querySelector('#stepTitle');
const stepDescription = document.querySelector('#stepDescription');
const progressFill = document.querySelector('#progressFill');
const progressSlider = document.querySelector('#progressSlider');
const explodeSlider = document.querySelector('#explodeSlider');
const playPause = document.querySelector('#playPause');
const prevStep = document.querySelector('#prevStep');
const nextStep = document.querySelector('#nextStep');
const stepList = document.querySelector('#stepList');
const partName = document.querySelector('#partName');
const hintText = document.querySelector('#hintText');
const modelStats = document.querySelector('#modelStats');

const steps = [
  {
    title: '模型姿态检查',
    description: '检查 Hawk 209 IDN 全机姿态、尺寸包围盒和初始装配位置。',
    hint: '当前场景只包含加载的模型本体，没有额外方块夹具。'
  },
  {
    title: '座舱与机身识别',
    description: '按模型内部 mesh 分组高亮局部组件，模拟拆装前的部件识别。',
    hint: '点击模型表面可以查看 glTF 中的 mesh 名称。'
  },
  {
    title: '机翼与挂点分离',
    description: '按空间位置把左右侧组件向外展开，模拟机翼、挂点和外侧蒙皮拆解。',
    hint: '拖动拆解进度可以观察左右侧组件的分离方向。'
  },
  {
    title: '尾翼与后机身移出',
    description: '后部组件沿机体纵向移出，模拟尾翼和后机身检修拆解。',
    hint: '模型不是严格工程分件时，会按 mesh 中心位置生成拆解分组。'
  },
  {
    title: '全机爆炸复核',
    description: '将模型内部 mesh 按中心点向外展开，用于观察整体结构层次。',
    hint: '爆炸视图是教学可视化，不代表真实装配约束。'
  }
];

const scene = new THREE.Scene();
scene.background = null;
scene.fog = new THREE.Fog(0x11151a, 7, 18);

const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 1000);
camera.position.set(4.8, 2.9, 6.4);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
viewport.appendChild(renderer.domElement);

const pmremGenerator = new THREE.PMREMGenerator(renderer);
scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.target.set(0, 0.2, 0);
controls.minDistance = 1.5;
controls.maxDistance = 16;

scene.add(new THREE.HemisphereLight(0xffffff, 0x8c806d, 1.5));

const keyLight = new THREE.DirectionalLight(0xffffff, 3);
keyLight.position.set(4, 7, 5);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(2048, 2048);
scene.add(keyLight);

const fillLight = new THREE.PointLight(0xd39b42, 1.2, 14);
fillLight.position.set(-4, 3, -3);
scene.add(fillLight);

const modelRoot = new THREE.Group();
modelRoot.name = 'Hawk 209 IDN';
scene.add(modelRoot);

const markerGroup = new THREE.Group();
scene.add(markerGroup);

const modelParts = [];
const selectableObjects = [];
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

const highlightMaterial = new THREE.MeshStandardMaterial({
  color: 0x6ee7b7,
  emissive: 0x1f7a5f,
  emissiveIntensity: 0.45,
  roughness: 0.28
});

let selectedObject = null;
let activeStep = 0;
let progress = 0;
let explode = 0;
let playing = false;
let lastTime = 0;
let loadedModel = null;
let modelRadius = 1;

steps.forEach((step, index) => {
  const item = document.createElement('li');
  item.innerHTML = `<button type="button"><span>${String(index + 1).padStart(2, '0')}</span>${step.title}</button>`;
  item.querySelector('button').addEventListener('click', () => {
    playing = false;
    playPause.textContent = '播放';
    setProgress((index / (steps.length - 1)) * 100);
  });
  stepList.appendChild(item);
});

function createMarker(text, position) {
  const canvas = document.createElement('canvas');
  canvas.width = 384;
  canvas.height = 104;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#15191c';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#f5efe5';
  ctx.font = '30px Microsoft YaHei, sans-serif';
  ctx.fillText(text, 24, 62);
  const texture = new THREE.CanvasTexture(canvas);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true }));
  sprite.scale.set(1.85, 0.5, 1);
  sprite.position.set(...position);
  markerGroup.add(sprite);
  return sprite;
}

const markers = [
  createMarker('1 姿态检查', [-1.7, 1.8, 0]),
  createMarker('2 组件识别', [1.7, 1.45, 0.5]),
  createMarker('3 爆炸复核', [0.2, 2.05, -1.6])
];

const loader = new GLTFLoader();

THREE.DefaultLoadingManager.onError = (url) => {
  stepTitle.textContent = '模型加载失败';
  stepDescription.textContent = `无法加载资源：${url}`;
  hintText.textContent = '请确认 public/hawk_209_idn 下的 scene.gltf、scene.bin 和 textures 文件完整。';
};

loader.load(
  MODEL_URL,
  (gltf) => {
    loadedModel = gltf.scene;
    loadedModel.name = 'Hawk 209 IDN';
    loadedModel.rotation.set(0, Math.PI, 0);
    modelRoot.add(loadedModel);

    normalizeModel();
    collectModelParts();
    setProgress(0);
  },
  (event) => {
    if (!event.total) return;
    const percent = Math.round((event.loaded / event.total) * 100);
    stepDescription.textContent = `正在加载 Hawk 209 IDN 模型资源：${percent}%`;
    progressFill.style.width = `${percent}%`;
  }
);

function normalizeModel() {
  const box = new THREE.Box3().setFromObject(modelRoot);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const maxAxis = Math.max(size.x, size.y, size.z);
  const targetSize = 4.2;
  const scale = targetSize / maxAxis;

  modelRoot.scale.setScalar(scale);
  modelRoot.position.sub(center.multiplyScalar(scale));

  const normalizedBox = new THREE.Box3().setFromObject(modelRoot);
  modelRoot.position.y += -normalizedBox.min.y - 0.75;
  controls.target.copy(normalizedBox.getCenter(new THREE.Vector3()));
  controls.target.y += 0.1;
  modelRadius = normalizedBox.getSize(new THREE.Vector3()).length() * 0.5;
}

function collectModelParts() {
  const rootCenter = new THREE.Box3().setFromObject(modelRoot).getCenter(new THREE.Vector3());

  loadedModel.traverse((object) => {
    if (!object.isMesh) return;

    object.castShadow = true;
    object.receiveShadow = true;
    object.name = object.name || 'Hawk 209 Mesh';
    object.userData.baseMaterial = object.material;
    object.userData.basePosition = object.position.clone();
    object.userData.baseRotation = object.rotation.clone();
    object.userData.baseScale = object.scale.clone();

    const worldCenter = new THREE.Box3().setFromObject(object).getCenter(new THREE.Vector3());
    const direction = worldCenter.clone().sub(rootCenter);
    if (direction.lengthSq() < 0.0001) direction.set(0, 1, 0);
    direction.normalize();

    const sideWeight = Math.abs(direction.x);
    const rearWeight = Math.max(0, -direction.z);
    const topWeight = Math.max(0, direction.y);
    object.userData.explodeDirection = direction;
    object.userData.disassemblyDirection = new THREE.Vector3(
      direction.x * (1.15 + sideWeight),
      0.2 + topWeight * 0.65,
      direction.z * 0.8 - rearWeight * 0.75
    ).normalize();

    modelParts.push(object);
    selectableObjects.push(object);
  });

  modelStats.textContent = `${modelParts.length} 个 mesh`;
}

function smoothstep(edge0, edge1, value) {
  const x = THREE.MathUtils.clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return x * x * (3 - 2 * x);
}

function setProgress(value) {
  progress = THREE.MathUtils.clamp(value, 0, 100);
  updateSimulation();
}

function getPartPhase(part) {
  const dir = part.userData.explodeDirection ?? new THREE.Vector3(0, 1, 0);

  if (progress < 20) return 0;
  if (progress < 40) return smoothstep(20, 40, progress) * Math.max(0, dir.y);
  if (progress < 65) return smoothstep(40, 65, progress) * Math.abs(dir.x);
  if (progress < 88) return smoothstep(65, 88, progress) * Math.max(0.15, -dir.z);
  return smoothstep(82, 100, progress);
}

function updateSimulation() {
  activeStep = Math.min(steps.length - 1, Math.floor((progress / 100) * steps.length));
  const step = steps[activeStep];
  stepTitle.textContent = step.title;
  stepDescription.textContent = step.description;
  hintText.textContent = step.hint;
  progressFill.style.width = `${progress}%`;
  progressSlider.value = String(progress);
  explodeSlider.value = String(explode);

  modelParts.forEach((part) => {
    const basePosition = part.userData.basePosition;
    const baseRotation = part.userData.baseRotation;
    const baseScale = part.userData.baseScale;
    const disassemblyDirection = part.userData.disassemblyDirection;
    const explodeDirection = part.userData.explodeDirection;
    const phase = getPartPhase(part);
    const explodePhase = explode / 100;
    const moveDistance = modelRadius * (0.42 * phase + 0.58 * explodePhase);
    const move = disassemblyDirection
      .clone()
      .multiplyScalar(modelRadius * 0.45 * phase)
      .add(explodeDirection.clone().multiplyScalar(moveDistance));

    part.position.copy(basePosition).add(move);
    part.rotation.copy(baseRotation);
    part.rotation.x += phase * 0.08 * Math.sign(explodeDirection.y || 1);
    part.rotation.y += phase * 0.12 * Math.sign(explodeDirection.x || 1);
    part.scale.copy(baseScale);
    part.material = part === selectedObject ? highlightMaterial : part.userData.baseMaterial;
  });

  markers[0].visible = progress < 30;
  markers[1].visible = progress >= 20 && progress < 70;
  markers[2].visible = progress >= 60;

  [...stepList.children].forEach((item, index) => {
    item.classList.toggle('is-active', index === activeStep);
    item.classList.toggle('is-done', index < activeStep);
  });
}

function resize() {
  const { clientWidth, clientHeight } = viewport;
  renderer.setSize(clientWidth, clientHeight, false);
  camera.aspect = clientWidth / clientHeight;
  if (clientWidth < 640) {
    camera.position.set(3.5, 2.35, 5.4);
    controls.minDistance = 1.2;
    controls.maxDistance = 12;
  } else {
    camera.position.set(4.8, 2.9, 6.4);
    controls.minDistance = 1.5;
    controls.maxDistance = 16;
  }
  camera.updateProjectionMatrix();
}

function animate(time = 0) {
  requestAnimationFrame(animate);
  const delta = Math.min((time - lastTime) / 1000, 0.05);
  lastTime = time;

  if (playing) {
    setProgress((progress + delta * 11) % 101);
  }

  controls.update();
  markerGroup.children.forEach((sprite) => sprite.quaternion.copy(camera.quaternion));
  renderer.render(scene, camera);
}

function setSelected(object) {
  selectedObject = object;
  partName.textContent = object ? object.name : '未选择';
  updateSimulation();
}

renderer.domElement.addEventListener('pointerdown', (event) => {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(selectableObjects, false);
  setSelected(hits[0]?.object ?? null);
});

progressSlider.addEventListener('input', (event) => {
  playing = false;
  playPause.textContent = '播放';
  setProgress(Number(event.target.value));
});

explodeSlider.addEventListener('input', (event) => {
  explode = Number(event.target.value);
  updateSimulation();
});

playPause.addEventListener('click', () => {
  playing = !playing;
  playPause.textContent = playing ? '暂停' : '播放';
});

prevStep.addEventListener('click', () => {
  playing = false;
  playPause.textContent = '播放';
  activeStep = Math.max(0, activeStep - 1);
  setProgress((activeStep / (steps.length - 1)) * 100);
});

nextStep.addEventListener('click', () => {
  playing = false;
  playPause.textContent = '播放';
  activeStep = Math.min(steps.length - 1, activeStep + 1);
  setProgress((activeStep / (steps.length - 1)) * 100);
});

window.addEventListener('resize', resize);
resize();
updateSimulation();
animate();
