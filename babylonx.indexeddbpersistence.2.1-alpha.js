var BABYLONX;
(function (BABYLONX) {
    var BabylonSerialization = (function () {
        function BabylonSerialization() {
        }
        BabylonSerialization.SerializeMesh = function (mesh) {
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
            var geometryId = mesh.geometry ? mesh.geometry.id : null;
            return {
                uniqueId: mesh.uniqueId,
                id: mesh.id,
                name: mesh.name,
                geometryId: geometryId,
                sphereCenter: mesh.getBoundingInfo().boundingSphere.centerWorld.asArray(),
                sphereRadius: mesh.getBoundingInfo().boundingSphere.radiusWorld,
                boxMinimum: mesh.getBoundingInfo().boundingBox.minimumWorld.asArray(),
                boxMaximum: mesh.getBoundingInfo().boundingBox.maximumWorld.asArray(),
                worldMatrixFromCache: mesh.worldMatrixFromCache.asArray(),
                subMeshes: submeshes,
                checkCollisions: mesh.checkCollisions
            };
        };
        BabylonSerialization.SerializeGeometry = function (geometry) {
            return {
                id: geometry.id,
                positions: geometry.getVerticesData(BABYLON.VertexBuffer.PositionKind),
                normals: geometry.getVerticesData(BABYLON.VertexBuffer.NormalKind),
                indices: geometry.getIndices(),
                uvs: geometry.getVerticesData(BABYLON.VertexBuffer.UVKind)
            };
        };
        return BabylonSerialization;
    })();
    BABYLONX.BabylonSerialization = BabylonSerialization;
    var IndexedDBPersist = (function () {
        function IndexedDBPersist(_scene, dbName, processRegistered) {
            var _this = this;
            if (dbName === void 0) { dbName = "babylonJsMeshes"; }
            if (processRegistered === void 0) { processRegistered = true; }
            this._scene = _scene;
            this.processing = false;
            this._onMeshAdded = function (mesh) {
                mesh.registerAfterWorldMatrixUpdate(_this._onMeshUpdated);
                _this._addUpdateList[mesh.uniqueId] = BabylonSerialization.SerializeMesh(mesh);
            };
            this._onMeshRemoved = function (mesh) {
                _this._remvoeList.push(mesh.uniqueId);
            };
            this._onMeshUpdated = function (mesh) {
                _this._addUpdateList[mesh.uniqueId] = BabylonSerialization.SerializeMesh(mesh);
            };
            this._onGeometryAdded = function (geometry) {
                geometry.onGeometryUpdated = _this._onGeometryUpdated;
                _this._addUpdateListGeometries[geometry.id] = BabylonSerialization.SerializeGeometry(geometry);
            };
            this._onGeometryRemoved = function (geometry) {
                _this._removeListGeometries.push(geometry.id);
            };
            this._onGeometryUpdated = function (geometry) {
                _this._addUpdateListGeometries[geometry.id] = BabylonSerialization.SerializeGeometry(geometry);
            };
            this._processLists = function () {
                if (!_this._indexedDb || _this.processing)
                    return;
                _this.processing = true;
                _this._processDatabaseUpdate(function (updatedMeshes, updatedGeometries) {
                    if (updatedMeshes.length || updatedGeometries.length) {
                        if (_this.onDatabaseUpdated) {
                            _this.onDatabaseUpdated(updatedMeshes, updatedGeometries);
                        }
                    }
                    _this.processing = false;
                });
            };
            this._processDatabaseUpdate = function (callback) {
                var transaction = _this._indexedDb.transaction([IndexedDBPersist.MESHES_OBJECT_STORE_NAME, IndexedDBPersist.GEOMETRIES_OBJECT_STORE_NAME], "readwrite");
                var updatedMeshes = [];
                var updatedGeometries = [];
                transaction.oncomplete = function (event) {
                    callback(updatedMeshes, updatedGeometries);
                };
                transaction.onerror = function (event) {
                    console.log(event);
                };
                var meshObjectStore = transaction.objectStore(IndexedDBPersist.MESHES_OBJECT_STORE_NAME);
                var geometriesObjectStore = transaction.objectStore(IndexedDBPersist.GEOMETRIES_OBJECT_STORE_NAME);
                for (var uniqueId in _this._addUpdateList) {
                    if (_this._addUpdateList.hasOwnProperty(uniqueId)) {
                        updatedMeshes.push(parseInt(uniqueId));
                        meshObjectStore.put(_this._addUpdateList[uniqueId], _this._addUpdateList[uniqueId].uniqueId);
                        delete _this._addUpdateList[uniqueId];
                    }
                }
                for (var id in _this._addUpdateListGeometries) {
                    if (_this._addUpdateListGeometries.hasOwnProperty(id)) {
                        updatedGeometries.push(id);
                        geometriesObjectStore.put(_this._addUpdateListGeometries[id], id);
                        delete _this._addUpdateListGeometries[id];
                    }
                }
                while (_this._remvoeList.length) {
                    var toRemove = _this._remvoeList.pop();
                    updatedMeshes.push(toRemove);
                    meshObjectStore.delete(toRemove);
                }
                while (_this._removeListGeometries.length) {
                    var gToRemove = _this._removeListGeometries.pop();
                    updatedGeometries.push(gToRemove);
                    geometriesObjectStore.delete(gToRemove);
                }
            };
            this._processMeshesAddedUpdatedBatch = function (callback) {
                var transaction = _this._indexedDb.transaction([IndexedDBPersist.MESHES_OBJECT_STORE_NAME], "readwrite");
                var updatedMeshes = [];
                transaction.oncomplete = function (event) {
                    callback(updatedMeshes);
                };
                transaction.onerror = function (event) {
                    console.log(event);
                };
                var objectStore = transaction.objectStore(IndexedDBPersist.MESHES_OBJECT_STORE_NAME);
                for (var uniqueId in _this._addUpdateList) {
                    if (_this._addUpdateList.hasOwnProperty(uniqueId)) {
                        updatedMeshes.push(parseInt(uniqueId));
                        objectStore.put(_this._addUpdateList[uniqueId], _this._addUpdateList[uniqueId].uniqueId);
                        delete _this._addUpdateList[uniqueId];
                    }
                }
            };
            this._processMeshAddedUpdated = function (serializedMesh) {
                console.time("" + serializedMesh.uniqueId);
                var transaction = _this._indexedDb.transaction([IndexedDBPersist.MESHES_OBJECT_STORE_NAME], "readwrite");
                transaction.oncomplete = function (event) {
                    console.timeEnd("" + serializedMesh.uniqueId);
                };
                transaction.onerror = function (event) {
                    console.log(event);
                };
                var objectStore = transaction.objectStore(IndexedDBPersist.MESHES_OBJECT_STORE_NAME);
                objectStore.put(serializedMesh, serializedMesh.uniqueId);
            };
            this._processMeshRemoved = function (uniqueId) {
                var transaction = _this._indexedDb.transaction([IndexedDBPersist.MESHES_OBJECT_STORE_NAME], "readwrite");
                transaction.oncomplete = function (event) {
                };
                transaction.onerror = function (event) {
                    console.log(event);
                };
                var objectStore = transaction.objectStore(IndexedDBPersist.MESHES_OBJECT_STORE_NAME);
                objectStore.delete(uniqueId);
            };
            this.processGeometryAddedUpdated = function (serializedGeometry) {
                var transaction = _this._indexedDb.transaction([IndexedDBPersist.GEOMETRIES_OBJECT_STORE_NAME], "readwrite");
                transaction.oncomplete = function (event) {
                };
                transaction.onerror = function (event) {
                    console.log(event);
                };
                var objectStore = transaction.objectStore(IndexedDBPersist.GEOMETRIES_OBJECT_STORE_NAME);
                objectStore.put(serializedGeometry, serializedGeometry.id);
            };
            this._processGeometryRemoved = function (id) {
                var transaction = _this._indexedDb.transaction([IndexedDBPersist.GEOMETRIES_OBJECT_STORE_NAME], "readwrite");
                transaction.oncomplete = function (event) {
                };
                transaction.onerror = function (event) {
                    console.log(event);
                };
                var objectStore = transaction.objectStore(IndexedDBPersist.GEOMETRIES_OBJECT_STORE_NAME);
                objectStore.delete(id);
            };
            this._addUpdateList = {};
            this._addUpdateListGeometries = {};
            this._remvoeList = [];
            this._removeListGeometries = [];
            this._openDatabase(dbName, 1, true, function (db) {
                _this._indexedDb = db;
                _this._scene.onNewMeshAdded = _this._onMeshAdded;
                _this._scene.onMeshRemoved = _this._onMeshRemoved;
                _this._scene.onGeometryAdded = _this._onGeometryAdded;
                _this._scene.onGeometryRemoved = _this._onGeometryRemoved;
                _this._scene.registerAfterRender(_this._processLists);
                if (processRegistered) {
                    setTimeout(function () {
                        _this._scene.meshes.forEach(function (node) {
                            _this._onMeshAdded(node);
                        });
                        _this._scene.getGeometries().forEach(function (geometry) {
                            _this._onGeometryAdded(geometry);
                        });
                    });
                }
            });
        }
        IndexedDBPersist.prototype._openDatabase = function (dbName, dbVersion, deleteDatabase, successCallback) {
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
                var meshesObjectStore = openedDb.createObjectStore(IndexedDBPersist.MESHES_OBJECT_STORE_NAME);
                meshesObjectStore.createIndex("uniqueId", "uniqueId", { unique: true });
                var geometriesObjectStore = openedDb.createObjectStore(IndexedDBPersist.GEOMETRIES_OBJECT_STORE_NAME);
                geometriesObjectStore.createIndex("id", "id", { unique: true });
            };
        };
        IndexedDBPersist.prototype.countMeshes = function (countCallback) {
            if (!this._indexedDb)
                return;
            var transaction = this._indexedDb.transaction([IndexedDBPersist.MESHES_OBJECT_STORE_NAME], "readonly");
            transaction.onerror = function (event) {
                console.log(event);
            };
            var objectStore = transaction.objectStore(IndexedDBPersist.MESHES_OBJECT_STORE_NAME);
            var index = objectStore.index("uniqueId");
            var req = index.count();
            req.onsuccess = function (event) {
                countCallback(req.result);
            };
        };
        IndexedDBPersist.prototype.getAllMeshes = function (callback) {
            var trans = this._indexedDb.transaction([IndexedDBPersist.MESHES_OBJECT_STORE_NAME]);
            var store = trans.objectStore(IndexedDBPersist.MESHES_OBJECT_STORE_NAME);
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
        IndexedDBPersist.MESHES_OBJECT_STORE_NAME = "meshes";
        IndexedDBPersist.GEOMETRIES_OBJECT_STORE_NAME = "geometries";
        return IndexedDBPersist;
    })();
    BABYLONX.IndexedDBPersist = IndexedDBPersist;
})(BABYLONX || (BABYLONX = {}));
