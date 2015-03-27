window.onload = function () {
    
    var canvas = document.getElementById("renderCanvas");
    var engine = new BABYLON.Engine(canvas, true);
    var createScene = function () {
        var scene = new BABYLON.Scene(engine);
        //Camera
        var camera = new BABYLON.ArcRotateCamera("Camera", 3 * Math.PI / 2, Math.PI / 8, 50, BABYLON.Vector3.Zero(), scene);
        camera.attachControl(canvas, true);
        //Setting up the light
        var light = new BABYLON.HemisphericLight("Hemispheric", new BABYLON.Vector3(0, 1, 0), scene);

        //Now start adding meshes.
        var box = BABYLON.Mesh.CreateBox("box", 6.0, scene);
        var sphere = BABYLON.Mesh.CreateSphere("sphere", 10.0, 10.0, scene);
        var plan = BABYLON.Mesh.CreatePlane("plane", 10.0, scene);
        var cylinder = BABYLON.Mesh.CreateCylinder("cylinder", 3, 3, 3, 6, 1, scene, false);
        var torus = BABYLON.Mesh.CreateTorus("torus", 5, 1, 10, scene, false);
        var knot = BABYLON.Mesh.CreateTorusKnot("knot", 2, 0.5, 128, 64, 2, 3, scene);
        var lines = BABYLON.Mesh.CreateLines("lines", [
            new BABYLON.Vector3(-10, 0, 0),
            new BABYLON.Vector3(10, 0, 0),
            new BABYLON.Vector3(0, 0, -10),
            new BABYLON.Vector3(0, 0, 10)
        ], scene);

        box.position = new BABYLON.Vector3(-10, 0, 0);
        sphere.position = new BABYLON.Vector3(0, 10, 0);
        plan.position.z = 10;
        cylinder.position.z = -10;
        torus.position.x = 10;
        knot.position.y = -10;

        return scene;
    }

    var scene = createScene();

    //Register the event register handler.
    

    engine.runRenderLoop(function () {
        scene.render();
    });

    window.addEventListener("resize", function () {
        engine.resize();
    });

    window.onclick = function () {
        var box = BABYLON.Mesh.CreateSphere("sphere", 10.0, 10.0, scene);
        box.position.x = (Math.random() * 50) - 25;
        box.position.y = (Math.random() * 50) - 25;
        box.position.z = (Math.random() * 50) - 25;
    }

    var indexedDBPersist = new BABYLONX.IndexedDBPersist(scene);

    setInterval(function () {
        indexedDBPersist.getAllMeshes(function (list) {

            //console.log("list", list);
        })
        
        indexedDBPersist.countMeshes(function (count) {
            
            console.log("count", count);
        })

    }, 5000)

}