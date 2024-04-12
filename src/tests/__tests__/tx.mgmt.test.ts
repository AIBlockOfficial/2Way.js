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
                            '2dd512e5703df4ff16361d7a51762c266b1fd4e7cc15b4cfa25c2799b709d71a',
                        signature:
                            '5d67e4b8d694b14ef003ebe5625d76f509e57f6ead4b13162066bff2f9c0a1bfea8ce64928c2e66e05bda42fd12372b2862f4f1da94e1932c36718290fd7e408',
                        public_key:
                            '5e6d463ec66d7999769fa4de56f690dfb62e685b97032f5926b0cb6c93ba83c6',
                        address_version: null,
                    },
                },
                {
                    Pay2PkH: {
                        signable_data:
                            '86f2677098e5daf02cf82681334baf4e2fae03cc7d4f895972f904de66b1567c',
                        signature:
                            'a4882091ecbdc4cc8a74203a8c8c78503fe475fc949b6a6188e17ee90074f584bd31b7481a32428553af0613b96e2fd3aa68d179d5677d20054125ac1383ec0f',
                        public_key:
                            '58272ba93c1e79df280d4c417de47dbf6a7e330ba52793d7baa8e00ae5c34e59',
                        address_version: null,
                    },
                },
                {
                    Pay2PkH: {
                        signable_data:
                            '1623899f51915544ca0ca6a53fdba77a846c85e0776d13fd208753c0150ac65d',
                        signature:
                            '77a215f3a0d96b96fb92fa0b17725365fd04d1c36a159e599fdb8d0338d6e38333d74ebb4aa952ee4942a0dc97612101172ce6f9ff63a546011e6f38dcbbca09',
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
