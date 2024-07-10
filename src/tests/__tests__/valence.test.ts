import { CONFIG } from '../constants';
import { Wallet } from '../../services/wallet.service';

const valueId = 'test';
let walletInstance = new Wallet();
let walletInstance2 = new Wallet();
let seed = '';
let seed2 = '';
let asset = '';
let asset2 = '';
let encryptedTx = { druid: '', nonce: '', save: '' };

beforeEach(() => {
    jest.setTimeout(10000);
    walletInstance = new Wallet();
    walletInstance2 = new Wallet();
});

test('create items for 2 way payment', async () => {
    // Alice
    await walletInstance.initNew(CONFIG).then((res) => {
        expect(res.status).toBe('success');
        seed = res.content!.initNewResponse!.seedphrase;
    });
    const kp = walletInstance.getNewKeypair([]).content?.newKeypairResponse;

    await walletInstance.createItems(kp!, false, 1, null).then((res) => {
        expect(res.status).toBe('success');
        asset = res.content!.createItemResponse!.tx_hash;
    });

    // Bob
    await walletInstance2.initNew(CONFIG).then((res) => {
        expect(res.status).toBe('success');
        seed2 = res.content!.initNewResponse!.seedphrase;
    });
    const kp2 = walletInstance2.getNewKeypair([]).content?.newKeypairResponse;

    await walletInstance2.createItems(kp2!, false, 1, null).then((res) => {
        expect(res.status).toBe('success');
        asset2 = res.content!.createItemResponse!.tx_hash;
    });
});

jest.setTimeout(20000);
test('set_data', async () => {
    console.log('Waiting for 5 seconds for funds to update...');

    await new Promise((r) => setTimeout(r, 5000));

    // Alice
    await walletInstance.fromSeed(seed, CONFIG).then((res) => {
        expect(res.status).toBe('success');
    });
    const kp = walletInstance.getNewKeypair([]).content?.newKeypairResponse;

    // Bob
    await walletInstance2.fromSeed(seed2, CONFIG).then((res) => {
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

    const result = await walletInstance.make2WayPayment(
        kp2!.address, // Bob addr
        sendItem, // Sending asset
        receiveItem, // Receiving asset
        [kp!], // Alice keypairs
        kp!, // Alive kp addr
        valueId
    ).then((res) => {
        console.log(res)
        expect(res.status).toBe('success');
        return res.content!.make2WayPaymentResponse;
    });
    encryptedTx = result?.encryptedTx ? result.encryptedTx : { druid: '', nonce: '', save: '' };
});

test('get_data and accept', async () => {
    // Bob fetching Alices 2WT
    await walletInstance.fromSeed(seed2, CONFIG).then((res) => {
        expect(res.status).toBe('success');
    });
    const kp2 = walletInstance.getNewKeypair([]).content?.newKeypairResponse;

    const result = await walletInstance.fetchPending2WayPayment(
        kp2!,
    ).then((res) => {
        if (res.content?.fetchPending2WResponse)
            return res.content!.fetchPending2WResponse;
        return null;
    });

    let entry = (result as any).test;

    console.log('Entry: ', entry);

    // Accept
    await walletInstance.accept2WayPayment(entry.data.druid, entry.data, [kp2!], valueId).then((res) => {
        console.log(res)
        expect(res.status).toBe('success');
    })

    // Reject
    // await walletInstance.reject2WayPayment(entry.data.druid, entry.data, [kp2!]).then((res) => {
    //     console.log(res)
    //     expect(res.status).toBe('success');
    // })
});

test('get_data and validate', async () => {
    // Alice
    await walletInstance.fromSeed(seed, CONFIG).then((res) => {
        expect(res.status).toBe('success');
    });

    const kp = walletInstance.getNewKeypair([]).content?.newKeypairResponse;

    await walletInstance.fetchPending2WayPayment(
        kp!,
        [encryptedTx]
    ).then((res) => {
        console.log('FINAL Result: ', res)
        expect(res.status).toBe('success');
    });
});

