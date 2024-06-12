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

    // Alice
    const seed = 'potato home pond music way wood fatigue lonely cabin write put emerge'
    const encryptedTx = {
        druid: 'DRUID0x43f7b412ef5b643aab49e41248d7520e',
        nonce: '46f2e3dd-8958-4329-8527-',
        save: 'YI8Z6xiof/5QcAac/96utH5p+XLQH0TDXVGRfjmR1F0v1zFsCo1SIhmAsgQKtQkN2OExlXo8Hf2vorVR3DBfr+HVt0DOQb0CA95IcJ7rLh/LvbSOQxWqzOiSGlYAnPbuuGxR1MhKhcjeLI/8bq42c0J/H3RuS8Myt3QW6knouUS50Z+51n0sw23VhSqVp6lLWAUOtQwutD7HWcTWXVoWrggK1JSaUfzfSkFQpowqt4G8gP5kjjxMpuKZDWmofXoBR6sWALew9ySOQuwqJ9CChJCWqQw2wSLF5R2lfG97eyhEajd1bMXrdfz/L6lGjQrZO3CyoX0ouLoaYBzkL4hbsP6R+TXV+NTuUC65hHFKsDWRprkV0WNY8vWrd1FWKIt3rTIhXcFl0gOea74WLD0jOxzGMe0OPlcO0JE37idOeqzGn9xkMgA+2Ud/us9u4fzbOS+cigHYvvbBgHxSV3QI9AewibT5Z3q0eDbNIhtgUK2+wcWTkECZ3dz0e0BZVO28kai7AmAOyyjOEH4r7ESo4M9csxmtyORRcsAMMzlbCpSzylRVl3gBAidPPzXiLtiOyoMcYqje+7htJSbtRpMy88CS4cTEtDdW6KuZ3ExUR3Ehn38PFdKQnp65egiLwd84NGyRf+y4TSbes5nMylvVJxa/LbNNsArbcxVQf65U53IYu0GtIH1hSs3WCzeGiyeYYIP04VNzlXQD+4xHCzvgeJon86iGZgX6mdTj3dtJVC/uE7Ae76HhRPL3qhBVEuOGfh1Yshiv368eJ726GVVcy9NRAXWLmmhLER71OAs04Jc1i4VbhjweeklTvxRxy31zrjs6g9u2CzcDZcqPjbo1kUGOYu2p+8RaKjG6oIK5JcXK5mAAk1VqPSte1AkppKCLrjMlaERWrSfH5GGj7AQfxL/te/8in7Yuugd2VeIWdhiHuHXnC0zSuUD4h8MNZxxogBZkT9yDUGSgrP9Th6uk3A7/YPemrp44jZp+gB7VkLStXyZvdiN9ofBaHkDT5HsWZBv6xE7TJvn1g0bsR9Y5bA6a/pvFejG7qKhOJgf576EOih4jelVCAC9lNByPMz+wG2LbUpEdPoe33P1pDvChQ2zMY+bxY2O+Rou3aYUcahi7M7q6xeg5AoA1I4e/HimlZxCMKiGkZO/TkRW3/UcOaIwUsUiqWyrdPkgl8l0Z5rPwfRu+/W5aTua8RGNGte8G0BL7dC3TwJVZsHtOJu7/yqry7D7iBz+Dg0c55C6bsRu6jLZ9B2RdaNim4Kh+R0ysvB1T5MGVEuWMrpNyZMiqDAjchI+gaXTZNxnwzSBrZk+dZI9AaUgQU7nXxNL0A+p9+GQ8nPlSuUyol06TcZVVsvLScfj3vHFBWysLZt8QffpIZu5FbllT+ZnESL8IS1Ce40RrlS4V23wnugvOGTPDmlbxTj4c3Y4iD30Aio31P6oIBjdSZt3ilcBUVAr9pXJ7UaTLda3yDdOheJqWZBuOLrbgnrs6Np/pSnjodLq8fvU293RgPu3mn5K4bMtNaVyUriIQoRzUkA=='
    }

    await walletInstance.fromSeed(seed, config).then((res) => {
        console.log('wallet: ', res)
        expect(res.status).toBe('success');
    });
    const kp = walletInstance.getNewKeypair([]).content?.newKeypairResponse;

    const result = await walletInstance.fetchPending2WayPayment(
        kp!,
        [encryptedTx]
    ).then((res) => {
        console.log('res ', res)
        return res.content!.fetchPending2WResponse;
    });

    if (result) {
        console.log('validate fetch result: ', result);
    }
});
