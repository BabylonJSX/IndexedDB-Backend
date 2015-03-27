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

    export class MeshSerialization {
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
            
            return {
                uniqueId: <number> mesh['uniqueId'],
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
            }
        }
    }

    export class IndexedDBPersist {

        private indexedDb_: IDBDatabase;

        public static OBJECT_STORE_NAME: string = "meshes";

        //to prevent too many locks
        public addUpdateList: { [n:number]: SerializedMesh; }//: Array<SerializedMesh>;
        public remvoeList: Array<number>;

        //temp
        private uniqueIdCounter_ = 0;

        public onDatabaseUpdated: (updatedKeys: Array<number>) => void;

        /**
         * @param _scene {BABYLON.Scene} - the BabylonJS scene to be used.
         * @param processRegistered {boolean} - should already-registered nodes be processed by the extension. defaults to true.
         */
        constructor(private _scene: BABYLON.Scene, dbName: string = "babylonJsMeshes", processRegistered: boolean = true) {
            this.addUpdateList = {};
            this.remvoeList = [];

            this.openDatabase(dbName, 1, true,(db: IDBDatabase) => {
                this.indexedDb_ = db;
                this._scene['onNewMeshAdded'] = this.onMeshAdded;
                this._scene['onMeshRemoved'] = this.onMeshRemoved;
                this._scene.registerAfterRender(this.processLists);
                if (processRegistered) {
                    //register already-created meshes
                    setTimeout(() => {
                        this._scene.meshes.forEach((node, index) => {
                            this.onMeshAdded(node, index);
                        });
                    });
                }
            });
            
        }

        private onMeshAdded = (mesh: BABYLON.AbstractMesh, position: number) => {
            mesh['uniqueId'] = this.uniqueIdCounter_++; 
            mesh.registerAfterWorldMatrixUpdate(this.onMeshUpdated);
            this.addUpdateList[<number> mesh['uniqueId']] = MeshSerialization.SerializeMesh(mesh);
        }

        private onMeshRemoved = (mesh: BABYLON.AbstractMesh) => {
            this.remvoeList.push(mesh['uniqueId']);
        }

        private onMeshUpdated = (mesh: BABYLON.AbstractMesh) => {
            this.addUpdateList[<number> mesh['uniqueId']] = MeshSerialization.SerializeMesh(mesh);
        }

        private processLists = () => {
            if (!this.indexedDb_) return;
            var updated: Array<number> = [];
            for (var property in this.addUpdateList) {
                if (this.addUpdateList.hasOwnProperty(property)) {
                    updated.push(parseInt(property));
                    this.processMeshAddedUpdated(this.addUpdateList[property]);
                    delete this.addUpdateList[property];
                }
            }
            while (this.remvoeList.length) {
                var toRemove = this.remvoeList.pop()
                updated.push(toRemove);
                this.processMeshRemoved(toRemove);
            }
            if (updated.length) {
                if (this.onDatabaseUpdated) {
                    this.onDatabaseUpdated(updated);
                }
            }
        }

        private processMeshAddedUpdated = (serializedMesh: SerializedMesh) => {
            
            var transaction = this.indexedDb_.transaction([IndexedDBPersist.OBJECT_STORE_NAME], "readwrite");
            transaction.oncomplete = function (event) {
                //console.debug("Adding done,", serializedMesh.name);
            };

            transaction.onerror = function (event) {
                console.log(event);
            };

            var objectStore = transaction.objectStore(IndexedDBPersist.OBJECT_STORE_NAME);
            //todo handle the request events
            objectStore.put(serializedMesh, serializedMesh.uniqueId);
        }

        private processMeshRemoved = (uniqueId: number) => {
            var transaction = this.indexedDb_.transaction([IndexedDBPersist.OBJECT_STORE_NAME], "readwrite");
            transaction.oncomplete = function (event) {
            };

            transaction.onerror = function (event) {
                console.log(event);
            };

            var objectStore = transaction.objectStore(IndexedDBPersist.OBJECT_STORE_NAME);
            //todo handle the request events
            objectStore.delete(uniqueId);
        }

        private openDatabase(dbName: string, dbVersion: number, deleteDatabase: boolean, successCallback: (db: IDBDatabase) => void) {
            if (deleteDatabase) {
                indexedDB.deleteDatabase(dbName);
            }
            var request = indexedDB.open(dbName, dbVersion);

            request.onerror = function (e: ErrorEvent) {
                console.log(e);
            }

            request.onsuccess = function (e: Event) {
                var openedDb = event.target['result'];
                successCallback(openedDb);
            }

            request.onupgradeneeded = function (event: IDBVersionChangeEvent) {
                var openedDb = event.target['result'];
                var meshesObjectStore = openedDb.createObjectStore(IndexedDBPersist.OBJECT_STORE_NAME/*, { autoIncrement: true }*/);
                meshesObjectStore.createIndex("uniqueId", "uniqueId", { unique: true });  
                meshesObjectStore.createIndex("name", "name", { unique: false }); 
                meshesObjectStore.createIndex("id", "id", { unique: false });
            }

        }

        public countMeshes(countCallback: (count: number) => void): void {
            if (!this.indexedDb_) return;
            var transaction = this.indexedDb_.transaction([IndexedDBPersist.OBJECT_STORE_NAME], "readonly");

            transaction.onerror = function (event) {
                console.log(event);
            };

            var objectStore = transaction.objectStore(IndexedDBPersist.OBJECT_STORE_NAME);
            var index = objectStore.index("uniqueId");
            var req = index.count();
            req.onsuccess = function (event) {
                countCallback(req.result);
            }
        }

        public getAllMeshes(callback: (meshes:Array<SerializedMesh>) => void) {
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
        }
    }

}