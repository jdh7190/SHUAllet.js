var idb = indexedDB || mozIndexedDB || webkitIndexedDB || msIndexedDB;
const initSHUAlletDB = () => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('shuallet');
        request.onupgradeneeded = e => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains('utxos')) {
                db.createObjectStore('utxos', { keyPath: 'output' });
            }
            console.log(`upgrading to version ${e.newVersion}`);
        }
        request.onsuccess = e => { resolve(e.target.result) }
        request.onerror = e => {
            console.log('error', e);
            alert(e.target.error)
            reject(e);
        }
    })
}
const addUTXO = utxo => {
    if (idb) {
        const request = indexedDB.open('shuallet');
        request.onsuccess = e => {
            console.log('adding utxo...');
            let db = e.target.result;
            const tx = db.transaction('utxos', 'readwrite');
            const table = tx.objectStore('utxos');
            utxo.output = `${utxo.txid}_${utxo.vout}`;
            table.add(utxo);
        }
        request.onerror = e => { console.log('error', e) }
    }
}
const cachedUtxos = cb => {
    if (idb) {
        const request = indexedDB.open('shuallet');
        request.onsuccess = e => {
            db = e.target.result;
            const tx = db.transaction('utxos', 'readonly');
            const table = tx.objectStore('utxos');
            const utxos = table.getAll();
            utxos.onsuccess = e => {
                const utxos = e.target.result;
                return cb(utxos);
            }
        }
        request.onerror = e => { console.log('error', e) }
    } else { cb([]) }
}
const getCachedUTXOs = () => {
    return new Promise((resolve, reject) => { cachedUtxos(utxos => { utxos.length ? resolve(utxos) : resolve([]) }) })
}
const removeUtxo = (output, cb) => {
    if (idb) {
        const request = indexedDB.open('shuallet');
        request.onsuccess = e => {
            db = e.target.result;
            const tx = db.transaction('utxos', 'readwrite');
            const table = tx.objectStore('utxos');
            const utxos = table.delete(output);
            utxos.onsuccess = e => {
                const utxo = e;
                return cb(utxo);
            }
        }
        request.onerror = e => { console.log('error', e) }
    }
}
const deleteUTXO = output => {
    return new Promise((resolve, reject) => { removeUtxo(output, utxo => { utxo ? resolve(utxo) : resolve({}) }) })
}
const clearUTXOs = utxos => {
    if (idb) {
        const request = indexedDB.open('shuallet');
        request.onsuccess = e => {
            let db = e.target.result;
            console.log('success');
            const tx = db.transaction('utxos', 'readwrite');
            const store = tx.objectStore('utxos');
            const reqDelete = store.clear();
            reqDelete.onsuccess = e => {
                console.log("UTXO cache cleared.", e);
                utxos?.forEach(u => addUTXO(u))
            }
        }
        request.onerror = e => { console.log('error', e) }
    }
}