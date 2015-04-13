/**
 * BabylonJS IndexedDB mesh synchronization 
 * 
 * Created by Raanan Weber (info@raananweber.com), MIT Licensed.
 */

module BABYLONX {

    export interface SerializedMesh {
        id: string;
        name: string;
        uniqueId: number;
        geometryId: string;
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

    export interface SerializedGeometry {
        id: string;
        positions: Float32Array;
        indices: Int32Array;
        normals: Float32Array;
        uvs?: Float32Array;
    }

    export class BabylonSerialization {
        public static SerializeMesh = function (mesh: BABYLON.AbstractMesh) : SerializedMesh {
            var submeshes = [];
            if (mesh.subMeshes) {
                submeshes = mesh.subMeshes.map(function (sm, idx) {
                    return {
                        position: idx,
                        verticesStart: sm.verticesStart,
                        verticesCount: sm.verticesCount,
                        indexStart: sm.indexStart,
                        indexCount: sm.indexCount
                    }
                });
            }

            var geometryId = (<BABYLON.Mesh>mesh).geometry ? (<BABYLON.Mesh>mesh).geometry.id : null;
            
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
            }
        }

        public static SerializeGeometry = function (geometry: BABYLON.Geometry): SerializedGeometry {
            return {
                id: geometry.id,
                positions: new Float32Array(geometry.getVerticesData(BABYLON.VertexBuffer.PositionKind) || []),
                normals: new Float32Array(geometry.getVerticesData(BABYLON.VertexBuffer.NormalKind) || []),
                indices: new Int32Array(geometry.getIndices() || []),
                uvs: new Float32Array(geometry.getVerticesData(BABYLON.VertexBuffer.UVKind) || [])
            }
        }
    }

    export class IndexedDBPersist {

        private _indexedDb: IDBDatabase;

        public static MESHES_OBJECT_STORE_NAME: string = "meshes";
        public static GEOMETRIES_OBJECT_STORE_NAME: string = "geometries";

        //to prevent too many locks
        private _addUpdateList: { [n: number]: SerializedMesh; }//: Array<SerializedMesh>;
        private _addUpdateListGeometries: { [s: string]: SerializedGeometry; };
        private _remvoeList: Array<number>;
        private _removeListGeometries: Array<string>;

        private processing: boolean = false;
        
        public onDatabaseUpdated: (updatedMeshesUniqueIds: Array<number>, updatedGeometriesIds: Array<string>) => void;

        /**
         * @param _scene {BABYLON.Scene} - the BabylonJS scene to be used.
         * @param processRegistered {boolean} - should already-registered nodes be processed by the extension. defaults to true.
         */
        constructor(private _scene: BABYLON.Scene, dbName: string = "babylonJsMeshes", processRegistered: boolean = true) {
            this._addUpdateList = {};
            this._addUpdateListGeometries = {};
            this._remvoeList = [];
            this._removeListGeometries = [];
            

            this._openDatabase(dbName, 1, true,(db: IDBDatabase) => {
                this._indexedDb = db;
                this._scene.onNewMeshAdded = this._onMeshAdded;
                this._scene.onMeshRemoved = this._onMeshRemoved;
                this._scene.onGeometryAdded = this._onGeometryAdded;
                this._scene.onGeometryRemoved = this._onGeometryRemoved;
                this._scene.registerAfterRender(this._processLists);
                if (processRegistered) {
                    //register already-created meshes and geometries
                    setTimeout(() => {
                        this._scene.meshes.forEach((node) => {
                            this._onMeshAdded(node);
                        });
                        this._scene.getGeometries().forEach((geometry) => {
                            this._onGeometryAdded(geometry);
                        });
                    });
                }
            });
             
        }

        private _onMeshAdded = (mesh: BABYLON.AbstractMesh) => {
            mesh.registerAfterWorldMatrixUpdate(this._onMeshUpdated);
            this._onMeshUpdated(mesh);
        }

        private _onMeshRemoved = (mesh: BABYLON.AbstractMesh) => {
            this._remvoeList.push(mesh.uniqueId);
        }

        private _onMeshUpdated = (mesh: BABYLON.AbstractMesh) => {
            this._addUpdateList[mesh.uniqueId] = BabylonSerialization.SerializeMesh(mesh);
        }

        private _onGeometryAdded = (geometry: BABYLON.Geometry) => {
            geometry.onGeometryUpdated = this._onGeometryUpdated;
            this._onGeometryUpdated(geometry);
        }

        private _onGeometryRemoved = (geometry: BABYLON.Geometry) => {
            this._removeListGeometries.push(geometry.id);
        }

        private _onGeometryUpdated = (geometry: BABYLON.Geometry) => {
            this._addUpdateListGeometries[geometry.id] = BabylonSerialization.SerializeGeometry(geometry);
        }

        private _processLists = () => {
            if (!this._indexedDb || this.processing) return;
            this.processing = true;
            this._processDatabaseUpdate((updatedMeshes, updatedGeometries) => {
                if (updatedMeshes.length || updatedGeometries.length) {
                    if (this.onDatabaseUpdated) {
                        this.onDatabaseUpdated(updatedMeshes, updatedGeometries);
                    }
                }
                this.processing = false;
            });
        }

        private _processDatabaseUpdate = (callback: (updatedMeshesUniqueIds: Array<number>, updatedGeometriesIds: Array<string>) => void) => {
            var transaction = this._indexedDb.transaction([IndexedDBPersist.MESHES_OBJECT_STORE_NAME, IndexedDBPersist.GEOMETRIES_OBJECT_STORE_NAME], "readwrite");
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

            for (var uniqueId in this._addUpdateList) {
                if (this._addUpdateList.hasOwnProperty(uniqueId)) {
                    updatedMeshes.push(parseInt(uniqueId));
                    meshObjectStore.put(this._addUpdateList[uniqueId], this._addUpdateList[uniqueId].uniqueId);
                    delete this._addUpdateList[uniqueId];
                }
            }
            for (var id in this._addUpdateListGeometries) {
                if (this._addUpdateListGeometries.hasOwnProperty(id)) {
                    updatedGeometries.push(id);
                    geometriesObjectStore.put(this._addUpdateListGeometries[id], id);
                    delete this._addUpdateListGeometries[id];
                }
            }
            while (this._remvoeList.length) {
                var toRemove = this._remvoeList.pop()
                updatedMeshes.push(toRemove);
                meshObjectStore.delete(toRemove);
            }
            while (this._removeListGeometries.length) {
                var gToRemove = this._removeListGeometries.pop()
                updatedGeometries.push(gToRemove);
                geometriesObjectStore.delete(gToRemove);
            }
        }

        private _processMeshesAddedUpdatedBatch = (callback: (updatedMeshes: Array<number>) => void) => {
            var transaction = this._indexedDb.transaction([IndexedDBPersist.MESHES_OBJECT_STORE_NAME], "readwrite");
            var updatedMeshes = []
            transaction.oncomplete = function (event) {
                callback(updatedMeshes);
            };

            transaction.onerror = function (event) {
                console.log(event);
                
            };

            var objectStore = transaction.objectStore(IndexedDBPersist.MESHES_OBJECT_STORE_NAME);

            for (var uniqueId in this._addUpdateList) {
                if (this._addUpdateList.hasOwnProperty(uniqueId)) {
                    updatedMeshes.push(parseInt(uniqueId));
                    objectStore.put(this._addUpdateList[uniqueId], this._addUpdateList[uniqueId].uniqueId);
                    delete this._addUpdateList[uniqueId];
                }
            }

            //todo handle the request events
            //objectStore.put(serializedMesh, serializedMesh.uniqueId);
        }

        private _processMeshAddedUpdated = (serializedMesh: SerializedMesh) => {
            console.time("" + serializedMesh.uniqueId);
            var transaction = this._indexedDb.transaction([IndexedDBPersist.MESHES_OBJECT_STORE_NAME], "readwrite");
            transaction.oncomplete = function (event) {
                //console.debug("Adding done,", serializedMesh.name);
                console.timeEnd("" + serializedMesh.uniqueId);
            };

            transaction.onerror = function (event) {
                console.log(event);
            };

            var objectStore = transaction.objectStore(IndexedDBPersist.MESHES_OBJECT_STORE_NAME);
            //todo handle the request events
            objectStore.put(serializedMesh, serializedMesh.uniqueId);
        }

        private _processMeshRemoved = (uniqueId: number) => {
            var transaction = this._indexedDb.transaction([IndexedDBPersist.MESHES_OBJECT_STORE_NAME], "readwrite");
            transaction.oncomplete = function (event) {
            };

            transaction.onerror = function (event) {
                console.log(event);
            };

            var objectStore = transaction.objectStore(IndexedDBPersist.MESHES_OBJECT_STORE_NAME);
            //todo handle the request events
            objectStore.delete(uniqueId);
        }

        private processGeometryAddedUpdated = (serializedGeometry: SerializedGeometry) => {

            var transaction = this._indexedDb.transaction([IndexedDBPersist.GEOMETRIES_OBJECT_STORE_NAME], "readwrite");
            transaction.oncomplete = function (event) {
                //console.debug("Adding done,", serializedMesh.name);
            };

            transaction.onerror = function (event) {
                console.log(event);
            };

            var objectStore = transaction.objectStore(IndexedDBPersist.GEOMETRIES_OBJECT_STORE_NAME);
            //todo handle the request events
            objectStore.put(serializedGeometry, serializedGeometry.id);
        }

        private _processGeometryRemoved = (id: string) => {
            var transaction = this._indexedDb.transaction([IndexedDBPersist.GEOMETRIES_OBJECT_STORE_NAME], "readwrite");
            transaction.oncomplete = function (event) {
            };

            transaction.onerror = function (event) {
                console.log(event);
            };

            var objectStore = transaction.objectStore(IndexedDBPersist.GEOMETRIES_OBJECT_STORE_NAME);
            //todo handle the request events
            objectStore.delete(id);
        }

        private _openDatabase(dbName: string, dbVersion: number, deleteDatabase: boolean, successCallback: (db: IDBDatabase) => void) {
            if (deleteDatabase) {
                indexedDB.deleteDatabase(dbName);
            }
            var request = indexedDB.open(dbName, dbVersion);

            request.onerror = function (e: ErrorEvent) {
                console.log(e);
            }

            request.onsuccess = function (event: Event) {
                var openedDb = event.target['result'];
                successCallback(openedDb);
            }

            request.onupgradeneeded = function (event: IDBVersionChangeEvent) {
                var openedDb = event.target['result'];
                var meshesObjectStore = openedDb.createObjectStore(IndexedDBPersist.MESHES_OBJECT_STORE_NAME);
                meshesObjectStore.createIndex("uniqueId", "uniqueId", { unique: true });
                var geometriesObjectStore = openedDb.createObjectStore(IndexedDBPersist.GEOMETRIES_OBJECT_STORE_NAME);
                geometriesObjectStore.createIndex("id", "id", { unique: true });
            }

        }

        public countMeshes(countCallback: (count: number) => void): void {
            if (!this._indexedDb) return;
            var transaction = this._indexedDb.transaction([IndexedDBPersist.MESHES_OBJECT_STORE_NAME], "readonly");

            transaction.onerror = function (event) {
                console.log(event);
            };

            var objectStore = transaction.objectStore(IndexedDBPersist.MESHES_OBJECT_STORE_NAME);
            var index = objectStore.index("uniqueId");
            var req = index.count();
            req.onsuccess = function (event) {
                countCallback(req.result);
            }
        }

        public getAllMeshes(callback: (meshes:Array<SerializedMesh>) => void) {
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
        }
    }

}