const B_PROTOCOL_ADDRESS = '19HxigV4QyBv3tHpQVcUEQyq1pzZVdoAut';
const MAP_PROTOCOL_ADDRESS = '1PuQa7K62MiKCtssSLKy1kh56WWU7MtUR5';
const AIP_PROTOCOL_ADDRESS = '15PciHG22SNLQJXMoSUaWVi7WSqc7hCfva';
const BAP_PROTOCOL_ADDRESS = '1BAPSuaPnfGnSBM3GLV9yhxUdYe4vGbdMT';
const BPP_PROTOCOL_ADDRESS = 'BPP';
const P2PKH_SIGSCRIPT_SIZE = 1 + 73 + 1 + 33;
const P2PKH_OUTPUT_SIZE = 8 + 1 + 1 + 1 + 1 + 20 + 1 + 1;
const P2PKH_INPUT_SIZE = 36 + 1 + P2PKH_SIGSCRIPT_SIZE + 4;
const PUB_KEY_SIZE = 66;
const FEE_PER_KB = 1;
const FEE_FACTOR = (FEE_PER_KB / 1000); // 1 satoshi per Kilobyte
const SIGHASH_ALL_FORKID = bsv.crypto.Signature.SIGHASH_ALL | bsv.crypto.Signature.SIGHASH_FORKID;
const SIGHASH_SINGLE_ANYONECANPAY_FORKID = bsv.crypto.Signature.SIGHASH_SINGLE | bsv.crypto.Signature.SIGHASH_ANYONECANPAY | bsv.crypto.Signature.SIGHASH_FORKID;
const SIGHASH_ALL_ANYONECANPAY_FORKID = bsv.crypto.Signature.SIGHASH_ALL | bsv.crypto.Signature.SIGHASH_ANYONECANPAY | bsv.crypto.Signature.SIGHASH_FORKID;
const getAddressFromPaymail = async paymail => {
    const r = await fetch(`https://api.polynym.io/getAddress/${paymail}`);
    const { address } = await r.json();
    return address;
}
const getBlock = async() => {
    const r = await fetch(`https://api.whatsonchain.com/v1/bsv/main/chain/info`);
    const res = await r.json();
    return res?.blocks;
}
const getRawtx = async txid => {
    const r = await fetch(`https://api.whatsonchain.com/v1/bsv/main/tx/${txid}/hex`);
    const raw = await r.text();
    return raw;
}
const broadcast = async(txhex, cacheUTXOs = false, address = null) => {
    const r = await (await fetch(`https://api.whatsonchain.com/v1/bsv/main/tx/raw`, {
        method: 'post',
        body: JSON.stringify({ txhex })
    })).json();
    if (r && cacheUTXOs && address !== null) {
        const sp = spent(txhex);
        const utxos = extractUTXOs(rawtx, address);
        console.log('Deleting spent UTXOs....', sp);
        sp.forEach(utxo => { deleteUTXO(`${utxo.txid}_${utxo.vout}`) })
        utxos.forEach(utxo => addUTXO(utxo))
    }
    return r;
}
const sleep = timeout => { return new Promise(resolve => setTimeout(resolve, timeout)) }
class BSocial {
    constructor(appName) {
      if (!appName) throw new Error('App name needs to be set');
      this.appName = appName;
    }
  
    post() {
      return new BSocialPost(this.appName);
    }
  
    repost(txId) {
      const post = new BSocialPost(this.appName);
      post.setType('repost');
      post.setTxId(txId);
      return post;
    }
  
    reply(txId) {
      const post = new BSocialPost(this.appName);
      post.setTxId(txId);
      return post;
    }
  
    paywall(paywallMessage, paywallKey, paywallPayouts, paywallServer, paywallCurrency = 'USD') {
      // This will throw if the key is not valid
      const privateKey = bsv.PrivateKey.fromWIF(paywallKey);
  
      const post = new BSocialPost(this.appName);
      post.setPaywall(paywallMessage, privateKey, paywallPayouts, paywallServer, paywallCurrency);
  
      return post;
    }
  
    like(txId, emoji = '') {
      const like = new BSocialLike(this.appName);
      like.setTxId(txId);
      if (emoji) {
        like.setEmoji(emoji);
      }
  
      return like;
    }
  
    tip(txId, amount = 0, currency = 'USD') {
      const tip = new BSocialTip(this.appName);
      tip.setTxId(txId);
      if (amount && currency) {
        tip.setAmount(amount, currency);
      }
  
      return tip;
    }
  
    follow(idKey) {
      const follow = new BSocialFollow(this.appName);
      follow.setIdKey(idKey);
  
      return follow;
    }
  
    unfollow(idKey) {
      const follow = new BSocialFollow(this.appName);
      follow.setIdKey(idKey);
  
      follow.setAction('unfollow');
  
      return follow;
    }
}
class BSocialPost {
    constructor(appName) {
      if (!appName) throw new Error('App name needs to be set');
      this.appName = appName;
      this.type = 'post';
      this.txId = '';
  
      this.texts = [];
      this.images = [];
  
      this.extraMapData = {};
    }
  
    setType(type) {
      this.type = type;
    }
  
    setTxId(txId) {
      this.txId = txId;
    }
  
    addMapData(key, value) {
      if (typeof key !== 'string' || typeof value !== 'string') {
        throw new Error('Key and value should be a string');
      }
      this.extraMapData[key] = value;
    }
  
    addText(text, type = 'text/markdown') {
      if (typeof text !== 'string') throw new Error('Text should be a string');
  
      this.texts.push({
        text,
        type,
      });
    }
  
    addMarkdown(markdown) {
      this.addText(markdown);
    }
  
    addImage(dataUrl) {
      const image = dataUrl.split(',');
      const meta = image[0].split(';');
      const type = meta[0].split(':');
  
      if (type[0] !== 'data' || meta[1] !== 'base64' || !type[1].match('image/')) {
        throw new Error('Invalid image dataUrl format');
      }
  
      const img = atob(image[1]);
      this.images.push({
        content: img,
        type: type[1],
      });
    }
  
    getOps(format = 'hex') {
      // check for texts or images content
      const hasContent = this.texts.length > 0 || this.images.length > 0;
      const isRepost = this.type === 'repost' && this.txId;
      if (!hasContent && !isRepost) {
        throw new Error('There is no content for this post');
      }
  
      const ops = [];
  
      if (this.texts.length > 0) {
        this.texts.forEach((t) => {
          ops.push(B_PROTOCOL_ADDRESS); // B
          ops.push(t.text);
          ops.push(t.type);
          ops.push('UTF-8');
          ops.push('|');
        });
      }
  
      if (this.images.length > 0) {
        this.images.forEach((image) => {
          // image.content is in dataUrl format
          ops.push(B_PROTOCOL_ADDRESS); // B
          ops.push(image.content);
          ops.push(image.type);
          ops.push('|');
        });
      }
  
      ops.push(MAP_PROTOCOL_ADDRESS); // MAP
      ops.push('SET');
      ops.push('app');
      ops.push(this.appName);
      ops.push('type');
      ops.push(this.type);
  
      if (this.txId) {
        // reply
        if (this.type !== 'repost') {
          // a repost does not need the context set
          ops.push('context');
          ops.push('tx');
        }
        ops.push('tx');
        ops.push(this.txId);
      }
  
      const extraMapData = Object.keys(this.extraMapData);
      if (extraMapData.length) {
        extraMapData.forEach((key) => {
          ops.push(key);
          ops.push(this.extraMapData[key]);
        });
      }
  
      return ops.map(op => {
        return op.toString(format);
      });
    }
}
class BSocialLike {
    constructor(appName) {
      if (!appName) throw new Error('App name needs to be set');
      this.appName = appName;
      this.txId = '';
      this.emoji = '';
    }
  
    setTxId(txId) {
      this.txId = txId;
    }
  
    setEmoji(emoji) {
      if (typeof emoji !== 'string' || !emoji.match(/\p{Emoji}/gu)) {
        throw new Error('Invalid emoji');
      }
      this.emoji = emoji;
    }
  
    getOps(format = 'hex') {
      if (!this.txId) throw new Error('Like is not referencing a valid transaction');
  
      const ops = [];
      ops.push(MAP_PROTOCOL_ADDRESS); // MAP
      ops.push('SET');
      ops.push('app');
      ops.push(this.appName);
      ops.push('type');
      ops.push('like');
      ops.push('context');
      ops.push('tx');
      ops.push('tx');
      ops.push(this.txId);
  
      if (this.emoji) {
        ops.push('emoji');
        ops.push(this.emoji);
      }
  
      return ops.map(op => {
        return op.toString(format);
      });
    }
}
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
    idx = parseInt(idx);
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
const LOCKUP_PREFIX = `97dfd76851bf465e8f715593b217714858bbe9570ff3bd5e33840a34e20ff026 02ba79df5f8ae7604a9830f03c7933028186aede0675a16f025dc4f8be8eec0382 1008ce7480da41702918d1ec8e6849ba32b4d65b1e40dc669c31a1e6306b266c 0 0`;
const LOCKUP_SUFFIX = `OP_NOP 0 OP_PICK 0065cd1d OP_LESSTHAN OP_VERIFY 0 OP_PICK OP_4 OP_ROLL OP_DROP OP_3 OP_ROLL OP_3 OP_ROLL OP_3 OP_ROLL OP_1 OP_PICK OP_3 OP_ROLL OP_DROP OP_2 OP_ROLL OP_2 OP_ROLL OP_DROP OP_DROP OP_NOP OP_5 OP_PICK 41 OP_NOP OP_1 OP_PICK OP_7 OP_PICK OP_7 OP_PICK 0ac407f0e4bd44bfc207355a778b046225a7068fc59ee7eda43ad905aadbffc800 6c266b30e6a1319c66dc401e5bd6b432ba49688eecd118297041da8074ce0810 OP_9 OP_PICK OP_6 OP_PICK OP_NOP OP_6 OP_PICK OP_HASH256 0 OP_PICK OP_NOP 0 OP_PICK OP_1 OP_SPLIT OP_1 OP_SPLIT OP_1 OP_SPLIT OP_1 OP_SPLIT OP_1 OP_SPLIT OP_1 OP_SPLIT OP_1 OP_SPLIT OP_1 OP_SPLIT OP_1 OP_SPLIT OP_1 OP_SPLIT OP_1 OP_SPLIT OP_1 OP_SPLIT OP_1 OP_SPLIT OP_1 OP_SPLIT OP_1 OP_SPLIT OP_1 OP_SPLIT OP_1 OP_SPLIT OP_1 OP_SPLIT OP_1 OP_SPLIT OP_1 OP_SPLIT OP_1 OP_SPLIT OP_1 OP_SPLIT OP_1 OP_SPLIT OP_1 OP_SPLIT OP_1 OP_SPLIT OP_1 OP_SPLIT OP_1 OP_SPLIT OP_1 OP_SPLIT OP_1 OP_SPLIT OP_1 OP_SPLIT OP_1 OP_SPLIT OP_SWAP OP_CAT OP_SWAP OP_CAT OP_SWAP OP_CAT OP_SWAP OP_CAT OP_SWAP OP_CAT OP_SWAP OP_CAT OP_SWAP OP_CAT OP_SWAP OP_CAT OP_SWAP OP_CAT OP_SWAP OP_CAT OP_SWAP OP_CAT OP_SWAP OP_CAT OP_SWAP OP_CAT OP_SWAP OP_CAT OP_SWAP OP_CAT OP_SWAP OP_CAT OP_SWAP OP_CAT OP_SWAP OP_CAT OP_SWAP OP_CAT OP_SWAP OP_CAT OP_SWAP OP_CAT OP_SWAP OP_CAT OP_SWAP OP_CAT OP_SWAP OP_CAT OP_SWAP OP_CAT OP_SWAP OP_CAT OP_SWAP OP_CAT OP_SWAP OP_CAT OP_SWAP OP_CAT OP_SWAP OP_CAT OP_SWAP OP_CAT 00 OP_CAT OP_BIN2NUM OP_1 OP_ROLL OP_DROP OP_NOP OP_7 OP_PICK OP_6 OP_PICK OP_6 OP_PICK OP_6 OP_PICK OP_6 OP_PICK OP_NOP OP_3 OP_PICK OP_6 OP_PICK OP_4 OP_PICK OP_7 OP_PICK OP_MUL OP_ADD OP_MUL 414136d08c5ed2bf3ba048afe6dcaebafeffffffffffffffffffffffffffffff00 OP_1 OP_PICK OP_1 OP_PICK OP_NOP OP_1 OP_PICK OP_1 OP_PICK OP_MOD 0 OP_PICK 0 OP_LESSTHAN OP_IF 0 OP_PICK OP_2 OP_PICK OP_ADD OP_ELSE 0 OP_PICK OP_ENDIF OP_1 OP_ROLL OP_DROP OP_1 OP_ROLL OP_DROP OP_1 OP_ROLL OP_DROP OP_NOP OP_2 OP_ROLL OP_DROP OP_1 OP_ROLL OP_1 OP_PICK OP_1 OP_PICK OP_2 OP_DIV OP_GREATERTHAN OP_IF 0 OP_PICK OP_2 OP_PICK OP_SUB OP_2 OP_ROLL OP_DROP OP_1 OP_ROLL OP_ENDIF OP_3 OP_PICK OP_SIZE OP_NIP OP_2 OP_PICK OP_SIZE OP_NIP OP_3 OP_PICK 20 OP_NUM2BIN OP_1 OP_SPLIT OP_1 OP_SPLIT OP_1 OP_SPLIT OP_1 OP_SPLIT OP_1 OP_SPLIT OP_1 OP_SPLIT OP_1 OP_SPLIT OP_1 OP_SPLIT OP_1 OP_SPLIT OP_1 OP_SPLIT OP_1 OP_SPLIT OP_1 OP_SPLIT OP_1 OP_SPLIT OP_1 OP_SPLIT OP_1 OP_SPLIT OP_1 OP_SPLIT OP_1 OP_SPLIT OP_1 OP_SPLIT OP_1 OP_SPLIT OP_1 OP_SPLIT OP_1 OP_SPLIT OP_1 OP_SPLIT OP_1 OP_SPLIT OP_1 OP_SPLIT OP_1 OP_SPLIT OP_1 OP_SPLIT OP_1 OP_SPLIT OP_1 OP_SPLIT OP_1 OP_SPLIT OP_1 OP_SPLIT OP_1 OP_SPLIT OP_SWAP OP_CAT OP_SWAP OP_CAT OP_SWAP OP_CAT OP_SWAP OP_CAT OP_SWAP OP_CAT OP_SWAP OP_CAT OP_SWAP OP_CAT OP_SWAP OP_CAT OP_SWAP OP_CAT OP_SWAP OP_CAT OP_SWAP OP_CAT OP_SWAP OP_CAT OP_SWAP OP_CAT OP_SWAP OP_CAT OP_SWAP OP_CAT OP_SWAP OP_CAT OP_SWAP OP_CAT OP_SWAP OP_CAT OP_SWAP OP_CAT OP_SWAP OP_CAT OP_SWAP OP_CAT OP_SWAP OP_CAT OP_SWAP OP_CAT OP_SWAP OP_CAT OP_SWAP OP_CAT OP_SWAP OP_CAT OP_SWAP OP_CAT OP_SWAP OP_CAT OP_SWAP OP_CAT OP_SWAP OP_CAT OP_SWAP OP_CAT 20 OP_2 OP_PICK OP_SUB OP_SPLIT OP_NIP OP_4 OP_3 OP_PICK OP_ADD OP_2 OP_PICK OP_ADD 30 OP_1 OP_PICK OP_CAT OP_2 OP_CAT OP_4 OP_PICK OP_CAT OP_8 OP_PICK OP_CAT OP_2 OP_CAT OP_3 OP_PICK OP_CAT OP_2 OP_PICK OP_CAT OP_7 OP_PICK OP_CAT 0 OP_PICK OP_1 OP_ROLL OP_DROP OP_1 OP_ROLL OP_DROP OP_1 OP_ROLL OP_DROP OP_1 OP_ROLL OP_DROP OP_1 OP_ROLL OP_DROP OP_1 OP_ROLL OP_DROP OP_1 OP_ROLL OP_DROP OP_1 OP_ROLL OP_DROP OP_1 OP_ROLL OP_DROP OP_1 OP_ROLL OP_DROP OP_1 OP_ROLL OP_DROP OP_1 OP_ROLL OP_DROP OP_1 OP_ROLL OP_DROP OP_NOP 0 OP_PICK OP_7 OP_PICK OP_CHECKSIG OP_1 OP_ROLL OP_DROP OP_1 OP_ROLL OP_DROP OP_1 OP_ROLL OP_DROP OP_1 OP_ROLL OP_DROP OP_1 OP_ROLL OP_DROP OP_1 OP_ROLL OP_DROP OP_1 OP_ROLL OP_DROP OP_1 OP_ROLL OP_DROP OP_1 OP_ROLL OP_DROP OP_NOP OP_1 OP_ROLL OP_DROP OP_1 OP_ROLL OP_DROP OP_NOP OP_VERIFY OP_5 OP_PICK OP_NOP 0 OP_PICK OP_NOP 0 OP_PICK OP_SIZE OP_NIP OP_1 OP_PICK OP_1 OP_PICK OP_4 OP_SUB OP_SPLIT OP_DROP OP_1 OP_PICK OP_8 OP_SUB OP_SPLIT OP_NIP OP_1 OP_ROLL OP_DROP OP_1 OP_ROLL OP_DROP OP_NOP OP_NOP 0 OP_PICK 00 OP_CAT OP_BIN2NUM OP_1 OP_ROLL OP_DROP OP_NOP OP_1 OP_ROLL OP_DROP OP_NOP 0065cd1d OP_LESSTHAN OP_VERIFY OP_5 OP_PICK OP_NOP 0 OP_PICK OP_NOP 0 OP_PICK OP_SIZE OP_NIP OP_1 OP_PICK OP_1 OP_PICK 28 OP_SUB OP_SPLIT OP_DROP OP_1 OP_PICK 2c OP_SUB OP_SPLIT OP_NIP OP_1 OP_ROLL OP_DROP OP_1 OP_ROLL OP_DROP OP_NOP OP_NOP 0 OP_PICK 00 OP_CAT OP_BIN2NUM OP_1 OP_ROLL OP_DROP OP_NOP OP_1 OP_ROLL OP_DROP OP_NOP ffffffff00 OP_LESSTHAN OP_VERIFY OP_5 OP_PICK OP_NOP 0 OP_PICK OP_NOP 0 OP_PICK OP_SIZE OP_NIP OP_1 OP_PICK OP_1 OP_PICK OP_4 OP_SUB OP_SPLIT OP_DROP OP_1 OP_PICK OP_8 OP_SUB OP_SPLIT OP_NIP OP_1 OP_ROLL OP_DROP OP_1 OP_ROLL OP_DROP OP_NOP OP_NOP 0 OP_PICK 00 OP_CAT OP_BIN2NUM OP_1 OP_ROLL OP_DROP OP_NOP OP_1 OP_ROLL OP_DROP OP_NOP OP_2 OP_PICK OP_GREATERTHANOREQUAL OP_VERIFY OP_6 OP_PICK OP_HASH160 OP_1 OP_PICK OP_EQUAL OP_VERIFY OP_7 OP_PICK OP_7 OP_PICK OP_CHECKSIG OP_NIP OP_NIP OP_NIP OP_NIP OP_NIP OP_NIP OP_NIP OP_NIP`;
const bSocial = new BSocial('localLockTest');
const decimalToHex = d => {// helper function to convert integer to hex
    let h = d.toString(16);
    return h.length % 2 ? '0' + h : h;
}
const changeEndianness = string => {// change endianess of hex value before placing into ASM script
    const result = [];
    let len = string.length - 2;
    while (len >= 0) {
      result.push(string.substr(len, 2));
      len -= 2;
    }
    return result.join('');
}
const int2Hex = int => {
    const unreversedHex = decimalToHex(int);
    return changeEndianness(unreversedHex);
}
const hex2Int = hex => {
    const reversedHex = changeEndianness(hex);
    return parseInt(reversedHex, 16);
}
const createLockOutput = (address, blockHeight, satoshis, templateRawTx) => {
    let bsvtx;
    if (templateRawTx) { bsvtx = bsv.Transaction(templateRawTx) } else { bsvtx = bsv.Transaction() }
    const p2pkhOut = new bsv.Transaction.Output({script: bsv.Script(new bsv.Address(address)), satoshis: 1});
    const addressHex = p2pkhOut.script.chunks[2].buf.toString('hex');
    const nLockTimeHexHeight = int2Hex(blockHeight);
    const scriptTemplate = `${LOCKUP_PREFIX} ${addressHex} ${nLockTimeHexHeight} ${LOCKUP_SUFFIX}`;
    const lockingScript = bsv.Script.fromASM(scriptTemplate);
    bsvtx.addOutput(new bsv.Transaction.Output({script: lockingScript, satoshis}));
    return bsvtx.toString();
}
const lockPost = (address, blockHeight, satoshis, signPkWIF, post, replyTxid) => {
    const lockRawTx = createLockOutput(address, blockHeight, satoshis);
    const bPostTx = bPost(lockRawTx, post, replyTxid, signPkWIF);
    return bPostTx;
}
const lockLike = (address, blockHeight, satoshis, signPkWIF, likeTxid, emoji) => {
    const lockRawTx = createLockOutput(address, blockHeight, satoshis);
    const bLikeTx = bLike(lockRawTx, likeTxid, emoji, signPkWIF);
    return bLikeTx;
}
// build the solution to the locking script by constructing the pre image and signature
const unlockLockScript = (txHex, inputIndex, lockTokenScript, satoshis, privkey) => {
    const tx = new bsv.Transaction(txHex);
    const sighashType = bsv.crypto.Signature.SIGHASH_ALL | bsv.crypto.Signature.SIGHASH_FORKID;
    const scriptCode = bsv.Script.fromHex(lockTokenScript);
    const value = new bsv.crypto.BN(satoshis);
    // create preImage of current transaction with valid nLockTime
    const preimg = bsv.Transaction.sighash.sighashPreimage(tx, sighashType, inputIndex, scriptCode, value).toString('hex');
    let s;
    if (privkey) {// sign transaction with private key tied to public key locked in script
        s = bsv.Transaction.sighash.sign(tx, privkey, sighashType, inputIndex, scriptCode, value).toTxFormat();
    }
    return bsv.Script.fromASM(`${s.toString('hex')} ${privkey.toPublicKey().toHex()} ${preimg}`).toHex();
}
const unlockCoins = async(pkWIF, receiveAddress, txid, oIdx = 0) => {
    try {
        const rawtx = await getRawtx(txid);
        const lockedUTXO = getUTXO(rawtx, oIdx);
        const bsvtx = bsv.Transaction();
        const lockedScript = bsv.Script(lockedUTXO.script);
        bsvtx.addInput(new bsv.Transaction.Input({
            prevTxId: txid,
            outputIndex: oIdx,
            script: new bsv.Script()
        }), lockedScript, lockedUTXO.satoshis);
        const lockedBlockHex = lockedScript.chunks[6].buf.toString('hex');
        const lockedBlock = hex2Int(lockedBlockHex);
        bsvtx.lockUntilBlockHeight(lockedBlock);
        bsvtx.to(receiveAddress, lockedUTXO.satoshis === 1 ? 1 : lockedUTXO.satoshis - 1); // subtract 1 satoshi to pay the transaction fee
        const solution = unlockLockScript(bsvtx.toString(), oIdx, lockedUTXO.script, lockedUTXO.satoshis, bsv.PrivateKey.fromWIF(pkWIF))
        bsvtx.inputs[0].setScript(solution);
        return bsvtx.toString();
    } catch(e) { console.log(e) }
}
const spent = rawtx => {
    const tx = bsv.Transaction(rawtx);
    let utxos = [];
    tx.inputs.forEach(input => {
        let vout = input.outputIndex;
        let txid = input.prevTxId.toString('hex');
        utxos.push({txid, vout, output: `${txid}_${vout}`});
    });
    return utxos;
}
const extractUTXOs = (rawtx, addr) => {
    try {
        const tx = new bsv.Transaction(rawtx);
        let utxos = [], vout = 0;
        tx.outputs.forEach(output => {
            let satoshis = output.satoshis;
            let script = new bsv.Script.fromBuffer(output._scriptBuffer);
            if (script.isSafeDataOut()) { vout++; return }
            let pkh = bsv.Address.fromPublicKeyHash(script.getPublicKeyHash());
            let address = pkh.toString();
            if (address === addr) {
                utxos.push({satoshis, txid: tx.hash, vout, script: script.toHex()});
            }
            vout++;
        });
        return utxos;
    }
    catch(error) {
        console.log({error});
        return [];
    }
}
const normalizeUTXOs = utxos => {
    return utxos.map(utxo => {
        return {
            satoshis: utxo?.value || utxo?.satoshis,
            txid: utxo?.txid || utxo.tx_hash,
            vout: utxo.vout === undefined ? utxo.tx_pos : utxo.vout
        }
    })
}
const getUTXOs = async address => {
    const utxos = await getCachedUTXOs();
    if (!utxos.length) {
        console.log(`Calling WhatsOnChain UTXOs endpoint...`);
        const r = await fetch(`https://api.whatsonchain.com/v1/bsv/main/address/${address}/unspent`);
        const res = await r.json();
        return normalizeUTXOs(res);
    } else { return utxos }
}
const btUTXOs = async address => {
    const utxos = await getCachedUTXOs();
    if (!utxos.length) {
        console.log(`Calling Bitails UTXOs endpoint...`);
        const r = await fetch(`https://api.bitails.io/address/${address}/unspent`);
        const { unspent } = await r.json();
        return normalizeUTXOs(unspent);
    } else { return utxos }
}
const between = (x, min, max) => { return x >= min && x <= max }
const getPaymentUTXOs = async(address, amount) => {
    const utxos = await getUTXOs(address);
    const addr = bsv.Address.fromString(address);
    const script = bsv.Script.fromAddress(addr);
    let cache = [], satoshis = 0;
    for (let utxo of utxos) {
        if (utxo.satoshis > 1) {
            const foundUtxo = utxos.find(utxo => utxo.satoshis >= amount + 2);
            if (foundUtxo) {
                return [{ satoshis: foundUtxo.satoshis, vout: foundUtxo.vout, txid: foundUtxo.txid, script: script.toHex() }]
            }
            cache.push(utxo);
            if (amount) {
                satoshis = cache.reduce((a, curr) => { return a + curr.satoshis }, 0);
                if (satoshis >= amount) {
                    return cache.map(utxo => {
                        return { satoshis: utxo.satoshis, vout: utxo.vout, txid: utxo.txid, script: script.toHex() }
                    });
                }
            } else {
                return utxos.map(utxo => {
                    return { satoshis: utxo.satoshis, vout: utxo.vout, txid: utxo.txid, script: script.toHex() }
                });
            }
        }
    }
    return [];
}
const getWalletBalance = async(address = localStorage.walletAddress) => {
    const utxos = await getUTXOs(address);
    utxos.forEach(u => addUTXO(u));
    const balance = utxos.reduce(((t, e) => t + e.satoshis), 0)
    return balance; 
}
const fileUpload = document.getElementById('uploadFile');
if (fileUpload) {
    fileUpload.addEventListener('change', e => {
        const files = e.target.files;
        const file = files[0];
        const reader = new FileReader();
        reader.onload = e => {
            try {
                const json = JSON.parse(e?.target?.result);
                restoreWallet(json.ordPk, json.payPk)
            } catch(e) {
                console.log(e)
                alert(e);
                return;
            }
        }
        reader.readAsText(file);
    })
}
const setupWallet = async() => {
    if (!localStorage.walletKey) {
        const create = confirm(`Do you want to import an existing wallet?`);
        if (!create) {
            const paymentPk = newPK();
            const ownerPK = newPK();
            restoreWallet(ownerPK, paymentPk);
            alert(`Wallet created, click OK to download backup json file.`);
            backupWallet();
        } else { fileUpload.click() }
    } else { alert(`Please backup your wallet before logging out.`) }
}
const backupWallet = () => {
    const a = document.createElement('a');
    const obj = { ordPk: localStorage?.ownerKey, payPk: localStorage.walletKey };
    a.href = URL.createObjectURL( new Blob([JSON.stringify(obj)], { type: 'json' }))
    a.download = 'shuallet.json';
    a.click();
}
const sendBSV = async() => {
    try {
        const amt = prompt(`Enter satoshi amount to send:`);
        if (amt === null) return;
        const satoshis = parseInt(amt);
        if (!satoshis) { throw `Invalid amount` }
        const to = prompt(`Enter address to send BSV to:`);
        if (!to) { return }
        const addr = bsv.Address.fromString(to);
        if (addr) {
            const bsvtx = bsv.Transaction();
            bsvtx.to(addr, satoshis);
            const rawtx = await payForRawTx(bsvtx.toString());
            if (rawtx) {
                const c = confirm(`Send ${satoshis} satoshis to ${addr}?`);
                if (c) {
                    const t = await broadcast(rawtx);
                    alert(t);
                } else { return }
            } 
        }
    } catch(e) {
        console.log(e);
        alert(e);
    }
}
const newPK = () => {
    const pk = new bsv.PrivateKey();
    const pkWIF = pk.toWIF();
    return pkWIF;
}
const restoreWallet = (oPK, pPk) => {
    const pk = bsv.PrivateKey.fromWIF(pPk);
    const pkWif = pk.toString();
    const address = bsv.Address.fromPrivateKey(pk)
    const ownerPk = bsv.PrivateKey.fromWIF(oPK);
    localStorage.ownerKey = ownerPk.toWIF();
    const ownerAddress = bsv.Address.fromPrivateKey(ownerPk);
    localStorage.ownerAddress = ownerAddress.toString();
    localStorage.walletAddress = address.toString();
    localStorage.walletKey = pkWif;
    localStorage.ownerPublicKey = ownerPk.toPublicKey().toHex();
}
const payForRawTx = async rawtx => {
    const bsvtx = bsv.Transaction(rawtx);
    const satoshis = bsvtx.outputs.reduce(((t, e) => t + e._satoshis), 0);
    const txFee = parseInt(((bsvtx._estimateSize() + P2PKH_INPUT_SIZE) * FEE_FACTOR)) + 1;
    const utxos = await getPaymentUTXOs(localStorage.walletAddress, satoshis + txFee);
    if (!utxos.length) { throw `Insufficient funds` }
    bsvtx.from(utxos);
    bsvtx = bsv.Transaction(addChangeOutput(bsvtx.toString()));
    bsvtx.sign(bsv.PrivateKey.fromWIF(localStorage.walletKey));
    return bsvtx.toString();
}
const ORD_LOCK_PREFIX = '2097dfd76851bf465e8f715593b217714858bbe9570ff3bd5e33840a34e20ff0262102ba79df5f8ae7604a9830f03c7933028186aede0675a16f025dc4f8be8eec0382201008ce7480da41702918d1ec8e6849ba32b4d65b1e40dc669c31a1e6306b266c0000';
const ORD_LOCK_SUFFIX = '615179547a75537a537a537a0079537a75527a527a7575615579008763567901c161517957795779210ac407f0e4bd44bfc207355a778b046225a7068fc59ee7eda43ad905aadbffc800206c266b30e6a1319c66dc401e5bd6b432ba49688eecd118297041da8074ce081059795679615679aa0079610079517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e01007e81517a75615779567956795679567961537956795479577995939521414136d08c5ed2bf3ba048afe6dcaebafeffffffffffffffffffffffffffffff00517951796151795179970079009f63007952799367007968517a75517a75517a7561527a75517a517951795296a0630079527994527a75517a6853798277527982775379012080517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f517f7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e7c7e01205279947f7754537993527993013051797e527e54797e58797e527e53797e52797e57797e0079517a75517a75517a75517a75517a75517a75517a75517a75517a75517a75517a75517a75517a756100795779ac517a75517a75517a75517a75517a75517a75517a75517a75517a7561517a75517a756169587951797e58797eaa577961007982775179517958947f7551790128947f77517a75517a75618777777777777777777767557951876351795779a9876957795779ac777777777777777767006868';
const buildInscription = (address, data, mediaType, metadata) => {
    const bsvAddress = bsv.Address.fromString(address);
    const p2pkhScript = bsv.Script.buildPublicKeyHashOut(bsvAddress);
    const script = bsv.Script(p2pkhScript)
        .add('OP_0')
        .add('OP_IF')
        .add(getScriptPushData('ord'))
        .add('OP_1')
        .add(getScriptPushData(mediaType))
        .add('OP_0')
        .add(getScriptPushData(data))
        .add('OP_ENDIF');
    if (metadata && metadata?.app && metadata?.type) {
        script.add('OP_RETURN').add(getScriptPushData(MAP_PROTOCOL_ADDRESS)).add(getScriptPushData('SET'));
        for (const [key, value] of Object.entries(metadata)) {
            if (key !== "cmd") {
                script.add(getScriptPushData(key)).add(dataToBuf(getScriptPushData(value)))
            }
        }
    }
    return script;
}
const signInput = (bsvtx, utxo, pkWIF, idx, cancelListing = false) => {
    const script = bsv.Script(utxo.script);
    bsvtx.inputs[0].output = new bsv.Transaction.Output({satoshis: utxo.satoshis, script: utxo.script});
    const bsvPublicKey = getBSVPublicKey(pkWIF);
    const sig = bsv.Transaction.sighash.sign(bsvtx, bsv.PrivateKey.fromWIF(pkWIF), SIGHASH_ALL_FORKID,
        idx, script, new bsv.crypto.BN(utxo.satoshis));
    const unlockingScript = bsv.Script.buildPublicKeyHashIn(bsvPublicKey, sig.toDER(), SIGHASH_ALL_FORKID);
    if (cancelListing) { unlockingScript.add('OP_1') }
    bsvtx.inputs[idx].setScript(unlockingScript);
    return bsvtx;
}
const inscribeTx = async(data, mediaType, metaDataTemplate, toAddress, templateRawTx, pay = false) => {
    let bsvtx;
    if (templateRawTx) {
        bsvtx = bsv.Transaction(templateRawTx);
    } else {
        bsvtx = bsv.Transaction();
    }
    const inscriptionScript = buildInscription(toAddress, data, mediaType, metaDataTemplate);
    bsvtx.addOutput(bsv.Transaction.Output({ script: inscriptionScript, satoshis: 1 }));
    if (pay) {
        const paidRawTx = await payForRawTx(bsvtx.toString());
        return paidRawTx;
    } else { return bsvtx.toString() }
}
const sendInscription = async(txid, idx, ordPkWIF, payPkWIF, toAddress) => {
    let bsvtx = bsv.Transaction();
    const prevRawTx = await getRawtx(txid);
    const ordUtxo = getUTXO(prevRawTx, idx);
    const paymentAddress = getAddressFromPrivateKey(payPkWIF);
    const paymentUtxo = await getPaymentUTXOs(paymentAddress, 1);
    const utxos = [ordUtxo, paymentUtxo[0]];
    bsvtx.from(utxos);
    bsvtx.to(toAddress, 1);
    const inputSatoshis = utxos.reduce(((t, e) => t + e.satoshis), 0);
    bsvtx.to(paymentAddress, inputSatoshis - 1 - 1);
    bsvtx = signInput(bsvtx, utxos[0], ordPkWIF, 0);
    bsvtx = signInput(bsvtx, utxos[1], payPkWIF, 1);
    return bsvtx.toString();
}
const listOrdinal = async(txid, idx, payPkWIF, ordPkWIF, payoutAddress, satoshisPayout) => {
    let bsvtx = bsv.Transaction();
    const prevRawTx = await getRawtx(txid);
    const ordUtxo = getUTXO(prevRawTx, idx);
    const paymentAddress = getAddressFromPrivateKey(payPkWIF);
    const paymentUtxo = await getPaymentUTXOs(paymentAddress, 1);
    const utxos = [ordUtxo, paymentUtxo[0]];
    bsvtx.from(utxos);
    const payOutput = new bsv.Transaction.Output({
        script: bsv.Script(bsv.Address.fromString(payoutAddress)),
        satoshis: satoshisPayout
    })
    const hexPayOutput = payOutput.toBufferWriter().toBuffer().toString('hex');
    const ownerOutput = bsv.Transaction.Output({
        script: bsv.Script(bsv.Address.fromString(getAddressFromPrivateKey(ordPkWIF))),
        satoshis: 1
    });
    const addressHex = ownerOutput.script.chunks[2].buf.toString('hex');
    const ordLockHex = `${bsv.Script(ORD_LOCK_PREFIX).toASM()} ${addressHex} ${hexPayOutput} ${bsv.Script(ORD_LOCK_SUFFIX).toASM()}`;
    const ordLockScript = bsv.Script.fromASM(ordLockHex);
    bsvtx.addOutput(new bsv.Transaction.Output({ script: ordLockScript, satoshis: 1 }));
    const inputSatoshis = utxos.reduce(((t, e) => t + e.satoshis), 0);
    bsvtx.to(paymentAddress, inputSatoshis - 1 - 1);
    bsvtx = signInput(bsvtx, ordUtxo, ordPkWIF, 0);
    bsvtx = signInput(bsvtx, utxos[1], payPkWIF, 1);
    return bsvtx.toString();
}
const cancelListing = async(listingTxid, listingIdx, ordPkWIF, payPkWIF, toAddress, changeAddress) => {
    let bsvtx = bsv.Transaction();
    const prevRawTx = await getRawtx(listingTxid);
    const ordUtxo = getUTXO(prevRawTx, listingIdx);
    const paymentAddress = getAddressFromPrivateKey(payPkWIF);
    const paymentUtxo = await getPaymentUTXOs(paymentAddress, 1);
    const utxos = [ordUtxo, paymentUtxo[0]];
    bsvtx.from(utxos);
    bsvtx.to(toAddress, 1);
    const inputSatoshis = utxos.reduce(((t, e) => t + e.satoshis), 0);
    bsvtx.to(changeAddress, inputSatoshis - 1 - 1);
    bsvtx = signInput(bsvtx, ordUtxo, ordPkWIF, 0, true);
    bsvtx = signInput(bsvtx, utxos[1], payPkWIF, 1);
    return bsvtx.toString();
}
const buyListing = async(listingTxid, listingIdx, payPkWIF, toAddress, changeAddress = null, feeAddress = null, marketFeeRate = 0) => {
    let bsvtx = bsv.Transaction();
    const prevRawTx = await getRawtx(listingTxid);
    const ordUtxo = getUTXO(prevRawTx, listingIdx);
    const lockingScriptASM = bsv.Script(ordUtxo.script).toASM();
    const payOutputHex = lockingScriptASM.split(' ')[6];
    const br = bsv.encoding.BufferReader(payOutputHex);
    const payOutput = bsv.Transaction.Output.fromBufferReader(br);
    const paymentAddress = getAddressFromPrivateKey(payPkWIF);
    const paymentUtxos = await getPaymentUTXOs(paymentAddress, payOutput.satoshis);
    if (!paymentUtxos.length) { throw `Not enough satoshis ${payOutput.satoshis} to pay for listing.` }
    const utxos = [ordUtxo, ...paymentUtxos];
    bsvtx.from(ordUtxo);
    bsvtx.to(toAddress, 1);
    bsvtx.addOutput(payOutput);
    const marketFee = parseInt(payOutput.satoshis * marketFeeRate);
    const inputSatoshis = utxos.reduce(((t, e) => t + e.satoshis), 0);
    if (changeAddress === null) changeAddress = paymentAddress;
    const changeSatoshis = inputSatoshis - payOutput.satoshis - 2 - marketFee;
    if (changeSatoshis > 2) { // greater than 1 sat mining fee + ordinal output
        bsvtx.to(changeAddress, inputSatoshis - payOutput.satoshis - 2 - marketFee)
    }
    if (feeAddress !== null && marketFeeRate > 0) { bsvtx.to(feeAddress, marketFee) }
    const preimg = bsv.Transaction.sighash.sighashPreimage(
        bsvtx,
        SIGHASH_ALL_ANYONECANPAY_FORKID,
        listingIdx,
        bsv.Script(ordUtxo.script),
        new bsv.crypto.BN(ordUtxo.satoshis))
    .toString('hex');
    const hexSendOutput = bsvtx.outputs[0].toBufferWriter().toBuffer().toString('hex');
    const hexChangeOutput = changeAddress !== null ? bsvtx.outputs[2].toBufferWriter().toBuffer().toString('hex') : 'OP_0';
    const hexMarketFeeOutput = feeAddress !== null ? bsvtx.outputs[3].toBufferWriter().toBuffer().toString('hex') : '';
    const unlockingScript = bsv.Script.fromASM(`${hexSendOutput} ${hexChangeOutput}${hexMarketFeeOutput} ${preimg} OP_0`);
    bsvtx.inputs[listingIdx].setScript(unlockingScript);
    bsvtx.from(paymentUtxos);
    let curIdx = 1;
    paymentUtxos.forEach(pUtxo => {
        bsvtx = signInput(bsvtx, pUtxo, payPkWIF, curIdx);
        curIdx++;
    });
    return bsvtx.toString();
}
const indexerSubmit = async txid => {
    try {
        const rp = await fetch(`https://v3.ordinals.gorillapool.io/api/tx/${txid}/submit`, {method: 'post'});
        console.log(`Submitted ${txid} to indexer.`);
        return rp;
    } catch(e) {
        console.log(e);
        return {error:e};
    }
}