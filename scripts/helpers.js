const base64ToArrayBuffer = base64 => {
    const binary_string = atob(base64);
    const bytes = new Uint8Array(binary_string.length);
    for (let i = 0; i < binary_string.length; i++)  { bytes[i] = binary_string.charCodeAt(i) }
    return bytes;
}
const getScriptPushData = data => {
    const b64 = btoa(data);
    const abuf = base64ToArrayBuffer(b64);
    return dataToBuf(abuf);
}
const base64ToHex = str => {
    const raw = atob(str);
    let result = '';
    for (let i = 0; i < raw.length; i++) {
      const hex = raw.charCodeAt(i).toString(16);
      result += (hex.length === 2 ? hex : '0' + hex);
    }
    return result;
}
const sleep = timeout => { return new Promise(resolve => setTimeout(resolve, timeout)) }