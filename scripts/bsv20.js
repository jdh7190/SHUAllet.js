const sumSats = arr => { return arr.reduce((a,b) => { return a + parseInt(b.amt) }, 0) }
const bsv20Mint = async(tick, amt, address) => {
    const payload = {"p": "bsv-20","op": "mint","tick": tick,"amt": amt.toString()}
    const rawtx = await inscribeTx(JSON.stringify(payload), 'application/bsv-20', null, address);
    return rawtx;
}
const bsv21Deploy = async(sym, amt, dec, icon, address) => {
    const payload = {"p":"bsv-20","op":"deploy+mint","sym":sym,"amt":amt.toString(),"dec":dec.toString(),"icon":icon};
    const rawtx = await inscribeTx(JSON.stringify(payload), 'application/bsv-20', null, address);
    return rawtx;
}
const getBSV20Balance = async(address = localStorage.ownerAddress, tick, utxos = []) => {
    try {
        if (!utxos?.length) {
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
const cancelBSV20 = async outpoint => {
    const inscription = await (await fetch(`https://ordinals.gorillapool.io/api/inscriptions/${outpoint}?script=true`)).json();
    const rawtx = await addBSV20TransferOutput(inscription.data.bsv20.tick, inscription.data.bsv20.amt, localStorage.ownerAddress);
    const bsv20Utxo = {
        satoshis: inscription.satoshis,
        vout: parseInt(inscription.idx),
        txid: outpoint.slice(0,64),
        script: base64ToHex(inscription.script)
    }
    const sendutxos = [bsv20Utxo];
    const paymentUtxos = await getPaymentUTXOs(localStorage.walletAddress, 1);
    const paymentSatoshis = paymentUtxos.reduce(((t, e) => t + e.satoshis), 0)
    let bsvtx = bsv.Transaction(rawtx).from([...sendutxos, paymentUtxos]);
    const inputSatoshis = paymentSatoshis + sendutxos.length;
    const txFee = parseInt(((bsvtx._estimateSize() + (P2PKH_INPUT_SIZE * bsvtx.inputs.length)) * FEE_FACTOR)) + 1;
    bsvtx.to(localStorage.walletAddress, inputSatoshis - 2 - txFee);
    let i = 0;
    for (let utxo of sendutxos) {
        bsvtx = signInput(bsvtx, utxo, localStorage.ownerKey, i, true);
        i++;
    }
    paymentUtxos.forEach(pUtxo => {
        bsvtx = signInput(bsvtx, pUtxo, localStorage.walletKey, i);
        i++;
    });
    return bsvtx.toString();
}
const sendBSV20 = async(tick, amt, toAddress, payoutAddress, satoshisPayout) => {
    try {
        const address = localStorage.ownerAddress;
        const bu = await (await fetch(`https://ordinals.gorillapool.io/api/txos/address/${address}/unspent?limit=3000&offset=0&bsv20=true&origins=false`)).json();
        let utxos = bu.filter(utxo => utxo.data.bsv20.tick === tick.toUpperCase());
        const curamt = (await getBSV20Balance(localStorage.ownerAddress, tick, utxos))[0].balance;
        if (amt > curamt) throw `Insufficient balance ${amt} for tick ${tick}`;
        let utxoamt = 0;
        let sendutxos = [];
        for (let utxo of utxos) {
            utxoamt += utxo.data.bsv20.amt;
            const raw = await getRawtx(utxo.txid);
            const ordUtxo = getUTXO(raw, utxo.vout);
            sendutxos.push(ordUtxo);
            if (utxoamt >= amt) break;
        }
        let rawtx;
        if (payoutAddress && satoshisPayout) {
            const scr = createListingScript(localStorage.ownerKey, payoutAddress, satoshisPayout);
            const listingTemplate = bsv.Script.fromASM(scr);
            const sendPayload = {"p":"bsv-20","op":"transfer","tick":tick,"amt":amt.toString()};
            const listingScr = addInscription(listingTemplate, JSON.stringify(sendPayload), 'application/bsv-20');
            rawtx = bsv.Transaction().addOutput(new bsv.Transaction.Output({ script: listingScr, satoshis: 1 })).toString();
        } else {
            rawtx = await addBSV20TransferOutput(tick, amt, toAddress);
        }
        if (amt < utxoamt) {
            rawtx = await addBSV20TransferOutput(tick, parseInt(utxoamt - amt), localStorage.ownerAddress, rawtx);
        }
        const paymentUtxos = await getPaymentUTXOs(localStorage.walletAddress, 1);
        const paymentSatoshis = paymentUtxos.reduce(((t, e) => t + e.satoshis), 0)
        let bsvtx = bsv.Transaction(rawtx).from([...sendutxos, paymentUtxos]);
        const inputSatoshis = paymentSatoshis + sendutxos.length;
        const txFee = parseInt(((bsvtx._estimateSize() + (P2PKH_INPUT_SIZE * bsvtx.inputs.length)) * FEE_FACTOR)) + 1;
        bsvtx.to(localStorage.walletAddress, inputSatoshis - bsvtx?.outputs?.length - txFee);
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
const buyBSV20 = async outpoint => {
    const inscription = await (await fetch(`https://ordinals.gorillapool.io/api/inscriptions/${outpoint}?script=true`)).json();
    const listingIdx = parseInt(outpoint.split('_')[1]);
    const rawtx = await addBSV20TransferOutput(inscription.data.bsv20.tick, inscription.data.bsv20.amt, localStorage.ownerAddress);
    const bsv20Utxo = {
        satoshis: inscription.satoshis,
        vout: listingIdx,
        txid: outpoint.slice(0,64),
        script: base64ToHex(inscription.script)
    }
    const sendutxos = [bsv20Utxo];
    const lockingScriptASM = bsv.Script(bsv20Utxo.script).toASM();
    let payOutputHex = lockingScriptASM.split(' ')[6];
    if (payOutputHex.includes('7b2270223a226273762d3230222c')) {
        payOutputHex = lockingScriptASM.split(' ')[14];
    }
    const br = bsv.encoding.BufferReader(payOutputHex);
    const payOutput = bsv.Transaction.Output.fromBufferReader(br);
    const paymentUtxos = await getPaymentUTXOs(localStorage.walletAddress, payOutput.satoshis);
    if (!paymentUtxos.length) { throw `Not enough satoshis ${payOutput.satoshis} to pay for listing.` }
    let bsvtx = bsv.Transaction(rawtx).from([...sendutxos]);
    bsvtx.addOutput(payOutput);
    const paymentSatoshis = paymentUtxos.reduce(((t, e) => t + e.satoshis), 0)
    const inputSatoshis = paymentSatoshis + sendutxos.length;
    const txFee = parseInt(((bsvtx._estimateSize() + P2PKH_INPUT_SIZE) * FEE_FACTOR)) + 1;
    bsvtx.to(localStorage.walletAddress, inputSatoshis - payOutput.satoshis - bsvtx?.outputs?.length - txFee);
    const preimg = bsv.Transaction.sighash.sighashPreimage(
        bsvtx,
        SIGHASH_ALL_ANYONECANPAY_FORKID,
        0,
        bsv.Script(bsv20Utxo.script),
        new bsv.crypto.BN(bsv20Utxo.satoshis))
    .toString('hex');
    const hexSendOutput = bsvtx.outputs[0].toBufferWriter().toBuffer().toString('hex');
    const hexChangeOutput = bsvtx.outputs.length > 2 ? bsvtx.outputs[2].toBufferWriter().toBuffer().toString('hex') : 'OP_0';
    const unlockingScript = bsv.Script.fromASM(`${hexSendOutput} ${hexChangeOutput} ${preimg} OP_0`);
    bsvtx.inputs[0].setScript(unlockingScript);
    bsvtx.from(paymentUtxos);
    let curIdx = 1;
    paymentUtxos.forEach(pUtxo => {
        bsvtx = signInput(bsvtx, pUtxo, localStorage.walletKey, curIdx);
        curIdx++;
    });
    return bsvtx.toString();
}