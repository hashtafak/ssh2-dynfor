
const fs = require('fs');
const path = require('path');
const Dynfor = require('../dist/dynfor');

(async () => {
    const list = fs
        .readFileSync(path.resolve(__dirname, './n/ssh.txt'), {
            encoding: 'utf8',
        })
        .split(/[\r\n]+/)
        .map(ln => ln.split('|'))
        .filter(ln => ln.length > 2)
        .map(ln => Object.assign({}, {
            host: ln[0],
            username: ln[1],
            password: ln[2],
        }))
        .splice(0, 5);

    const conn = new Dynfor({
        list,
        parallelConnect: 2,
        host: 'null',
        username: 'null',
        password: 'null',
        port: 22,
        sshForwardPort: 1080,
        keepaliveInterval: 60000,
        keepaliveCountMax: 10,
    });

    await conn.ConnectList()
        .then(() => {
            console.log('DONE');

            setTimeout(async () => {
                try {
                    await conn.StopAccepting();
                    await conn.CloseTunnel(true);
                    process.exit(0);
                } catch (e) {
                    console.log(e);
                }
            }, 5000);
        })
        .catch(c => console.log(c));
})();
