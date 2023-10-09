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
const broadcast = async txhex => {
    const r = await (await fetch(`https://api.whatsonchain.com/v1/bsv/main/tx/raw`, {
        method: 'post',
        body: JSON.stringify({ txhex })
    })).json();
    return r;
}