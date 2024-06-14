import { SEED, MK, CONFIG } from '../constants';
import { Wallet } from '../../services/wallet.service';

let walletInstance = new Wallet();

beforeEach(() => {
    jest.setTimeout(60000);
    walletInstance = new Wallet();
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
        expect(res.reason).toBe('Error: Intercom host not initialized');
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

    await walletInstance.fromSeed(SEED, { passphrase: 'test' }, true);

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

    await walletInstance.fetchTransactions(['']).then((res) => {
        expect(res.status).toBe('error');
    });
});
