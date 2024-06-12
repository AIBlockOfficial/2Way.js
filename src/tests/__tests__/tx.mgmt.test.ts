/* eslint-disable jest/no-conditional-expect */
import { IKeypair, IOutPoint, ICreateTxInScript, IErrorInternal } from '../../interfaces';
import { ADDRESS_VERSION } from '../../mgmt';
import * as txMgmt from '../../mgmt/tx.mgmt';
// import * as scriptMgmt from '../../mgmt/script.mgmt';
import { ADDRESS_LIST_TEST, FETCH_BALANCE_RESPONSE_TEST } from '../constants';
import { initIAssetToken, getStringBytes } from '../../utils';

import nacl from 'tweetnacl';

test("signs data using a keypair's secret key", () => {
    const keyPair = nacl.sign.keyPair();
    const data = 'c896822998c5c99bfe32e5ae982c46075dae1b09d0704a18492d06973854b5a6';
    const dataAsBytes = getStringBytes(data);

    const rawSig = nacl.sign.detached(dataAsBytes, keyPair.secretKey);
    expect(nacl.sign.detached.verify(dataAsBytes, rawSig, keyPair.publicKey)).toBe(true);
});

test('create transaction for a token amount', () => {
    const keyPairMap = new Map<string, IKeypair>();
    const LOCKTIME = 100;
    for (const addr of Object.keys(ADDRESS_LIST_TEST)) {
        keyPairMap.set(addr, {
            address: addr,
            secretKey: Buffer.from(ADDRESS_LIST_TEST[addr].secret_key, 'hex'),
            publicKey: Buffer.from(ADDRESS_LIST_TEST[addr].public_key, 'hex'),
            version: ADDRESS_VERSION,
        });
    }

    /*
     * Success Tests
     */
    const createTransactionSuccess = txMgmt.createPaymentTx(
        'cf0067d6c42463b2c1e4236e9669df546c74b16c0e2ef37114549b2944e05b7c',
        initIAssetToken({ Token: 1050 }),
        'f226b92e6868e178f722e9cf71ad2a0c16d864c5d8fcadc70153bbd021f11ea0',
        FETCH_BALANCE_RESPONSE_TEST,
        keyPairMap,
        LOCKTIME,
    );

    // Transaction created successfully
    expect(createTransactionSuccess.isOk()).toBe(true);

    if (createTransactionSuccess.isOk()) {
        const [createTx, usedAddresses] = [
            createTransactionSuccess.value.createTx,
            createTransactionSuccess.value.usedAddresses,
        ];

        // From here we assume the create transaction struct is created correctly
        expect(createTx).toBeDefined();
        if (createTx) {
            // Assert depleted addresses
            expect(usedAddresses).toStrictEqual([
                'cf0067d6c42463b2c1e4236e9669df546c74b16c0e2ef37114549b2944e05b7c',
                'f226b92e6868e178f722e9cf71ad2a0c16d864c5d8fcadc70153bbd021f11ea0',
                '9b28bf45e5e5285a8eb10003046f5ed48571903ea767915acf0fe77e257b43fa',
            ]);

            // Assert TxOut values
            const txOuts = createTx?.outputs;
            expect(txOuts).toStrictEqual([
                {
                    value: { Token: 1050 } /* Amount payed */,
                    locktime: LOCKTIME,
                    script_public_key: 'cf0067d6c42463b2c1e4236e9669df546c74b16c0e2ef37114549b2944e05b7c',
                },
                {
                    value: { Token: 10 } /* Change/excess */,
                    locktime: 0,
                    script_public_key: 'f226b92e6868e178f722e9cf71ad2a0c16d864c5d8fcadc70153bbd021f11ea0',
                },
            ]);

            // Assert previous outpoints in CreateTransaction struct
            const previousOuts: IOutPoint[] = Object.entries(createTx?.inputs)
                .map((i) => i[1].previous_out)
                .filter((input): input is IOutPoint => !!input);

            expect(previousOuts).toStrictEqual([
                {
                    n: 0,
                    t_hash: '000000',
                },
                {
                    n: 0,
                    t_hash: '000001',
                },
                {
                    n: 0,
                    t_hash: '000002',
                },
            ]);

            // Assert script signatures
            const script_signatures: ICreateTxInScript[] = Object.entries(createTx?.inputs)
                .map((i) => i[1].script_signature)
                .filter((input): input is ICreateTxInScript => !!input);

            expect(script_signatures).toStrictEqual([
                {
                    Pay2PkH: {
                        signable_data: "96c69e798084bb020ca8e4beeee53223526ec91f78c5f1eb4cdb5e33661bd1aa",
                        signature: "2751e62ea143fc35b836e80f04e834a7e71046afbffcc967e3fff8b9dc803e96e5cb197db48ea4e3ed7cfc1ba7a3b9d78c83efde2d54a3128874d6fd52181f06",
                        public_key:
                            '5e6d463ec66d7999769fa4de56f690dfb62e685b97032f5926b0cb6c93ba83c6',
                        address_version: null,
                    },
                },
                {
                    Pay2PkH: {
                        signable_data: "0e1d326120fa50ca23f39d6cbf8d6a8c75a58f518df2e0eb2025e9ae199ca70b",
                        signature: "aa0de8c4082784c0f648b79df958a3cad6034b7e418f9524f1b9684a3866c27614cf7dc47a4be798dcc1ae8b979134ef927cc3ec2b5554eb699783b3e67c7900",
                        public_key:
                            '58272ba93c1e79df280d4c417de47dbf6a7e330ba52793d7baa8e00ae5c34e59',
                        address_version: null,
                    },
                },
                {
                    Pay2PkH: {
                        signable_data: "1d881b19a306a70a889dcf6e6c6f218f4653cbde7fc2f158cf7246eb4b6ee8d5",
                        signature: "135103e951437c64990d7adea6d9b996f54a95c0a977baaedd697917b95f85c9ae42e34ca84eea7ed1caf36f7f41d584cda6e4a942d5a3b29d1601a9eded9a03",
                        public_key:
                            'efa9dcba0f3282b3ed4a6aa1ccdb169d6685a30d7b2af7a2171a5682f3112359',
                        address_version: null,
                    },
                },
            ]);
        }
    }

    /*
     * Failure Tests
     */

    //Insufficient funds available
    const createTransactionFailure = txMgmt.createPaymentTx(
        'payment_address',
        initIAssetToken({ Token: 99999 }) /* Insufficient funds */,
        'excess_address',
        FETCH_BALANCE_RESPONSE_TEST,
        keyPairMap,
        0,
    );
    expect(createTransactionFailure._unsafeUnwrapErr()).toStrictEqual(
        IErrorInternal.InsufficientFunds,
    );
});
