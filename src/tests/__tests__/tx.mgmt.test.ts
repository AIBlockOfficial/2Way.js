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
                        signable_data: "fe9bdf42857f0fdfba26b120a42e04a0f331c711870656bea9d088bfcd1e8328",
                        signature: "d4b3ca1fda6a346bda064e170e53d8b8dab542a3a68a28b88b7a735ba62856b8e948070219cdb7d4990a3f1b15a8f481b88f538bd6bedb2449ba3b58a7343002",
                        public_key:
                            '5e6d463ec66d7999769fa4de56f690dfb62e685b97032f5926b0cb6c93ba83c6',
                        address_version: null,
                    },
                },
                {
                    Pay2PkH: {
                        signable_data: "00af035f217573c3a2d477a07cfaa1d33b80215ed7e5bbead0f35be7c3b22a8b",
                        signature: "434d4bd39d048c72307d71cd5025ff8e0ec58b488d84e9131dcff5d592d38c9122c50bef0799edd5b55d3d049d83df8877949081a8cf92587a6f5f4d83ed7f08",
                        public_key:
                            '58272ba93c1e79df280d4c417de47dbf6a7e330ba52793d7baa8e00ae5c34e59',
                        address_version: null,
                    },
                },
                {
                    Pay2PkH: {
                        signable_data: "95887e26db3c462deb59882c2b2e683630966bfd6737805b382fdf8ff00017a0",
                        signature: "a533ca3438935bc4ce39ccff1bcc14ba6044b2595003a7e758927a21d7cd4876ca6820e6c6cce65186974e459aa2e7ae2251ad80e4b587926cd74a2cb855cf0d",
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
