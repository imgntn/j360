// Create a capturer that exports Equirectangular 360 JPG images in a TAR file
var capturer360 = new CCapture({
    format: 'threesixty',
    display: true,
    autoSaveTime: 3,
});

function startCapture360(event) {
    capturer360.start();
}

function stopCapture360(event) {
    capturer360.stop();
}

var scene, camera, renderer;
var meshes = [];
var controls;
var locationNames = ['top', 'bottom', 'front', 'behind', 'left', 'right', ];

function init() {

    scene = new THREE.Scene();

    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 1, 10000);
    placeObjectsAroundYou();
    renderer = new THREE.WebGLRenderer();
    renderer.setSize(window.innerWidth, window.innerHeight);
    equiManaged = new CubemapToEquirectangular(renderer, true, "4K");
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

    var top = new THREE.Vector3(0, 38, 0);
    var bottom = new THREE.Vector3(0, -38, 0);
    var left = new THREE.Vector3(-50, 0, 0);
    var right = new THREE.Vector3(50, 0, 0);
    var front = new THREE.Vector3(0, 0, 50);
    var behind = new THREE.Vector3(0, 0, -50);

    var locations = [top, bottom, behind, front, left, right, ];

    var i;
    for (i = 0; i < locations.length; i++) {
        makeSingleObject(locations[i], i);
    }

}

function makeSingleObject(location, index) {
    geometry = new THREE.SphereGeometry(25, 40, 40);

    var map = new THREE.TextureLoader().load('textures/'+locationNames[index] + '.png');

    map.wrapS = map.wrapT = THREE.RepeatWrapping;
    map.repeat.set(8, 8);
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
        // mesh.rotation.x += 0.005;
        mesh.rotation.y += 0.003;
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

init();
animate();