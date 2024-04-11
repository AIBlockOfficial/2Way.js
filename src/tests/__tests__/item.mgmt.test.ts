/* eslint-disable jest/no-conditional-expect */
import {
    IKeypair,
    IOutPoint,
    ICreateTxInScript,
    IGenesisHashSpecification,
} from '../../interfaces';
import {
    ADDRESS_VERSION,
    constructTxInsAddress,
    constructTxInSignableAssetHash,
    DEFAULT_GENESIS_HASH_SPEC,
    generateDRUID,
    getInputsForTx,
} from '../../mgmt';
import * as itemMgmt from '../../mgmt/item.mgmt';
import { ADDRESS_LIST_TEST, FETCH_BALANCE_RESPONSE_TEST } from '../constants';
import { initIAssetItem, initIAssetToken, initIDruidExpectation } from '../../utils';

test('creates a valid payload to create items', () => {
    const keypair = {
        publicKey: new Uint8Array([
            105, 254, 232, 28, 144, 69, 179, 94, 175, 4, 183, 75, 250, 121, 131, 97, 138, 8, 172,
            183, 25, 239, 141, 55, 73, 164, 240, 4, 162, 147, 202, 223,
        ]),
        secretKey: new Uint8Array([
            252, 186, 153, 105, 137, 147, 53, 80, 3, 89, 170, 69, 174, 112, 8, 199, 221, 139, 22,
            136, 61, 254, 142, 163, 154, 121, 146, 89, 231, 15, 152, 90, 105, 254, 232, 28, 144, 69,
            179, 94, 175, 4, 183, 75, 250, 121, 131, 97, 138, 8, 172, 183, 25, 239, 141, 55, 73,
            164, 240, 4, 162, 147, 202, 223,
        ]),
    };

    const payload = itemMgmt.createItemPayload(
        keypair.secretKey,
        keypair.publicKey,
        ADDRESS_VERSION,
    );

    const metadataPayload = itemMgmt.createItemPayload(
        keypair.secretKey,
        keypair.publicKey,
        ADDRESS_VERSION,
        1000,
        true,
        "{'test': 'test'}",
    );

    if (payload.isOk()) {
        expect(payload.value).toEqual({
            item_amount: 1000,
            public_key: '69fee81c9045b35eaf04b74bfa7983618a08acb719ef8d3749a4f004a293cadf',
            script_public_key: 'a0b08e623c6800bb27dddb5d6f6956939be674cfc63399dcc7b9f2e6733c02e5',
            signature:
                '277d56770697ba1f6cec5e859aa4dcdff0ec4a261c75408092d44a38e768461a45fc0a7964ecb4714eb2849b0cd4c43e107db76f8a62c6b783342a895889b80c',
            version: null,
            genesis_hash_spec:
                IGenesisHashSpecification.Default /* Create generic Item assets instead of a tracked Item assets */,
            metadata: null,
        });
    }

    if (metadataPayload.isOk()) {
        expect(metadataPayload.value).toEqual({
            item_amount: 1000,
            public_key: '69fee81c9045b35eaf04b74bfa7983618a08acb719ef8d3749a4f004a293cadf',
            script_public_key: 'a0b08e623c6800bb27dddb5d6f6956939be674cfc63399dcc7b9f2e6733c02e5',
            signature:
                '277d56770697ba1f6cec5e859aa4dcdff0ec4a261c75408092d44a38e768461a45fc0a7964ecb4714eb2849b0cd4c43e107db76f8a62c6b783342a895889b80c',
            version: null,
            genesis_hash_spec:
                IGenesisHashSpecification.Default /* Create generic Item assets instead of a tracked Item assets */,
            metadata: "{'test': 'test'}",
        });
    }
});

test('create transaction for the SEND portion of a item-based payment', () => {
    const keyPairMap = new Map<string, IKeypair>();
    for (const addr of Object.keys(ADDRESS_LIST_TEST)) {
        keyPairMap.set(addr, {
            address: addr,
            secretKey: Buffer.from(ADDRESS_LIST_TEST[addr].secret_key, 'hex'),
            publicKey: Buffer.from(ADDRESS_LIST_TEST[addr].public_key, 'hex'),
            version: ADDRESS_VERSION,
        });
    }

    const createTransaction = itemMgmt.createIbTxHalf(
        FETCH_BALANCE_RESPONSE_TEST,
        'full_druid',
        initIDruidExpectation({
            asset: {
                Item: {
                    amount: 1,
                    genesis_hash: DEFAULT_GENESIS_HASH_SPEC,
                    metadata: "{'test': 'test'}",
                },
            },
            from: 'their_from_value',
            to: 'our_receive_address',
        }),
        initIDruidExpectation({
            asset: {
                Token: 1050,
            },
            from: 'our_from_value',
            to: 'their_receive_address',
        }),
        'excess_address',
        keyPairMap,
    );

    if (createTransaction.isOk()) {
        const [createTx, usedAddresses] = [
            createTransaction.value.createTx,
            createTransaction.value.usedAddresses,
        ];
        // From here we assume the create transaction struct is created correctly
        expect(createTx).toBeDefined();
        if (createTx) {
            // Assert used addresses
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
                    script_public_key: 'their_receive_address',
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
                            'fe9bdf42857f0fdfba26b120a42e04a0f331c711870656bea9d088bfcd1e8328',
                        signature:
                            '001cd9b845ee561bacbb64dcc41126be808868dcb50fc2cb8fee0d8e24fca81c71eb3a9f8f909b9331ffaade12637732778561cd5ac5c1241fb61fad45e6bf0c',
                        public_key:
                            '5e6d463ec66d7999769fa4de56f690dfb62e685b97032f5926b0cb6c93ba83c6',
                        address_version: null,
                    },
                },
                {
                    Pay2PkH: {
                        signable_data:
                            '00af035f217573c3a2d477a07cfaa1d33b80215ed7e5bbead0f35be7c3b22a8b',
                        signature:
                            '2c7a17525d9919010872adcbf6b3f719c647866846dfb62cb62cca1998ab5bf032c641178e4527704a8abe0d100378873a1117cbcbea7f7ca8ae58fb4788050f',
                        public_key:
                            '58272ba93c1e79df280d4c417de47dbf6a7e330ba52793d7baa8e00ae5c34e59',
                        address_version: null,
                    },
                },
                {
                    Pay2PkH: {
                        signable_data:
                            '95887e26db3c462deb59882c2b2e683630966bfd6737805b382fdf8ff00017a0',
                        signature:
                            '14933b1035586305cb610dda5d26c256d80288575b25cefee2fb97ecd3aa0d9c288797fe9c31bf1bd1859411b69c2adc9aa99d4feee103496cbe69b1132d1f01',
                        public_key:
                            'efa9dcba0f3282b3ed4a6aa1ccdb169d6685a30d7b2af7a2171a5682f3112359',
                        address_version: null,
                    },
                },
            ]);

            // Assert druid values
            const druid_values = createTx?.druid_info;
            if (druid_values !== null) {
                expect(druid_values).toStrictEqual({
                    druid: 'full_druid',
                    expectations: [
                        {
                            asset: {
                                Item: {
                                    amount: 1,
                                    genesis_hash: DEFAULT_GENESIS_HASH_SPEC,
                                    metadata: "{'test': 'test'}",
                                },
                            },
                            from: 'their_from_value',
                            to: 'our_receive_address',
                        },
                    ],
                    participants: 2,
                });
            }
        }
    }
});

test('create transaction for the RECEIVE portion of a item-based payment', () => {
    const keyPairMap = new Map<string, IKeypair>();
    for (const addr of Object.keys(ADDRESS_LIST_TEST)) {
        keyPairMap.set(addr, {
            address: addr,
            secretKey: Buffer.from(ADDRESS_LIST_TEST[addr].secret_key, 'hex'),
            publicKey: Buffer.from(ADDRESS_LIST_TEST[addr].public_key, 'hex'),
            version: ADDRESS_VERSION,
        });
    }

    const createTransaction = itemMgmt.createIbTxHalf(
        FETCH_BALANCE_RESPONSE_TEST,
        'full_druid',
        initIDruidExpectation({
            asset: {
                Token: 1060,
            },
            from: 'their_from_value',
            to: 'our_receive_address',
        }),
        initIDruidExpectation({
            asset: {
                Item: {
                    amount: 1,
                    genesis_hash: DEFAULT_GENESIS_HASH_SPEC,
                    metadata: null,
                },
            },
            from: 'our_from_value',
            to: 'their_receive_address',
        }),
        'excess_address',
        keyPairMap,
    );

    if (createTransaction.isOk()) {
        const [createTx, usedAddresses] = [
            createTransaction.value.createTx,
            createTransaction.value.usedAddresses,
        ];

        // From here we assume the create transaction struct is created correctly
        expect(createTx).toBeDefined();
        if (createTx) {
            // Assert used addresses
            expect(usedAddresses).toStrictEqual([
                'cf0067d6c42463b2c1e4236e9669df546c74b16c0e2ef37114549b2944e05b7c' /* Only one address was used */,
            ]);

            // Assert TxOut values
            const txOuts = createTx?.outputs;
            expect(txOuts).toStrictEqual([
                {
                    value: {
                        Item: {
                            amount: 1,
                            genesis_hash: DEFAULT_GENESIS_HASH_SPEC,
                            metadata: null,
                        },
                    } /* Amount payed */,
                    locktime: 0,
                    genesis_hash: null,
                    script_public_key: 'their_receive_address',
                },
                {
                    value: {
                        Item: {
                            amount: 2,
                            genesis_hash: DEFAULT_GENESIS_HASH_SPEC,
                            metadata: null,
                        },
                    } /* Change/excess */,
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
                    n: 1,
                    t_hash: '000000',
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
                            'fe9bdf42857f0fdfba26b120a42e04a0f331c711870656bea9d088bfcd1e8328',
                        signature:
                            '001cd9b845ee561bacbb64dcc41126be808868dcb50fc2cb8fee0d8e24fca81c71eb3a9f8f909b9331ffaade12637732778561cd5ac5c1241fb61fad45e6bf0c',
                        public_key:
                            '5e6d463ec66d7999769fa4de56f690dfb62e685b97032f5926b0cb6c93ba83c6',
                        address_version: null,
                    },
                },
            ]);

            // Assert druid values
            const druid_values = createTx?.druid_info;
            if (druid_values !== null) {
                expect(druid_values).toStrictEqual({
                    druid: 'full_druid',
                    expectations: [
                        {
                            asset: { Token: 1060 },
                            from: 'their_from_value',
                            to: 'our_receive_address',
                        },
                    ],
                    participants: 2,
                });
            }
        }
    }
});

// NOTE: This test corresponds with `test_construct_valid_tx_ins_address` in Chain
test('create TxIns address used as `from` value in DdeValues', () => {
    const keyPairMap = new Map<string, IKeypair>();
    for (const addr of Object.keys(ADDRESS_LIST_TEST)) {
        keyPairMap.set(addr, {
            address: addr,
            secretKey: Buffer.from(ADDRESS_LIST_TEST[addr].secret_key, 'hex'),
            publicKey: Buffer.from(ADDRESS_LIST_TEST[addr].public_key, 'hex'),
            version: ADDRESS_VERSION,
        });
    }
    const txInputs = getInputsForTx(
        initIAssetToken({ Token: 1050 }),
        FETCH_BALANCE_RESPONSE_TEST,
        keyPairMap,
    );

    if (txInputs.isOk()) {
        const ourFromAddress = constructTxInsAddress(txInputs.value.inputs).unwrapOr('');
        expect(ourFromAddress).toStrictEqual(
            'dcfa9f0ef515cbf26358d25f1ecfcb35d9eb1b66ea9976e5d0e48fbc53ebfdbf',
        );
    }
});

//NOTE: This test corresponds with `test_construct_valid_tx_in_signable_asset_hash` in Chain
//TODO: Add test for `DataAsset` variant
test('creates a valid signable asset hash value', () => {
    const signableTxInAssetHashes: string[] = [
        constructTxInSignableAssetHash(initIAssetToken({ Token: 1 })),
        constructTxInSignableAssetHash(
            initIAssetItem({
                Item: {
                    amount: 1,
                    genesis_hash:
                        DEFAULT_GENESIS_HASH_SPEC /* Value is currently not used to generate signable hash */,
                    metadata: "{'test': 'test'}",
                },
            }),
        ),
    ];

    expect(signableTxInAssetHashes).toStrictEqual([
        'a5b2f5e8dcf824aee45b81294ff8049b680285b976cc6c8fa45eb070acfc5974',
        'cb8f6cba3a62cfb7cd14245f19509b800da3dd446b6d902290efbcc91b3cee0d',
    ]);
});

test('generates a valid DRUID', () => {
    const druid = generateDRUID();
    if (druid.isOk()) {
        expect(druid.value.slice(0, 5)).toBe('DRUID');
        expect(druid.value.length).toBe(39);
    }
});
