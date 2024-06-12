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
        mempoolHost: 'https://mempool.aiblock.dev',
        storageHost: 'https://storage.aiblock.dev',
        valenceHost: 'http://0.0.0.0:3030',
        passphrase: '',
    };

    // Alice
    const seed = 'potato home pond music way wood fatigue lonely cabin write put emerge'
    const asset = 'g4ad95e16b100f3b6bb232c16a543cea'
    await walletInstance.fromSeed(seed, config).then((res) => {
        console.log('wallet: ', res)
        expect(res.status).toBe('success');
    });
    const kp = walletInstance.getNewKeypair([]).content?.newKeypairResponse;

    // Bob
    const seed2 = 'walk capable spin today category pool twenty miss piano check reform vocal'
    const asset2 = 'g08667340b04f40bb512dd8d74dcd1cf'
    await walletInstance2.fromSeed(seed2, config).then((res) => {
        expect(res.status).toBe('success');
    });
    const kp2 = walletInstance2.getNewKeypair([]).content?.newKeypairResponse;

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

    console.log(kp?.address, ' --> ', kp2?.address)

    let result = await walletInstance.make2WayPayment(
        kp2!.address, // Bob addr
        sendItem, // Sending asset
        receiveItem, // Receiving asset
        [kp!], // Alice keypairs
        kp! // Alive kp addr
    ).then((res) => {
        console.log(res)
        expect(res.status).toBe('success');
        return res.content!.make2WayPaymentResponse;
    });

    console.log(result?.encryptedTx)
});