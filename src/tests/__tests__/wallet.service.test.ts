import { SEED, MK, CONFIG } from '../constants';
import { Wallet } from '../../services/wallet.service';

let walletInstance = new Wallet();
let walletInstance2 = new Wallet();

beforeEach(() => {
    jest.setTimeout(60000);
    walletInstance = new Wallet();
    walletInstance2 = new Wallet();
});

test('init wallet validation', async () => {
    const config = {
        mempoolHost: '',
        storageHost: CONFIG.storageHost,
        intercomHost: CONFIG.intercomHost,
        passphrase: CONFIG.passphrase,
    };

    await walletInstance.initNew(config).then((res) => {
        expect(res.status).toBe('error');
    });

    await walletInstance.fromSeed(SEED, config).then((res) => {
        expect(res.status).toBe('error');
    });

    await walletInstance.fromMasterKey(MK, config).then((res) => {
        expect(res.status).toBe('error');
    });
});

test('init wallet without optional config fields', async () => {
    const config = {
        mempoolHost: CONFIG.mempoolHost,
        passphrase: CONFIG.passphrase,
    };

    await walletInstance.initNew(config).then((res) => {
        expect(res.status).toBe('success');
    });

    await walletInstance.fetchTransactions([]).then((res) => {
        expect(res.reason).toBe('Error: Storage host not initialized');
    });

    await walletInstance.fetchPending2WayPayments([], []).then((res) => {
        expect(res.reason).toBe('Error: Valence host not initialized');
    });
});

test('init wallet locally and then connect', async () => {
    await walletInstance.initNew({ passphrase: CONFIG.passphrase }, true).then((res) => {
        expect(res.status).toBe('success');
    });

    await walletInstance.initNetwork(CONFIG).then((res) => {
        expect(res.status).toBe('success');
    });
});

test('handles key-pair re-generation from wallet seed phrase', async () => {
    const utxoAddressList = [
        /* TEMP_ADDRESS_VERSION = 99999 */
        '8532c5b5581aa926c1bdcc250cf2c66ad6eee4eb05970473b8beb1636f2bdc0d',
        'f16d40ce818c98ea61a850a7f4b9aa2caad5308cb7f373c2037f00fb56b7d151',
        'f2a2a932e0a937de00dad8e36a2d9a11b824018e65aae1427e611bf1324fe24a',

        /* ADDRESS_VERSION = 1 */
        'e93d4a67609baf6a76ce61e7a3b53e9509a1472ff135892e42bf4cf456274a96',
        '41d769523c31a44090b69a233f552009314fa9a4efcc312d3faf56c627743f40',
        '28a7de5c30f8271be690db7a979e1be33d31f6b6aebaa3c82888354ba214c24d',
    ];

    await walletInstance.fromSeed(SEED, { passphrase: '' }, true);

    const foundAddresses = await walletInstance.regenAddresses(SEED, utxoAddressList, 6);

    // Test to see if we have a success response from the client
    expect(foundAddresses.status).toBe('success');

    // Test to see if we have the regenerated addresses
    expect(foundAddresses.content?.regenWalletResponse).toBeDefined();
    if (foundAddresses.content?.regenWalletResponse)
        // eslint-disable-next-line jest/no-conditional-expect
        expect(
            foundAddresses.content.regenWalletResponse.map(
                (encryptedAddress) => encryptedAddress.address,
            ),
        ).toEqual(utxoAddressList);
});

test('fetch balance', async () => {
    await walletInstance.initNew(CONFIG).then((res) => {
        expect(res.status).toBe('success');
    });

    const kp = walletInstance.getNewKeypair([]).content?.newKeypairResponse;
    const kpAddr = kp?.address;

    expect(kp).toBeDefined();
    expect(kpAddr).toBeDefined();

    await walletInstance.fetchBalance([kpAddr!]).then((res) => {
        expect(res.status).toBe('success');
    });
});

test('fetch transaction', async () => {
    await walletInstance.initNew(CONFIG).then((res) => {
        expect(res.status).toBe('success');
    });

    await walletInstance.fetchTransactions(['000000']).then((res) => {
        expect(res.status).toBe('success');
    });
});

test('make 2 way payment', async () => {
    const config = {
        mempoolHost: 'http://37.27.23.104:3003',
        storageHost: 'http://37.27.23.104:3001',
        valenceHost: 'http://0.0.0.0:3030',
        passphrase: '',
    };

    // Alice
    const seed = 'potato home pond music way wood fatigue lonely cabin write put emerge'
    const asset = 'g97632b69eab97db603119dd5454c7fc'
    await walletInstance.fromSeed(seed, config).then((res) => {
        expect(res.status).toBe('success');
    });
    const kp = walletInstance.getNewKeypair([]).content?.newKeypairResponse;

    // Bob
    const seed2 = 'walk capable spin today category pool twenty miss piano check reform vocal'
    const asset2 = 'g621ea33bfc2e840c82bf86abfcfb849'
    await walletInstance2.fromSeed(seed2, config).then((res) => {
        expect(res.status).toBe('success');
    });
    const kp2 = walletInstance2.getNewKeypair([]).content?.newKeypairResponse;

    console.log('Bob keypair: ', kp2)
    const bobSign = walletInstance.signMessage([kp2!], kp2!.address).content?.signMessageResponse
    console.log('Bob sign pKey: ', bobSign)
    const sendItem = {
        "Item": {
            "amount": 1,
            "genesis_hash": asset,
            "metadata": null
        }
    }
    const receiveItem = {
        "Item": {
            "amount": 1,
            "genesis_hash": asset2,
            "metadata": null
        }
    }

    await walletInstance.make2WayPayment(
        kp2!.address, // Bob addr
        sendItem, // Sending asset
        receiveItem, // Receiving asset
        [kp!], // Alice keypairs
        kp! // Alive kp addr
    ).then((res) => {
        console.log(res)
        expect(res.status).toBe('success');
    });
});

test('fetch 2 way payment', async () => {
    const config = {
        mempoolHost: 'http://37.27.23.104:3003',
        storageHost: 'http://37.27.23.104:3001',
        valenceHost: 'http://0.0.0.0:3030',
        passphrase: '',
    };

    // Bob fetching Alices 2WT
    const seed2 = 'walk capable spin today category pool twenty miss piano check reform vocal'
    await walletInstance2.fromSeed(seed2, config).then((res) => {
        expect(res.status).toBe('success');
    });
    const kp2 = walletInstance2.getNewKeypair([]).content?.newKeypairResponse;

    await walletInstance.fetchPending2WayPayments(
        [kp2!],
        []
    ).then((res) => {
        console.log(res)
        expect(res.status).toBe('success');
    });
});