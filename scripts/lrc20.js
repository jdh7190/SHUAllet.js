const ticks = [{id:'bfd3bfe2d65a131e9792ee04a2da9594d9dc8741a7ab362c11945bfc368d2063_1',tick:'hodl'}]
const getTick4id = id => { return ticks.find(tick => tick.id === id).tick }
const lrc20Deploy = async(tick, max, lim, blocks, sats) => {
    const currentBlockHeight = await getBlock();
    const lockRawTx = createLockOutput(localStorage.walletAddress, (currentBlockHeight + 10), sats);
    const payload = {
        "p":"lrc-20",
        "op":"deploy",
        "tick":tick,
        "max":parseInt(max),
        "lim":parseInt(lim),
        "blocks":parseInt(blocks),
        "sats":parseInt(sats)
    }
    const rawtx = await inscribeTx(JSON.stringify(payload), 'application/json', null, localStorage.ownerAddress, lockRawTx);
    return rawtx;
}
const lrc20Mint = async(id, amt, address, blocks, sats) => {
    const currentBlockHeight = await getBlock();
    const lockRawTx = createLockOutput(localStorage.walletAddress,
        (currentBlockHeight + blocks + 10),
        sats);
    const payload = {"p":"lrc-20","op":"mint","id":id,"amt":parseInt(amt)}
    const rawtx = await inscribeTx(JSON.stringify(payload), 'application/json', null, address, lockRawTx);
    return rawtx;
}
const getLRC20Utxos = async(address = localStorage) => {
    const utxos = await (await fetch(`${LRC_20_API_URL}/lrcutxos?address=${address}`)).json();
    return utxos;
}
const getLRC20Balance = async(address = localStorage.ownerAddress, id, utxos = []) => {
    try {
        if (!utxos.length) {
            utxos = await getLRC20Utxos(address);
        }
        const ticks = Array.from(new Set(utxos.map(utxo => utxo.tick)));
        let arr = [];
        for (let tick of ticks) {
            const ts = utxos.filter(utxo => utxo.tick === tick);
            const balance = sumSats(ts);
            document.getElementById('tokenBalance').innerText = `${tick}: ${balance}`;
            arr.push({tick,balance})
        }
        return id ? arr.filter(b => b.id === id) : arr;
    } catch(e) {
        console.log(e);
    }
}
const addLRC20TransferOutput = async(id, amt, address, templateRawTx = null) => {
    const payload = {"p":"lrc-20","op":"transfer","id":id,"amt":parseInt(amt)}
    const rawtx = await inscribeTx(JSON.stringify(payload), 'application/json', null, address, templateRawTx);
    return rawtx;
}
const cancelLRC20 = async outpoint => {
    const inscription = await (await fetch(`https://ordinals.gorillapool.io/api/inscriptions/${outpoint}?script=true`)).json();
    const rawtx = await addLRC20TransferOutput(inscription.data.insc.json.id, inscription.data.insc.json.amt, localStorage.ownerAddress);
    const lrc20Utxo = {
        satoshis: inscription.satoshis,
        vout: parseInt(inscription.idx),
        txid: outpoint.slice(0,64),
        script: base64ToHex(inscription.script)
    }
    const sendutxos = [lrc20Utxo];
    const paymentUtxos = await getPaymentUTXOs(localStorage.walletAddress, 1);
    const paymentSatoshis = paymentUtxos.reduce(((t, e) => t + e.satoshis), 0)
    let bsvtx = bsv.Transaction(rawtx).from([...sendutxos, paymentUtxos]);
    const inputSatoshis = paymentSatoshis + sendutxos.length;
    const txFee = parseInt(((bsvtx._estimateSize() + P2PKH_INPUT_SIZE) * FEE_FACTOR)) + 1;
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
const sendLRC20 = async(id, amt, toAddress, payoutAddress, satoshisPayout) => {
    try {
        const address = localStorage.ownerAddress;
        if (!id) { id = ticks.find(tick => tick.tick === 'hodl').id }
        const utxos = await getLRC20Utxos(address);
        const b = await getLRC20Balance(localStorage.ownerAddress, null, utxos);
        console.log(b)
        const curamt = b[0].balance;
        console.log({curamt}, utxos)
        const tick = getTick4id(id);
        if (amt > curamt) throw `Insufficient balance ${amt} for tick ${tick}`;
        let utxoamt = 0;
        let sendutxos = [];
        for (let utxo of utxos) {
            utxoamt += utxo.amt;
            const ordUtxo = {
                txid: utxo.txid,
                vout: utxo.vout,
                script: utxo.script,
                satoshis: 1
            }
            sendutxos.push(ordUtxo);
            if (utxoamt >= amt) break;
        }
        let rawtx;
        if (payoutAddress && satoshisPayout) {
            const scr = createListingScript(localStorage.ownerKey, payoutAddress, satoshisPayout);
            const listingTemplate = bsv.Script.fromASM(scr);
            const sendPayload = {"p":"lrc-20","op":"transfer","id":id,"amt":parseInt(amt)};
            const listingScr = addInscription(listingTemplate, JSON.stringify(sendPayload), 'application/json');
            rawtx = bsv.Transaction().addOutput(new bsv.Transaction.Output({ script: listingScr, satoshis: 1 })).toString();
        } else {
            rawtx = await addLRC20TransferOutput(id, amt, toAddress);
        }
        if (amt < utxoamt) {
            rawtx = await addLRC20TransferOutput(id, parseInt(utxoamt - amt), localStorage.ownerAddress, rawtx);
        }
        const paymentUtxos = await getPaymentUTXOs(localStorage.walletAddress, 1);
        const paymentSatoshis = paymentUtxos.reduce(((t, e) => t + e.satoshis), 0)
        let bsvtx = bsv.Transaction(rawtx).from([...sendutxos, paymentUtxos]);
        const inputSatoshis = paymentSatoshis + sendutxos.length;
        const txFee = parseInt(((bsvtx._estimateSize() + P2PKH_INPUT_SIZE) * FEE_FACTOR)) + 1;
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
const buyLRC20 = async outpoint => {
    const inscription = await (await fetch(`https://ordinals.gorillapool.io/api/inscriptions/${outpoint}?script=true`)).json();
    const listingIdx = parseInt(outpoint.split('_')[1]);
    const rawtx = await addLRC20TransferOutput(inscription.data.insc.json.id, inscription.data.insc.json.amt, localStorage.ownerAddress);
    const lrc20Utxo = {
        satoshis: inscription.satoshis,
        vout: listingIdx,
        txid: outpoint.slice(0,64),
        script: base64ToHex(inscription.script)
    }
    const sendutxos = [lrc20Utxo];
    const lockingScriptASM = bsv.Script(lrc20Utxo.script).toASM();
    const payOutputHex = lockingScriptASM.split(' ')[6];
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
        listingIdx,
        bsv.Script(lrc20Utxo.script),
        new bsv.crypto.BN(lrc20Utxo.satoshis))
    .toString('hex');
    const hexSendOutput = bsvtx.outputs[0].toBufferWriter().toBuffer().toString('hex');
    const hexChangeOutput = bsvtx.outputs.length > 2 ? bsvtx.outputs[2].toBufferWriter().toBuffer().toString('hex') : 'OP_0';
    const unlockingScript = bsv.Script.fromASM(`${hexSendOutput} ${hexChangeOutput} ${preimg} OP_0`);
    bsvtx.inputs[listingIdx].setScript(unlockingScript);
    bsvtx.from(paymentUtxos);
    let curIdx = 1;
    paymentUtxos.forEach(pUtxo => {
        bsvtx = signInput(bsvtx, pUtxo, localStorage.walletKey, curIdx);
        curIdx++;
    });
    return bsvtx.toString();
}
const postLRC20Tx = async(txid, rawtx) => {
    if (!rawtx) {
        rawtx = await getRawtx(txid);
    }
    const r = await fetch(`${LRC_20_API_URL}/postLrc20Tx`, {
        method: 'post',
        body: JSON.stringify({rawtx})
    })
    console.log(r);
}
const getOutpoint = outpoint => {
    const [txid, vout] = outpoint.split('_');
    const writer = bsv.encoding.BufferWriter();
    writer.writeUInt32LE(parseInt(vout));
    const b = writer.concat();
    const reversedHex = changeEndianness(txid);
    return `${reversedHex}${b.toString('hex')}`;
}