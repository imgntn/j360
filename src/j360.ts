'use strict';
import { WebMRecorder } from './WebMRecorder';

// worker for JPEG encoding
const jpegWorker = new Worker(new URL('./convertWorker.ts', import.meta.url), {
  type: 'module'
});

// Create a capturer that exports Equirectangular 360 JPG images in a TAR file
const capturer360 = new CCapture({
    format: 'threesixty',
    display: true,
    autoSaveTime: 3,
});

const startCapture360 = () => {
    const resSel = document.getElementById('resolution') as HTMLSelectElement | null;
    if (resSel && equiManaged) {
        equiManaged.setResolution(resSel.value, true);
    }
    capturer360.start();
};

const stopCapture360 = () => {
    capturer360.stop();
};

let webmRecorder: WebMRecorder | null = null;
const startWebMRecording = () => {
    if (!webmRecorder) {
        const src = stereo ? equiManaged.getStereoCanvas() : (canvas as HTMLCanvasElement);
        webmRecorder = new WebMRecorder(src as HTMLCanvasElement);
    }
    webmRecorder.start();
};

const stopWebMRecording = async () => {
    if (!webmRecorder) return;
    const blob = await webmRecorder.stop();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'capture.webm';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    webmRecorder = null;
};

const stopWebMRecordingForCli = async () => {
    if (!webmRecorder) return null;
    const blob = await webmRecorder.stop();
    const buffer = await blob.arrayBuffer();
    webmRecorder = null;
    return buffer;
};

const toggleStereo = () => {
    stereo = !stereo;
};

const enterVR = async () => {
    if (!navigator.xr) return;
    if (vrSession) {
        vrSession.end();
        vrSession = null;
        return;
    }
    try {
        vrSession = await navigator.xr.requestSession('immersive-vr');
        renderer.xr.enabled = true;
        renderer.xr.setSession(vrSession);
    } catch (e) {
        console.error(e);
    }
};

const captureFrameAsync = () => {
    return new Promise<void>((resolve, reject) => {
        if (!equiManaged) return resolve();
        equiManaged.preBlob(equiManaged.cubeCamera, camera, scene);
        const { width, height, ctx } = equiManaged;
        const data = ctx.getImageData(0, 0, width, height).data;
        jpegWorker.onmessage = (e: MessageEvent) => {
            if (e.data.error) {
                reject(e.data.error);
                return;
            }
            const a = document.createElement('a');
            a.href = e.data.url;
            a.download = 'frame-' + Date.now() + '.jpg';
            a.style.display = 'none';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            resolve();
        };
        jpegWorker.postMessage({
            width,
            height,
            pixels: data.buffer
        }, [data.buffer]);
    });
};

let scene, camera, renderer;
let canvas;
const meshes = [];
let controls;
let equiManaged;
let stereo = false;
let vrSession: XRSession | null = null;
const locationNames = ['top', 'bottom', 'front', 'behind', 'left', 'right'];

const init = () => {

    scene = new THREE.Scene();

    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 1, 10000);
    placeObjectsAroundYou();
    renderer = new THREE.WebGLRenderer();
    renderer.setSize(window.innerWidth, window.innerHeight);
    equiManaged = new CubemapToEquirectangular(renderer, true, "4K");
    const container = document.getElementsByClassName('container')[0];
    canvas = container.appendChild(renderer.domElement);
    controls = new THREE.OrbitControls(camera, container);
    camera.position.z = 0.01;

    scene.add(new THREE.AmbientLight(0x404040));
    const light = new THREE.PointLight('white', 1, 50);
    light.position.set(0, 1, 0);
    scene.add(light);

};


const placeObjectsAroundYou = () => {

    const top = new THREE.Vector3(0, 38, 0);
    const bottom = new THREE.Vector3(0, -38, 0);
    const left = new THREE.Vector3(-50, 0, 0);
    const right = new THREE.Vector3(50, 0, 0);
    const front = new THREE.Vector3(0, 0, 50);
    const behind = new THREE.Vector3(0, 0, -50);

    const locations = [top, bottom, behind, front, left, right];

    for (let i = 0; i < locations.length; i++) {
        makeSingleObject(locations[i], i);
    }

};

const makeSingleObject = (location, index) => {
    const geometry = new THREE.SphereGeometry(25, 40, 40);

    const map = new THREE.TextureLoader().load(`textures/${locationNames[index]}.png`);

    map.wrapS = map.wrapT = THREE.RepeatWrapping;
    map.repeat.set(8, 8);
    map.anisotropy = 16;

    const material = new THREE.MeshLambertMaterial({
        map: map,
        side: THREE.DoubleSide
    });

    const mesh = new THREE.Mesh(geometry, material);

    mesh.position.add(location);
    meshes.push(mesh);
    scene.add(mesh);
    return mesh;
};

const animate = (delta?: number) => {

    requestAnimationFrame(animate);

    meshes.forEach(mesh => {
        // mesh.rotation.x += 0.005;
        mesh.rotation.y += 0.003;
    });

    controls.update(delta);

    renderer.render(scene, camera);
    if (stereo) {
        const out = equiManaged.updateStereo(camera, scene);
        capturer360.capture(out);
    } else {
        capturer360.capture(canvas);
    }

};


const onWindowResize = () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
};

window.addEventListener('resize', onWindowResize, false);

init();
animate();

// expose controls for inline handlers
window.startCapture360 = startCapture360;
window.stopCapture360 = stopCapture360;
window.startWebMRecording = startWebMRecording;
window.stopWebMRecording = stopWebMRecording;
window.toggleStereo = toggleStereo;
window.captureFrameAsync = captureFrameAsync;
window.enterVR = enterVR;
window.stopWebMRecordingForCli = stopWebMRecordingForCli;
