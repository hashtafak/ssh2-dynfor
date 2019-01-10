require('./server');
const Dynfor = require('../dist/dynfor');

(async () => {
    const conn = new Dynfor({
        host: 'localhost',
        port: 22,
        username: 'foo',
        password: 'bar',
        sshForwardPort: 1080,
        keepaliveInterval: 60000,
        keepaliveCountMax: 10,
    });

    await conn.Connect().catch(e => console.log('Connect e:', e));

    setTimeout(async () => {
        try {
            await conn.StopAccepting();
            await conn.CloseTunnel(true);
        } catch (e) {
            console.log(e);
        }
    }, 5000);
})();
