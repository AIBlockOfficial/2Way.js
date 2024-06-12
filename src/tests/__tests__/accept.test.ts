// import { SEED } from '../constants';
import { Wallet } from '../../services/wallet.service';

let walletInstance = new Wallet();

beforeEach(() => {
    jest.setTimeout(60000);
    walletInstance = new Wallet();
});

test('make 2 way payment', async () => {
    const config = {
        mempoolHost: 'https://mempool.aiblock.dev',
        storageHost: 'https://storage.aiblock.dev',
        valenceHost: 'http://0.0.0.0:3030',
        passphrase: '',
    };

    // Bob
    const seed2 = 'walk capable spin today category pool twenty miss piano check reform vocal'
    const asset = 'g08667340b04f40bb512dd8d74dcd1cf'
    const druid = 'DRUID0x830d2995a2f131e2f67e57348497e892'
    await walletInstance.fromSeed(seed2, config).then((res) => {
        expect(res.status).toBe('success');
    });
    const kp2 = walletInstance.getNewKeypair([]).content?.newKeypairResponse;
    await walletInstance.accept2WayPayment(druid, {} as any, [kp2!]).then((res) => {
        console.log('FINAL ', res)
    })
});