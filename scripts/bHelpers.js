const signPayload = (data, pkWIF, isLike = false) => {
    const arrops = data.getOps('utf8');
    let hexarrops = [];
    hexarrops.push('6a');
    if (isLike) { hexarrops.push('6a') }
    arrops.forEach(o => { hexarrops.push(str2Hex(o)) })
    if (isLike) { hexarrops.push('7c') }
    let hexarr = [], payload = [];
    if (pkWIF) {
        const b2sign = hexArrayToBSVBuf(hexarrops);
        const bsvPrivateKey = bsv.PrivateKey.fromWIF(pkWIF);
        const signature = bsvMessage.sign(b2sign.toString(), bsvPrivateKey);
        const address = bsvPrivateKey.toAddress().toString();
        payload = arrops.concat(['|', AIP_PROTOCOL_ADDRESS, 'BITCOIN_ECDSA', address, signature]);
    } else { payload = arrops }
    payload.forEach(p => { hexarr.push(str2Hex(p)) })
    return payload;
}
const str2Hex = str => {
    hex = unescape(encodeURIComponent(str)).split('').map(v => {return v.charCodeAt(0).toString(16).padStart(2,'0')}).join('');
    return hex;
}
const hex2Str = hex => {
    let str = '';
    for (let i = 0; i < hex.length; i += 2) {
        let v = parseInt(hex.substr(i, 2), 16);
        if (v) str += String.fromCharCode(v);
    }
    return str; 
}
const hexArrayToBSVBuf = arr => {
    const hexBuf = arrToBuf(arr);
    const decoded = new TextDecoder().decode(hexBuf);
    const str2sign = hex2Str(decoded);
    const abuf = strToArrayBuffer(str2sign);
    const bsvBuf = dataToBuf(abuf);
    return bsvBuf;
}
const arrToBuf = arr => {
    const msgUint8 = new TextEncoder().encode(arr);
    const decoded = new TextDecoder().decode(msgUint8);
    const value = decoded.replaceAll(',', '');
    return new TextEncoder().encode(value);
}
const strToArrayBuffer = binary_string => {
    const bytes = new Uint8Array( binary_string.length );
    for (let i = 0; i < binary_string.length; i++)  {bytes[i] = binary_string.charCodeAt(i) }
    return bytes;
}
const dataToBuf = arr => {
    const bufferWriter = bsv.encoding.BufferWriter();
    arr.forEach(a => { bufferWriter.writeUInt8(a) });
    return bufferWriter.toBuffer();
}
const getUTXO = (rawtx, idx) => {
    const bsvtx = new bsv.Transaction(rawtx);
    return {
        satoshis: bsvtx.outputs[idx].satoshis,
        vout: idx,
        txid: bsvtx.hash,
        script: bsvtx.outputs[idx].script.toHex()
    }
}
const addChangeOutput = (rawtx, address = localStorage.walletAddress) => {
    const bsvtx = bsv.Transaction(rawtx);
    const txFee = parseInt(((bsvtx._estimateSize() + P2PKH_INPUT_SIZE) * FEE_FACTOR)) + 1;
    const inputSatoshis = utxos.reduce(((t, e) => t + e.satoshis), 0);
    const outputSatoshis = bsvtx.outputs.reduce(((t, e) => t + e._satoshis), 0);
    bsvtx.to(address, inputSatoshis - outputSatoshis - txFee);
    return bsvtx.toString();
}
const getBSVPublicKey = pk => { return bsv.PublicKey.fromPrivateKey(bsv.PrivateKey.fromWIF(pk)) }
const getAddressFromPrivateKey = pk => { return bsv.PrivateKey.fromWIF(pk).toAddress().toString() }
const bPost = (rawtx, post, replyTxid, signPkWIF) => {
    const bsvtx = bsv.Transaction(rawtx);
    const p = replyTxid ? bSocial.reply(replyTxid) : bSocial.post();
    p.addText(post);
    const payload = signPkWIF ? signPayload(p, signPkWIF) : p.getOps('utf8');
    bsvtx.addSafeData(payload);
    return bsvtx.toString();
}
const bLike = (rawtx, likeTxid, emoji, signPkWIF) => {
    const bsvtx = bsv.Transaction(rawtx);
    const l = bSocial.like(likeTxid, emoji || '');
    const payload = signPkWIF ? signPayload(l, signPkWIF, true) : l.getOps('utf8');
    bsvtx.addSafeData(payload);
    return bsvtx.toString();
}