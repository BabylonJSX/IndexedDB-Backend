#BabylonJS Native IndexedDB Backend

This BabylonJS (2.1 and up) extension persists all meshes added to a specific scene, including their position vertices and indices.

##Why do I need this?
This plugin was created for the WebWorker-based collision detector plugin (https://github.com/BabylonJSX/WebWorker-Collisions) . Some other applications might benefit from it!

##Demo?

Can be found here - http://babylonjsx.github.io/IndexedDB-Backend/example/

Use your console to see the count of objects (updated every 5 seconds using setInterval). Clicking anywhere on the page will add an object and will also persist it automatically in the DB.

##Usage

* Add the extension after BabylonJS's javasciprt file:

```html
<script src="babylon.2.1-alpha.debug.js"></script>
<script src="babylonx.indexeddbpersistence.2.1-alpha.js"></script>
```

* initialize the event register class after creating the scene:

```javascript
var scene = myWonderfulSceneCreationMethod();
var indexedDBPersister = new BABYLONX.IndexedDBPersist(scene, [dbName = "babylonJsMeshes", processRegistered = true]);
```

dbName is optional, processRegistered set to true (default) will persist the meshes that are already registered in the scene.

* register the onDatabaseUpdated event and use it anywhere you wish.

Check the demo and its javascript file for further usage.

##Events

* onDatabaseUpdated: (updatedKeys: Array<number>) => void;
    
will be called after the database was updated. The updated keys array will include the updated meshes' unique IDs.

##Methods
* countMeshes(countCallback: (count: number) => void): void

Will count the meshes and execute the provided callback with the mesh count.

* public getAllMeshes(callback: (meshes:Array<SerializedMesh>) => void): void

Will retrieve all (Serialized!) meshes from the database and send them with the callback provided.

##Database structure

In TypeScript:

```javascript
    export interface SerializedMesh {
        id: string;
        name: string;
        uniqueId: number;
        indices: Array<number>;
        positions: Array<number>;
        sphereCenter: Array<number>;
        sphereRadius: number;
        boxMinimum: Array<number>;
        boxMaximum: Array<number>;
        worldMatrixFromCache: any;
        subMeshes: Array<SerializedSubMesh>;
        checkCollisions: boolean;
    }

    export interface SerializedSubMesh {
        position: number;
        verticesStart: number;
        verticesCount: number;
        indexStart: number;
        indexCount: number;
    }
```

All stored in a single objectStore called "meshes".

##Notes
* The database will be completely deleted and recreated every time the page is loaded. 
* The mesh serialization will not reconstruct a mesh. Storing the normals, uvs, colors etc' is not yet available. This feature is coming soon.

##Suggestions?

If you need something specific please contact me. If I forgot anything, let me know!

##MIT License

Copyright (c) 2014-2015 Raanan Weber (info@raananweber.com)

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.


