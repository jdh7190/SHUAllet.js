const getUTXOs = async address => {
    const r = await fetch(`https://api.whatsonchain.com/v1/bsv/main/address/${address}/unspent`);
    const res = await r.json();
    return res;
}
const between = (x, min, max) => { return x >= min && x <= max }
const getPaymentUTXOs = async(address, amount) => {
    const utxos = await getUTXOs(address);
    const addr = bsv.Address.fromString(address);
    const script = bsv.Script.fromAddress(addr);
    let cache = [], satoshis = 0;
    for (let utxo of utxos) {
        if (utxo.value > 1) {
            const foundUtxo = utxos.find(utxo => utxo.value >= amount + 2);
            if (foundUtxo) {
                return [{ satoshis: foundUtxo.value, vout: foundUtxo.tx_pos, txid: foundUtxo.tx_hash, script: script.toHex() }]
            }
            cache.push(utxo);
            if (amount) {
                satoshis = cache.reduce((a, curr) => { return a + curr.value }, 0);
                if (satoshis >= amount) {
                    return cache.map(utxo => {
                        return { satoshis: utxo.value, vout: utxo.tx_pos, txid: utxo.tx_hash, script: script.toHex() }
                    });
                }
                else if (satoshis === amount || between(amount, satoshis - P2PKH_INPUT_SIZE, satoshis + P2PKH_INPUT_SIZE)) {
                    return cache.map(utxo => {
                        return { satoshis: utxo.value, vout: utxo.tx_pos, txid: utxo.tx_hash, script: script.toHex() }
                    })
                }
            } else {
                return utxos.map(utxo => {
                    return { satoshis: utxo.value, vout: utxo.tx_pos, txid: utxo.tx_hash, script: script.toHex() }
                });
            }
        }
    }
    return [];
}
const getWalletBalance = async address => {
    if (!address) address = localStorage.walletAddress;
    const utxos = await getUTXOs(address);
    const balance = utxos.reduce(((t, e) => t + e.value), 0)
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
const initWallet = async() => {
    if (localStorage.walletAddress && document.getElementById('walletAddress')) {
        document.getElementById('walletAddress').innerText = localStorage?.walletAddress || '';
        document.getElementsByClassName('backup-wallet')[0].style.display = 'block';
        const balance = await getWalletBalance(localStorage.walletAddress);
        document.getElementById('walletBalance').innerText = `${balance / 100000000} BSV`;
    }
}
const setupWallet = async() => {
    if (!localStorage.walletKey) {
        const create = confirm(`Do you want to import an existing wallet?`);
        if (!create) {
            const paymentPk = newPK();
            const ownerPK = newPK();
            restoreWallet(ownerPK, paymentPk, true);
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
const restoreWallet = (oPK, pPk, newWallet) => {
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
    newWallet ? alert(`Wallet ${address} created!`) : alert(`Wallet ${address} restored!`);
    if (!newWallet) location.reload();
}
const payForRawTx = async rawtx => {
    const bsvtx = bsv.Transaction(rawtx);
    const satoshis = bsvtx.outputs.reduce(((t, e) => t + e._satoshis), 0);
    const txFee = parseInt(((bsvtx._estimateSize() + P2PKH_INPUT_SIZE) * FEE_FACTOR)) + 1;
    const utxos = await getPaymentUTXOs(localStorage.walletAddress, satoshis + txFee);
    if (!utxos.length) { throw `Insufficient funds` }
    bsvtx.from(utxos);
    const inputSatoshis = utxos.reduce(((t, e) => t + e.satoshis), 0);
    bsvtx.to(localStorage.walletAddress, inputSatoshis - satoshis - txFee);
    bsvtx.sign(bsv.PrivateKey.fromWIF(localStorage.walletKey));
    return bsvtx.toString();
}
const logout = () => {
    if (localStorage.walletKey) {
        const conf = confirm(`Are you sure you want to logout?

If so, please ensure your wallet is backed up first!`);
        if (!conf) return;
        localStorage.clear();
        location.reload();
    }
}
initWallet();