/* eslint-disable jest/no-conditional-expect */
import { IKeypair, IOutPoint, ICreateTxInScript, IErrorInternal } from '../../interfaces';
import { ADDRESS_VERSION } from '../../mgmt';
import * as txMgmt from '../../mgmt/tx.mgmt';
import { ADDRESS_LIST_TEST, FETCH_BALANCE_RESPONSE_TEST } from '../constants';
import { initIAssetToken } from '../../utils';

test('create transaction for a token amount', () => {
    const keyPairMap = new Map<string, IKeypair>();
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
                    locktime: 0,
                    genesis_hash: null,
                    script_public_key: 'payment_address',
                },
                {
                    value: { Token: 10 } /* Change/excess */,
                    locktime: 0,
                    genesis_hash: null,
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
                            '86e3c1d19379f4b4dda5c2b8e5142339d99e34a1a17ea8146232a4ec5252f734',
                        signature:
                            '3533068710c929159ef2e6a30fd9349780aadfa877ce45c120fc2c656395a96334c2e6bf6bb1a0f57ec2ec8857b68225079275aa1185604647cf47f2ac3f110c',
                        public_key:
                            '5e6d463ec66d7999769fa4de56f690dfb62e685b97032f5926b0cb6c93ba83c6',
                        address_version: null,
                    },
                },
                {
                    Pay2PkH: {
                        signable_data:
                            '8a7ef108ca61e52a3c264b6fcb60b45403a4e43ecde09e556d7f061fcf51b763',
                        signature:
                            'a24a109f2e8de9d1caaf31bea3adb112e495a62850f6adc8705ee91f5c6fe8c619ba1f8bcffca30f2bf219d848990180b5b1383fc98be5daad2710dacea05f04',
                        public_key:
                            '58272ba93c1e79df280d4c417de47dbf6a7e330ba52793d7baa8e00ae5c34e59',
                        address_version: null,
                    },
                },
                {
                    Pay2PkH: {
                        signable_data:
                            'f7bb539b27ad6651c3895844126af85e1cc9fddfe425b08750e975f823fc509a',
                        signature:
                            '1cc4757436b6a309805aebe7ec718a91427aaceab3de23ebecdbdf197be5885de89ee788e1f96c0f5cfe722c2103e14e4a33a32b59173ffc1c24491d6174e50f',
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
    );
    expect(createTransactionFailure._unsafeUnwrapErr()).toStrictEqual(
        IErrorInternal.InsufficientFunds,
    );
});
