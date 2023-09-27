# cd ..

echo "compiling circuit"
circom circuits/passport.circom --r1cs --sym --wasm --output build

echo "building zkey"
yarn snarkjs groth16 setup build/passport.r1cs build/powersOfTau28_hez_final_20.ptau build/passport.zkey

echo "building vkey"
echo "test random" | yarn snarkjs zkey contribute build/passport.zkey build/passport_final.zkey
yarn snarkjs zkey export verificationkey build/passport_final.zkey build/verification_key.json
