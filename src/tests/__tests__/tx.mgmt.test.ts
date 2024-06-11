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
    // const _signature = scriptMgmt.constructSignature(dataAsBytes, keyPair.secretKey);

    const testPubKey = Uint8Array.from(
        Buffer.from('14a7cd29ecb0e4b64c3e58ad4fbf479155e4c6827a5a0dd0021b9a208b7f8e20', 'hex'),
    );
    const testSig = Uint8Array.from(
        Buffer.from(
            '7be8fe2f37eb51b9a3ce26765f074fb492117b52f6b012af0c6a09520c25aaca96239efbaec8cae54ba7996a7dcf56e330458af8e5c3752dbcf18693e132bd0b',
            'hex',
        ),
    );
    console.log('testSig', testSig);

    console.log(
        'sig verify from aaron',
        nacl.sign.detached.verify(dataAsBytes, testSig, testPubKey),
    );

    const rawSig = nacl.sign.detached(dataAsBytes, keyPair.secretKey);
    console.log('signature', rawSig);
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
        'payment_address',
        initIAssetToken({ Token: 1050 }),
        'excess_address',
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
                    script_public_key: 'payment_address',
                },
                {
                    value: { Token: 10 } /* Change/excess */,
                    locktime: 0,
                    script_public_key: 'excess_address',
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
                        signable_data:
                            '5604f8ef313423f0496c1b219ff10f2a575d8c8a9e0d67f2f3a084c1cece72f6',
                        signature:
                            'ddf8bea9b07b154f73415c7abdba3f46e69de9cc1e51c50f22f3025d8ae491ed74a79528ae8da3202360d6c91b4329b2f53b8822e0bed3c03b3ba8dee1e0af00',
                        public_key:
                            '5e6d463ec66d7999769fa4de56f690dfb62e685b97032f5926b0cb6c93ba83c6',
                        address_version: null,
                    },
                },
                {
                    Pay2PkH: {
                        signable_data:
                            'f4a54008332abcf5041a99be9bd640b6cf95226b5724311e6d2c4b2f58052579',
                        signature:
                            '3f5f8d17032f3b52a613e839fdaff37f116d36a252ccf22eab8eecb7b7fae8f56c9fe490008ed8eb25f14fee61dd26ce1b860d780eb02c0ef4da115d86d6c708',
                        public_key:
                            '58272ba93c1e79df280d4c417de47dbf6a7e330ba52793d7baa8e00ae5c34e59',
                        address_version: null,
                    },
                },
                {
                    Pay2PkH: {
                        signable_data:
                            'a516249b5a0cf36e9328b54bd786d8a94107c9e4ede19df9257c43d142f76e1f',
                        signature:
                            'd9700f15cd22b3de130904335051d2469af3ae8a40db06e12b4a0e6967b24254ac0a767d410f13a8da8565b04f7324ff7e0fc5006018a792c6dfcd567fcd610c',
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
