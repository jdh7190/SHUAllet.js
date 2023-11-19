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
const inscribeTx = async(data, mediaType, metaDataTemplate, toAddress) => {
    const bsvtx = bsv.Transaction();
    const inscriptionScript = buildInscription(toAddress, data, mediaType, metaDataTemplate);
    bsvtx.addOutput(bsv.Transaction.Output({ script: inscriptionScript, satoshis: 1 }));
    const paidRawTx = await payForRawTx(bsvtx.toString());
    return paidRawTx;
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
const bsv20Mint = async(tick, amt, address) => {
    const payload = {
        "p": "bsv-20",
        "op": "mint",
        "tick": tick,
        "amt": amt.toString()
    }
    const rawtx = await inscribeTx(JSON.stringify(payload), 'application/bsv-20', null, address);
    const t = await broadcast(rawtx);
    await indexerSubmit(t);
    return t;
}