// import { SEED } from '../constants';
import { Wallet } from '../../services/wallet.service';

let walletInstance = new Wallet();

beforeEach(() => {
    jest.setTimeout(60000);
    walletInstance = new Wallet();
});

test('fetch 2 way payment', async () => {
    const config = {
        mempoolHost: 'https://mempool.aiblock.dev',
        storageHost: 'https://storage.aiblock.dev',
        valenceHost: 'http://0.0.0.0:3030',
        passphrase: '',
    };

    // Bob fetching Alices 2WT
    const seed2 = 'walk capable spin today category pool twenty miss piano check reform vocal'
    await walletInstance.fromSeed(seed2, config).then((res) => {
        expect(res.status).toBe('success');
    });
    const kp2 = walletInstance.getNewKeypair([]).content?.newKeypairResponse;

    const result = await walletInstance.fetchPending2WayPayment(
        kp2!,
    ).then((res) => {
        // console.log('res ', res)
        return JSON.parse((res.content! as any).fetchPending2WResponse);
    });

    if (result) {
        console.log('fetch result: ', result);
    }

    console.log('accept payment')
    await walletInstance.accept2WayPayment(result!.druid, result!, [kp2!]).then((res) => {
        console.log('FINAL ', res)
    })

    // console.log('reject')
    // await walletInstance.reject2WayPayment(result!.druid, result!, [kp2!]).then((res) => {
    //     console.log('FINAL ', res)
    // })
});
