// Teapot Explosion
//
// Library dependency: dat.gui, three.js
// 
// Author: Long Qian
// Data: 11/22/2016
//


// render essentials
var scene, camera, renderer;
// globally available teapot geometry definition, and material
var teapotMaterial, teapotGeometry, currentTeapotGeometry;
var guiElements;
// vertex shader attributes and uniforms
var uniforms, distance, surfaceNormal;
// previous numbers keep track of GUI change
var prevTess, prevNum;
// explosing status
var exploding = false;
var increment;
// utils: number of total vertices
var verts;



// dat menu container and default value
var GUIElements = function() {
    this.message = 'Teapot Explosion';
    this.tessellations = 0;
    this.teapotNum = 1;
};




// load teapot model and shader material
function loadTeapot(){

    // loading model
    // teapot model loading aided by THREE.js
    var manager = new THREE.LoadingManager();
    manager.onProgress = function (item, loaded, total) {
        console.log(item, loaded, total);
    };
    var onProgress = function (xhr) {
        if (xhr.lengthComputable) {
            var percentComplete = xhr.loaded / xhr.total * 100;
            console.log(Math.round(percentComplete, 2) + '% downloaded');
        }
    };
    var onError = function ( xhr ) {};

    // loading shaders
    var vertShader = document.getElementById('vertexshader').innerHTML;
    var fragShader = document.getElementById('fragmentshader').innerHTML;
    uniforms = {
        amplitude: {
            type: 'f',
            value: 0
        }
    };
    teapotMaterial = new THREE.ShaderMaterial({
        uniforms: uniforms,
        vertexShader: vertShader,
        fragmentShader: fragShader
    });


    var tpLoader = new THREE.OBJLoader(manager);
    tpLoader.load('/public/obj/teapot.obj', function(object) {
        var mesh;
        object.traverse(function(child){
            if (child instanceof THREE.Mesh) {
                child.material = teapotMaterial;
                mesh = child;
            }
        });

        // teapot model is refined first
        var rawTeapotGeometry = mesh.geometry;
        teapotGeometry = new THREE.Geometry().fromBufferGeometry(mesh.geometry);
        teapotGeometry.mergeVertices();
        var modifier = new THREE.SubdivisionModifier(0);
        modifier.modify( teapotGeometry );
        currentTeapotGeometry = new THREE.BufferGeometry().fromGeometry(teapotGeometry)

        // adding attributes to geometry of teapot
        verts = currentTeapotGeometry.attributes.position.count;
        distance = new Float32Array( verts );
        surfaceNormal = new Float32Array( verts * 3 );
        currentTeapotGeometry.addAttribute('distance', new THREE.BufferAttribute(distance, 1));
        currentTeapotGeometry.addAttribute('surfaceNormal', new THREE.BufferAttribute(surfaceNormal, 3));

        // insert the teapot object into scene
        var teapot = new THREE.Mesh(currentTeapotGeometry, teapotMaterial);
        teapot.name = 'teapot';
        scene.add(teapot);
    }, onProgress, onError);
};



// fake callback function to change tessellation level of teapot
// the change takes effect on all teapots in the scene
function changeTessellations(tess) {

    // subdivide the model
    var geo = teapotGeometry.clone();
    var modifier = new THREE.SubdivisionModifier(tess);
    modifier.modify( geo );
    var bufGeo = new THREE.BufferGeometry().fromGeometry(geo)

    // update the number of vertices, and update attributes of model
    verts = bufGeo.attributes.position.count;
    distance = new Float32Array( verts );
    surfaceNormal = new Float32Array( verts * 3 );
    bufGeo.addAttribute('distance', new THREE.BufferAttribute(distance, 1));
    bufGeo.addAttribute('surfaceNormal', new THREE.BufferAttribute(surfaceNormal, 3));
    
    // change all teapots in the scene to new tessellation level
    currentTeapotGeometry = bufGeo;
    scene.traverse (function (object) {
        if (object instanceof THREE.Mesh) {
            object.geometry = bufGeo;
        }
    });
};




// fake callback function to change number of total teapots in the scene
// the original teapot will never be removed
// new teapot keeps the same geometry and tessellation level
function changeTeapotNumber(num) {
    var currentNum = 0;

    // find out the current total number of teapots
    // a safer way to prevent leak
    scene.traverse (function (object) {
        if (object instanceof THREE.Mesh) {
            currentNum += 1;
        };
    });

    // add more teapot, assign them random location
    if ( currentNum < num ) {
        for ( var i = 0; i < num - currentNum; i++) {
            var newTeapot = new THREE.Mesh();
            // reference the current geometry instead of cloning
            newTeapot.geometry = currentTeapotGeometry;
            newTeapot.material = teapotMaterial;
            newTeapot.position.x = Math.random() * 40 - 20;
            newTeapot.position.y = Math.random() * 40 - 30;
            newTeapot.position.z = Math.random() * 20 - 20;
            scene.add(newTeapot);
        }
    }
    // remove teapots, first put the references in a list
    else if ( currentNum > num ) {
        var remainsToDelete = currentNum - num;
        var toDelete = [];
        scene.traverse (function (object) {
            if (object instanceof THREE.Mesh && remainsToDelete > 0) {
                // the original teapot is not deleted
                if (object.name != 'teapot') {
                    remainsToDelete --;
                    toDelete.push(object);
                }
            };
        });
        while ( toDelete.length > 0 ){
            scene.remove(toDelete.pop());
        }
    }

}



// init scene, camera, model and renderer
function init() {

    // THREE.js scene
    // add light
    scene = new THREE.Scene();
    var ambient = new THREE.AmbientLight( 0x101030 );
    scene.add( ambient );
    var directionalLight = new THREE.DirectionalLight( 0xffeedd );
    directionalLight.position.set( 1, 1, 1 );
    scene.add( directionalLight );

    var canvasHolder = document.getElementById('canvas-holder');

    var width = canvasHolder.clientWidth;
    var height = width * 0.8;
    canvasHolder.clientHeight = height;
    
    console.log(height, width);

    // THREE.js camera
    camera = new THREE.PerspectiveCamera( 60, width / height, 1, 2000  );
    camera.position.z = 20;
    camera.position.y = 20;
    camera.lookAt(new THREE.Vector3(0,0,0));

    // model and material loading
    loadTeapot();

    // renderer setup
    renderer = new THREE.WebGLRenderer();
    renderer.setSize( width, height );
    canvasHolder.appendChild( renderer.domElement );
    // setup explode callback
    renderer.domElement.onclick = explode;
}



// explode setup
function explode() {
    if ( exploding ){
        return;
    }
    exploding = true;
    increment = 0.01;
    // Looping over each triangle
    var x, y, z, l;
    // update the surfaceNormal attribute of each vertices
    // make sure the explosion not increase the size of triangles
    for ( var i = 0; i < verts / 3; i += 1 ) {
        var val = 0.5 + 2.0 * Math.random();
        distance[3*i] = val;
        distance[3*i+1] = val;
        distance[3*i+2] = val;
        // find the average of three vertices normal
        // assign them back as surface normal
        // only calculated once before explosion
        x = currentTeapotGeometry.attributes.normal.array[9*i] + 
            currentTeapotGeometry.attributes.normal.array[9*i+3] +
            currentTeapotGeometry.attributes.normal.array[9*i+6];
        y = currentTeapotGeometry.attributes.normal.array[9*i+1] + 
            currentTeapotGeometry.attributes.normal.array[9*i+4] +
            currentTeapotGeometry.attributes.normal.array[9*i+7];
        z = currentTeapotGeometry.attributes.normal.array[9*i+2] + 
            currentTeapotGeometry.attributes.normal.array[9*i+5] +
            currentTeapotGeometry.attributes.normal.array[9*i+8];
        l = Math.sqrt(x*x + y*y + z*z);
        x = x / l;
        y = y / l;
        z = z / l;
        surfaceNormal[9*i] = surfaceNormal[9*i+3] = surfaceNormal[9*i+6] = x;
        surfaceNormal[9*i+1] = surfaceNormal[9*i+4] = surfaceNormal[9*i+7] = y;
        surfaceNormal[9*i+2] = surfaceNormal[9*i+5] = surfaceNormal[9*i+8] = z;
    }
    // update geometry
    currentTeapotGeometry.attributes.distance.needsUpdate = true;
    currentTeapotGeometry.attributes.surfaceNormal.needsUpdate = true;
};


// animate
function animate() {
    requestAnimationFrame( animate );
    render();
};


// rendering function
function render() {
    // during explosion
    if (exploding) {
        uniforms.amplitude.value += increment;
        // fake physics
        increment += 0.0004;
        if ( uniforms.amplitude.value > 10.0 ) {
            uniforms.amplitude.value = 0;
            exploding = false;
            increment = 0.01;
        }
    }
    // tessellation change and number change only initiated after current explosion done
    else {
        if ( prevTess != guiElements.tessellations){
            prevTess = guiElements.tessellations;
            changeTessellations(prevTess);
        }
        if ( prevNum != guiElements.teapotNum){
            prevNum = guiElements.teapotNum;
            changeTeapotNumber(guiElements.teapotNum);
        }
    }
    renderer.render( scene, camera );
};


// load dat menu
window.onload = function() {
    guiElements = new GUIElements();
    var gui = new dat.GUI( { autoPlace: false } );

    // var gui = new dat.GUI();
    gui.add(guiElements, 'message');
    // Tessellation level is from 0 to 3, default is 0
    gui.add(guiElements, 'tessellations', 0, 3).step(1);
    // Number of teapots range from 1 to 200
    gui.add(guiElements, 'teapotNum', 1, 200).step(1);
    prevNum = 1;
    prevTess = 0;

    var datguiHolder = document.getElementById('dat-gui-holder');
    var customContainer = datguiHolder.appendChild(gui.domElement);

    
    // Hurray!
    init();
    animate();
};




