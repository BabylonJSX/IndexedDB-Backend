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
            return {
                uniqueId: mesh['uniqueId'],
                id: mesh.id,
                name: mesh.name,
                indices: mesh.getIndices(),
                positions: mesh.getVerticesData(BABYLON.VertexBuffer.PositionKind),
                sphereCenter: mesh.getBoundingInfo().boundingSphere.centerWorld.asArray(),
                sphereRadius: mesh.getBoundingInfo().boundingSphere.radiusWorld,
                boxMinimum: mesh.getBoundingInfo().boundingBox.minimumWorld.asArray(),
                boxMaximum: mesh.getBoundingInfo().boundingBox.maximumWorld.asArray(),
                worldMatrixFromCache: mesh.worldMatrixFromCache.asArray(),
                subMeshes: submeshes,
                checkCollisions: mesh.checkCollisions
            };
        };
        return MeshSerialization;
    })();
    BABYLONX.MeshSerialization = MeshSerialization;
    var IndexedDBPersist = (function () {
        function IndexedDBPersist(_scene, dbName, processRegistered) {
            var _this = this;
            if (dbName === void 0) { dbName = "babylonJsMeshes"; }
            if (processRegistered === void 0) { processRegistered = true; }
            this._scene = _scene;
            this.uniqueIdCounter_ = 0;
            this.onMeshAdded = function (mesh, position) {
                mesh.registerAfterWorldMatrixUpdate(_this.onMeshUpdated);
                _this.addUpdateList[mesh['uniqueId']] = MeshSerialization.SerializeMesh(mesh);
            };
            this.onMeshRemoved = function (mesh) {
                _this.remvoeList.push(mesh['uniqueId']);
            };
            this.onMeshUpdated = function (mesh) {
                _this.addUpdateList[mesh['uniqueId']] = MeshSerialization.SerializeMesh(mesh);
            };
            this.processLists = function () {
                if (!_this.indexedDb_)
                    return;
                var updated = [];
                for (var property in _this.addUpdateList) {
                    if (_this.addUpdateList.hasOwnProperty(property)) {
                        updated.push(parseInt(property));
                        _this.processMeshAddedUpdated(_this.addUpdateList[property]);
                        delete _this.addUpdateList[property];
                    }
                }
                while (_this.remvoeList.length) {
                    var toRemove = _this.remvoeList.pop();
                    updated.push(toRemove);
                    _this.processMeshRemoved(toRemove);
                }
                if (updated.length) {
                    if (_this.onDatabaseUpdated) {
                        _this.onDatabaseUpdated(updated);
                    }
                }
            };
            this.processMeshAddedUpdated = function (serializedMesh) {
                var transaction = _this.indexedDb_.transaction([IndexedDBPersist.OBJECT_STORE_NAME], "readwrite");
                transaction.oncomplete = function (event) {
                };
                transaction.onerror = function (event) {
                    console.log(event);
                };
                var objectStore = transaction.objectStore(IndexedDBPersist.OBJECT_STORE_NAME);
                objectStore.put(serializedMesh, serializedMesh.uniqueId);
            };
            this.processMeshRemoved = function (uniqueId) {
                var transaction = _this.indexedDb_.transaction([IndexedDBPersist.OBJECT_STORE_NAME], "readwrite");
                transaction.oncomplete = function (event) {
                };
                transaction.onerror = function (event) {
                    console.log(event);
                };
                var objectStore = transaction.objectStore(IndexedDBPersist.OBJECT_STORE_NAME);
                objectStore.delete(uniqueId);
            };
            this.addUpdateList = {};
            this.remvoeList = [];
            this.openDatabase(dbName, 1, true, function (db) {
                _this.indexedDb_ = db;
                _this._scene['onNewMeshAdded'] = _this.onMeshAdded;
                _this._scene['onMeshRemoved'] = _this.onMeshRemoved;
                _this._scene.registerAfterRender(_this.processLists);
                if (processRegistered) {
                    setTimeout(function () {
                        _this._scene.meshes.forEach(function (node, index) {
                            _this.onMeshAdded(node, index);
                        });
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
                console.log(e);
            };
            request.onsuccess = function (e) {
                var openedDb = event.target['result'];
                successCallback(openedDb);
            };
            request.onupgradeneeded = function (event) {
                var openedDb = event.target['result'];
                var meshesObjectStore = openedDb.createObjectStore(IndexedDBPersist.OBJECT_STORE_NAME);
                meshesObjectStore.createIndex("uniqueId", "uniqueId", { unique: true });
                meshesObjectStore.createIndex("name", "name", { unique: false });
                meshesObjectStore.createIndex("id", "id", { unique: false });
            };
        };
        IndexedDBPersist.prototype.countMeshes = function (countCallback) {
            if (!this.indexedDb_)
                return;
            var transaction = this.indexedDb_.transaction([IndexedDBPersist.OBJECT_STORE_NAME], "readonly");
            transaction.onerror = function (event) {
                console.log(event);
            };
            var objectStore = transaction.objectStore(IndexedDBPersist.OBJECT_STORE_NAME);
            var index = objectStore.index("uniqueId");
            var req = index.count();
            req.onsuccess = function (event) {
                countCallback(req.result);
            };
        };
        IndexedDBPersist.prototype.getAllMeshes = function (callback) {
            var trans = this.indexedDb_.transaction([IndexedDBPersist.OBJECT_STORE_NAME]);
            var store = trans.objectStore(IndexedDBPersist.OBJECT_STORE_NAME);
            var meshes = [];
            trans.oncomplete = function (evt) {
                callback(meshes);
            };
            var cursorRequest = store.openCursor();
            cursorRequest.onerror = function (error) {
                console.log(error);
            };
            cursorRequest.onsuccess = function (evt) {
                var cursor = evt.target['result'];
                if (cursor) {
                    meshes.push(cursor.value);
                    cursor.continue();
                }
            };
        };
        IndexedDBPersist.OBJECT_STORE_NAME = "meshes";
        return IndexedDBPersist;
    })();
    BABYLONX.IndexedDBPersist = IndexedDBPersist;
})(BABYLONX || (BABYLONX = {}));
