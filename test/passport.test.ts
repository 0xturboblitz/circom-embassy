import { describe } from 'mocha'
import { assert } from 'chai'
import { arraysAreEqual, bytesToBigDecimal, findTimeOfSignature, formatAndConcatenateDataHashes, formatMrz, hexToDecimal, parsePubKeyString, splitToWords, toBinaryString } from '../utils/utils'
import { groth16 } from 'snarkjs'
import { hash, toUnsignedByte } from '../utils/computeEContent'
import { DataHash, PassportData } from '../utils/types'
import * as forge from 'node-forge';
import { genSampleData } from '../utils/sampleData'
const fs = require('fs');

describe('Circuit tests', function () {
  this.timeout(0)

  let passportData: PassportData;

  this.beforeAll(async () => {
    if (fs.existsSync('inputs/passportData.json')) {
      passportData = require('../inputs/passportData.json');
    } else {
      passportData = (await genSampleData()) as PassportData;
      fs.mkdirSync('inputs');
      fs.writeFileSync('inputs/passportData.json', JSON.stringify(passportData));
    }
  })

  it('can prove and verify with valid inputs', async function () {
    const formattedMrz = formatMrz(passportData.mrz);
    const mrzHash = hash(formatMrz(passportData.mrz));
    const concatenatedDataHashes = formatAndConcatenateDataHashes(
      mrzHash,
      passportData.dataGroupHashes as DataHash[],
    );
    
    const concatenatedDataHashesHashDigest = hash(concatenatedDataHashes);

    assert(
      arraysAreEqual(passportData.eContent.slice(72, 72 + 32), concatenatedDataHashesHashDigest),
      'concatenatedDataHashesHashDigest is at the right place in passportData.eContent'
    )

    const reveal_bitmap = Array.from({ length: 88 }, (_, i) => (i >= 16 && i <= 22) ? '1' : '0');

    const inputs = {
      mrz: Array.from(formattedMrz).map(byte => String(byte)),
      reveal_bitmap: Array.from(reveal_bitmap).map(byte => String(byte)),
      dataHashes: Array.from(concatenatedDataHashes.map(toUnsignedByte)).map(byte => String(byte)),
      eContentBytes: Array.from(passportData.eContent.map(toUnsignedByte)).map(byte => String(byte)),
      signature: splitToWords(
        BigInt(bytesToBigDecimal(passportData.encryptedDigest)),
        BigInt(64),
        BigInt(32)
      ),
      pubkey: splitToWords(
        BigInt(hexToDecimal(passportData.modulus)),
        BigInt(64),
        BigInt(32)
      ),
    }

    console.log('inputs', inputs)

    const { proof, publicSignals } = await groth16.fullProve(
      inputs,
      "build/passport_js/passport.wasm",
      "build/passport_final.zkey"
    )

    console.log('proof done');
    // console.log('proof', proof)
    // console.log('publicSignals', publicSignals)

    const revealChars = publicSignals.slice(0, 88).map((byte: string) => String.fromCharCode(parseInt(byte, 10))).join('');

    console.log('reveal chars', revealChars);

    const vKey = JSON.parse(fs.readFileSync("build/verification_key.json"));

    const verified = await groth16.verify(
      vKey,
      publicSignals,
      proof
    )

    assert(verified == true, 'Should verifiable')

    console.log('proof verified');
  })
})
