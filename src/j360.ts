'use strict';

// Create a capturer that exports Equirectangular 360 JPG images in a TAR file
const capturer360 = new CCapture({
    format: 'threesixty',
    display: true,
    autoSaveTime: 3,
});

const startCapture360 = () => {
    capturer360.start();
};

const stopCapture360 = () => {
    capturer360.stop();
};

let scene, camera, renderer;
let canvas;
const meshes = [];
let controls;
let equiManaged;
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

const animate = (delta) => {

    requestAnimationFrame(animate);

    meshes.forEach(mesh => {
        // mesh.rotation.x += 0.005;
        mesh.rotation.y += 0.003;
    });

    controls.update(delta);

    renderer.render(scene, camera);
    capturer360.capture(canvas);

};


window.addEventListener('resize', onWindowResize, false);


const onWindowResize = () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
};

init();
animate();

// expose controls for inline handlers
window.startCapture360 = startCapture360;
window.stopCapture360 = stopCapture360;
