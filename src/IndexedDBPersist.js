/**
 * BabylonJS IndexedDB mesh synchronization
 *
 * Created by Raanan Weber (info@raananweber.com), MIT Licensed.
 */
var BABYLONX;
(function (BABYLONX) {
    var MeshSerialization = (function () {
        function MeshSerialization() {
        }
        MeshSerialization.SerializeMesh = function (mesh) {
            var submeshes = [];
            if (mesh.subMeshes) {
                submeshes = mesh.subMeshes.map(function (sm, idx) {
                    return {
                        position: idx,
                        verticesStart: sm.verticesStart,
                        verticesCount: sm.verticesCount,
                        indexStart: sm.indexStart,
                        indexCount: sm.indexCount
                    };
                });
            }
            mesh.getWorldMatrix();
            return {
                uniquId: mesh['uniqueId'],
                id: mesh.id,
                name: mesh.name,
                indices: mesh.getIndices(),
                positions: mesh.getVerticesData(BABYLON.VertexBuffer.PositionKind),
                sphereCenter: mesh.getBoundingInfo().boundingSphere.centerWorld.asArray(),
                sphereRadius: mesh.getBoundingInfo().boundingSphere.radiusWorld,
                boxMinimum: mesh.getBoundingInfo().boundingBox.minimumWorld.asArray(),
                boxMaximum: mesh.getBoundingInfo().boundingBox.maximumWorld.asArray(),
                worldMatrixFromCache: mesh.worldMatrixFromCache.asArray(),
                subMeshes: submeshes
            };
        };
        return MeshSerialization;
    })();
    BABYLONX.MeshSerialization = MeshSerialization;
    var IndexedDBPersist = (function () {
        /**
         * @param _scene {BABYLON.Scene} - the BabylonJS scene to be used.
         * @param processRegistered {boolean} - should already-registered nodes be processed by the extension. defaults to true.
         */
        function IndexedDBPersist(_scene, dbName, processRegistered) {
            var _this = this;
            if (dbName === void 0) { dbName = "babylonJsMeshes"; }
            if (processRegistered === void 0) { processRegistered = true; }
            this._scene = _scene;
            //temp
            this.uniqueIdCounter_ = 0;
            this.onMeshAdded = function (mesh, position) {
                mesh['uniqueId'] = _this.uniqueIdCounter_++;
                mesh.registerAfterWorldMatrixUpdate(_this.onMeshUpdated);
                var transaction = _this.indexedDb_.transaction([IndexedDBPersist.OBJECT_STORE_NAME], "readwrite");
                // Do something when all the data is added to the database.
                transaction.oncomplete = function (event) {
                    console.log("Adding done,", mesh.name);
                };
                transaction.onerror = function (event) {
                    // Don't forget to handle errors!
                };
                var objectStore = transaction.objectStore("meshes");
                objectStore.add(MeshSerialization.SerializeMesh(mesh), mesh['uniqueId']);
            };
            this.onMeshRemoved = function (mesh) {
                var transaction = _this.indexedDb_.transaction([IndexedDBPersist.OBJECT_STORE_NAME], "readwrite");
                // Do something when all the data is added to the database.
                transaction.oncomplete = function (event) {
                    console.log("removing done");
                };
                transaction.onerror = function (event) {
                    // Don't forget to handle errors!
                };
                var objectStore = transaction.objectStore("meshes");
                objectStore.delete(mesh['uniqueId']);
            };
            this.onMeshUpdated = function (mesh) {
                var transaction = _this.indexedDb_.transaction([IndexedDBPersist.OBJECT_STORE_NAME], "readwrite");
                // Do something when all the data is added to the database.
                transaction.oncomplete = function (event) {
                    console.log("updating done");
                };
                transaction.onerror = function (event) {
                    // Don't forget to handle errors!
                };
                var objectStore = transaction.objectStore("meshes");
                objectStore.put(mesh, mesh['uniqueId']);
            };
            this.openDatabase(dbName, 1, true, function (db) {
                _this.indexedDb_ = db;
                _this._scene['onNewMeshAdded'] = _this.onMeshAdded;
                _this._scene['onMeshRemoved'] = _this.onMeshRemoved;
                if (processRegistered) {
                    //register already-created meshes
                    _this._scene.meshes.forEach(function (node, index) {
                        _this.onMeshAdded(node, index);
                    });
                }
            });
        }
        IndexedDBPersist.prototype.openDatabase = function (dbName, dbVersion, deleteDatabase, successCallback) {
            if (deleteDatabase) {
                indexedDB.deleteDatabase(dbName);
            }
            var request = indexedDB.open(dbName, dbVersion);
            request.onerror = function (e) {
            };
            request.onsuccess = function (e) {
            };
            request.onupgradeneeded = function (event) {
                var openedDb = event.target['result'];
                var meshesObjectStore = openedDb.createObjectStore("meshes");
                meshesObjectStore.createIndex("uniqueId", "uniqueId", { unique: true });
                meshesObjectStore.createIndex("name", "name", { unique: false });
                meshesObjectStore.createIndex("id", "id", { unique: false });
                successCallback(openedDb);
            };
        };
        IndexedDBPersist.OBJECT_STORE_NAME = "meshes";
        return IndexedDBPersist;
    })();
    BABYLONX.IndexedDBPersist = IndexedDBPersist;
})(BABYLONX || (BABYLONX = {}));
//# sourceMappingURL=IndexedDBPersist.js.map