import {validateDirectory} from './model.mjs';
export class ConflictError extends Error {}
export const DATABASE_NAME='employee-directory-local-v1';

export async function openDirectory(seed) {
  const request=indexedDB.open(DATABASE_NAME,1);
  request.onupgradeneeded=()=>{
    request.result.createObjectStore('employees',{keyPath:'id'});
    request.result.createObjectStore('metadata',{keyPath:'key'});
  };
  const db=await new Promise((resolve,reject)=>{
    request.onerror=()=>reject(new Error('No se pudo abrir el almacenamiento del navegador.'));
    request.onblocked=()=>reject(new Error('Cierra otras pestañas del directorio e inténtalo de nuevo.'));
    request.onsuccess=()=>resolve(request.result);
  });
  db.onversionchange=()=>db.close();

  // No await inside request callbacks: all writes stay in the active transaction.
  function transact({transform,expectedRevision,initialize=false}={}) {
    return new Promise((resolve,reject)=>{
      const tx=db.transaction(['employees','metadata'],transform||initialize?'readwrite':'readonly');
      const employees=tx.objectStore('employees'),metadata=tx.objectStore('metadata');
      const all=employees.getAll(),state=metadata.get('state');
      let rows,meta,ready=0,result,failure;
      function prepare() {
        if (++ready!==2) return;
        try {
          if (!meta) {
            if (!initialize) throw new Error('No se encontró el estado del directorio. Recarga la página.');
            rows=validateDirectory(seed);meta={key:'state',revision:0};
            for (const row of rows) employees.put(row);
            metadata.put(meta);
          }
          if (transform) {
            if (expectedRevision!==meta.revision) throw new ConflictError('Hay cambios de otra pestaña. Recarga los datos antes de guardar.');
            rows=validateDirectory(transform(rows));
            employees.clear();
            for (const row of rows) employees.put(row);
            meta={key:'state',revision:meta.revision+1};metadata.put(meta);
          }
          result={employees:rows,revision:meta.revision};
        } catch(error) {failure=error;tx.abort();}
      }
      all.onsuccess=()=>{rows=all.result;prepare();};
      state.onsuccess=()=>{meta=state.result;prepare();};
      tx.oncomplete=()=>resolve(result);
      tx.onabort=()=>reject(failure || new Error('No se guardaron los cambios. Revisa el espacio o los permisos del navegador.'));
      tx.onerror=()=>{}; // The abort handler reports once and retains the previous transaction.
    });
  }
  await transact({initialize:true});
  return {
    read:()=>transact(),
    mutate:(transform,expectedRevision)=>transact({transform,expectedRevision}),
    close:()=>db.close()
  };
}
