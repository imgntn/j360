// Create a capturer that exports Equirectangular 360 PNG images in a TAR file
var capturer360 = new CCapture({
    format: 'threesixty',
    verbose: false,
    display: true,
});


function startCapture360(event) {
    capturer360.start();
}

function saveCapture360(event) {

    capturer360.stop();
    capturer360.save();
}

function capture360(event) {
    return equiManaged.update(camera, scene);
}


var scene, camera, renderer;
var meshes = [];
var controls;

init();
animate();

function init() {

    scene = new THREE.Scene();

    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 1, 10000);
    placeObjectsAroundYou();
    renderer = new THREE.WebGLRenderer();
    renderer.setSize(window.innerWidth, window.innerHeight);
    equiManaged = new CubemapToEquirectangular(renderer, true);
    var container = document.getElementsByClassName('container')[0];
    canvas = container.appendChild(renderer.domElement);
    controls = new THREE.OrbitControls(camera, container);
    camera.position.z = 0.01

    var light;
    scene.add(new THREE.AmbientLight(0x404040));
    light = new THREE.PointLight('white', 1, 50);
    light.position.set(0, 1, 0);
    scene.add(light);

}

function placeObjectsAroundYou() {

    var above = new THREE.Vector3(0, 50, 0);
    var below = new THREE.Vector3(0, -50, 0);
    var left = new THREE.Vector3(50, 0, 0);
    var right = new THREE.Vector3(-50, 0, 0);
    var front = new THREE.Vector3(0, 0, 50);
    var behind = new THREE.Vector3(0, 0, -50);

    var locations = [above, below, left, right, front, behind];

    locations.forEach(function(location) {
        makeSingleObject(location);
    })

}

function makeSingleObject(location) {
    geometry = new THREE.SphereGeometry(25, 40, 40);

    var map = new THREE.TextureLoader().load('uvgrid01.jpg');
    map.wrapS = map.wrapT = THREE.RepeatWrapping;
    map.anisotropy = 16;
    var material = new THREE.MeshLambertMaterial({
        map: map,
        side: THREE.DoubleSide
    });
    mesh = new THREE.Mesh(geometry, material);

    mesh.position.add(location)
    meshes.push(mesh);
    scene.add(mesh);
    return mesh
}

function animate(delta) {

    requestAnimationFrame(animate);


    meshes.forEach(function(mesh) {
        mesh.rotation.x += 0.01;
        mesh.rotation.y += 0.02;
    })

    controls.update(delta);

    renderer.render(scene, camera);
    capturer360.capture(canvas);

}


window.addEventListener('resize', onWindowResize, false);


function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}
