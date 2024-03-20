// import { SEED } from '../constants';
import { Wallet } from '../../services/wallet.service';

let walletInstance = new Wallet();
let walletInstance2 = new Wallet();

beforeEach(() => {
    jest.setTimeout(60000);
    walletInstance = new Wallet();
    walletInstance2 = new Wallet();
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