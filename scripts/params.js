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