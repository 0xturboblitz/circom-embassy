import { describe } from 'mocha'
import chai, { assert, expect } from 'chai'
import chaiAsPromised from 'chai-as-promised'
import { arraysAreEqual, bytesToBigDecimal, formatAndConcatenateDataHashes, formatMrz, hexToDecimal, splitToWords } from '../utils/utils'
import { groth16 } from 'snarkjs'
import { hash, toUnsignedByte } from '../utils/computeEContent'
import { DataHash, PassportData } from '../utils/types'
import { genSampleData } from '../utils/sampleData'
const fs = require('fs');

chai.use(chaiAsPromised)

describe('Circuit tests', function () {
  this.timeout(0)

  let passportData: PassportData;
  let inputs: any;

  this.beforeAll(async () => {
    if (fs.existsSync('inputs/passportData.json')) {
      passportData = require('../inputs/passportData.json');
    } else {
      passportData = (await genSampleData()) as PassportData;
      fs.mkdirSync('inputs');
      fs.writeFileSync('inputs/passportData.json', JSON.stringify(passportData));
    }

    const formattedMrz = formatMrz(passportData.mrz);
    const mrzHash = hash(formatMrz(passportData.mrz));
    const concatenatedDataHashes = formatAndConcatenateDataHashes(
      mrzHash,
      passportData.dataGroupHashes as DataHash[],
    );
    
    const concatenatedDataHashesHashDigest = hash(concatenatedDataHashes);

    // console.log('concatenatedDataHashesHashDigest', concatenatedDataHashesHashDigest)
    // console.log('passportData.eContent.slice(72, 72 + 32)', passportData.eContent.slice(72, 72 + 32))
    assert(
      arraysAreEqual(passportData.eContent.slice(72, 72 + 32), concatenatedDataHashesHashDigest),
      'concatenatedDataHashesHashDigest is at the right place in passportData.eContent'
    )

    const reveal_bitmap = Array.from({ length: 88 }, (_, i) => (i >= 16 && i <= 22) ? '1' : '0');

    inputs = {
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
        BigInt(passportData.modulus),
        BigInt(64),
        BigInt(32)
      ),
    }
    
  })
  
  it('should prove and verify with valid inputs', async function () {
    console.log('inputs', inputs)

    const { proof, publicSignals } = await groth16.fullProve(
      inputs,
      "build/passport_js/passport.wasm",
      "build/passport_final.zkey"
    )

    console.log('proof done');

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

  it('should fail to prove with invalid mrz', async function () {
    const invalidInputs = {
      ...inputs,
      mrz: inputs.mrz.map((byte: string) => String((parseInt(byte, 10) + 1) % 256)),
    }

    return expect(groth16.fullProve(
      invalidInputs,
      "build/passport_js/passport.wasm",
      "build/passport_final.zkey"
    )).to.be.rejected;
  })

  it('should fail to prove with invalid eContentBytes', async function () {
    const invalidInputs = {
      ...inputs,
      eContentBytes: inputs.eContentBytes.map((byte: string) => String((parseInt(byte, 10) + 1) % 256)),
    }

    return expect(groth16.fullProve(
      invalidInputs,
      "build/passport_js/passport.wasm",
      "build/passport_final.zkey"
    )).to.be.rejected;
  })
  
  it('should fail to prove with invalid signature', async function () {
    const invalidInputs = {
      ...inputs,
      signature: inputs.signature.map((byte: string) => String((parseInt(byte, 10) + 1) % 256)),
    }

    return expect(groth16.fullProve(
      invalidInputs,
      "build/passport_js/passport.wasm",
      "build/passport_final.zkey"
    )).to.be.rejected;
  })
})
