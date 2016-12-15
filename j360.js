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
var locationNames = ['top', 'bottom', 'left', 'right', 'front', 'behind'];



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

    var top = new THREE.Vector3(0, 50, 0);
    var bottom = new THREE.Vector3(0, -50, 0);
    var left = new THREE.Vector3(-50, 0, 0);
    var right = new THREE.Vector3(50, 0, 0);
    var front = new THREE.Vector3(0, 0, 50);
    var behind = new THREE.Vector3(0, 0, -50);

    var locations = [top, bottom, left, right,behind, front, ];



    var i;
    for(i=0;i<locations.length;i++){
        makeSingleObject(locations[i],i);
    }

}

function makeSingleObject(location,index) {
    geometry = new THREE.SphereGeometry(25, 40, 40);

    var map = new THREE.TextureLoader().load('/'+locationNames[index]+'.png');
    map.wrapS = map.wrapT = THREE.RepeatWrapping;
    map.repeat.set( 8, 8 );
    map.anisotropy = 16;

    var material = new THREE.MeshLambertMaterial({
        map: map,
        side: THREE.DoubleSide
    });

    // var material = useShaderMaterial();
    
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
        mesh.rotation.y += 0.001;
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


function useShaderMaterial() {


    image = document.createElement('img');
    image.src = "uvgrid01.jpg";
    document.body.appendChild(image);

    var texture = new THREE.Texture(image);
    image.addEventListener('load', function(event) {
        texture.needsUpdate = true;
    });

    var uniforms = {
        "texture": {
            type: "t",
            value: texture
        }
    };

    var material = new THREE.ShaderMaterial({
        uniforms: uniforms,
        vertexShader: document.getElementById('vertex_shader').textContent,
        fragmentShader: document.getElementById('fragment_shader').textContent
    });


    return material
}



init();
animate();