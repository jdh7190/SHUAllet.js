const sumSats = arr => { return arr.reduce((a,b) => { return a + b.amt }, 0) }
const bsv20Mint = async(tick, amt, address) => {
    const payload = {"p": "bsv-20","op": "mint","tick": tick,"amt": amt.toString()}
    const rawtx = await inscribeTx(JSON.stringify(payload), 'application/bsv-20', null, address);
    return rawtx;
}
const getBSV20Balance = async(address = localStorage.ownerAddress, tick, utxos = []) => {
    try {
        if (!utxos.length) {
            utxos = await (await fetch(`https://ordinals.gorillapool.io/api/txos/address/${address}/unspent?limit=100&offset=0&bsv20=true&origins=false`)).json();
        }
        const bsv20s = utxos.map(utxo => utxo.data.bsv20);
        const ticks = Array.from(new Set(bsv20s.map(bsv20 => bsv20.tick)));
        let arr = [];
        for (let tick of ticks) {
            const ts = bsv20s.filter(bsv20 => bsv20.tick === tick);
            const balance = sumSats(ts);
            arr.push({tick,balance})
        }
        return tick ? arr.filter(b => b.tick === tick.toUpperCase()) : arr;
    } catch(e) {
        console.log(e);
    }
}
const addBSV20TransferOutput = async(tick, amt, address, templateRawTx = null) => {
    const payload = {"p":"bsv-20","op":"transfer","tick":tick,"amt":amt.toString()}
    const rawtx = await inscribeTx(JSON.stringify(payload), 'application/bsv-20', null, address, templateRawTx);
    return rawtx;
}
const sendBSV20 = async(tick, amt, toAddress) => {
    try {
        const address = localStorage.ownerAddress;
        const bu = await (await fetch(`https://ordinals.gorillapool.io/api/txos/address/${address}/unspent?limit=100&offset=0&bsv20=true&origins=false`)).json();
        const utxos = bu.filter(utxo => utxo.data.bsv20.tick === tick.toUpperCase());
        const curamt = (await getBSV20Balance(localStorage.ownerAddress, tick, utxos))[0].balance;
        if (amt > curamt) throw `Insufficient balance ${amt} for tick ${tick}`;
        let utxoamt = 0;
        let sendutxos = [];
        for (let utxo of utxos) {
            utxoamt += utxo.data.bsv20.amt;
            const raw = await getRawtx(utxo.txid);
            const ordUtxo = getUTXO(raw, utxo.vout);
            sendutxos.push(ordUtxo);
            if (utxoamt >= curamt) break;
        }
        let rawtx = await addBSV20TransferOutput(tick, amt, toAddress);
        if (amt < utxoamt) {
            rawtx = await addBSV20TransferOutput(tick, parseInt(utxoamt - amt), localStorage.ownerAddress, rawtx);
        }
        const paymentUtxos = await getPaymentUTXOs(localStorage.walletAddress, 1);
        const paymentSatoshis = paymentUtxos.reduce(((t, e) => t + e.satoshis), 0)
        let bsvtx = bsv.Transaction(rawtx).from([...sendutxos, paymentUtxos]);
        const inputSatoshis = paymentSatoshis + sendutxos.length;
        const txFee = parseInt(((bsvtx._estimateSize() + P2PKH_INPUT_SIZE) * FEE_FACTOR)) + 1;
        bsvtx.to(localStorage.walletAddress, inputSatoshis - 2 - txFee);
        let i = 0;
        for (let utxo of sendutxos) {
            bsvtx = signInput(bsvtx, utxo, localStorage.ownerKey, i);
            i++;
        }
        paymentUtxos.forEach(pUtxo => {
            bsvtx = signInput(bsvtx, pUtxo, localStorage.walletKey, i);
            i++;
        });
        return bsvtx.toString();
    } catch(e) {
        console.log(e);
        alert(e);
    }
}