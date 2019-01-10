require('./server');
const Dynfor = require('../dist/dynfor');

test('Connection must fail on wrong port or ip', async () => {
    try {
        Dynfor({
            host: 'localhost',
            port: 3,
            username: 'foo',
            password: 'bar',
            sshForwardPort: 1080,
            keepaliveInterval: 60000,
            keepaliveCountMax: 10,
        });
    } catch (e) {
        expect.any(TypeError);
    }

    try {
        Dynfor({
            host: '192.1.1.1',
            username: 'foo',
            password: 'bar',
            sshForwardPort: 1080,
            keepaliveInterval: 60000,
            keepaliveCountMax: 10,
        });
    } catch (e) {
        expect(e).toBe(TypeError);
    }
});

test('Connection successful w/ no error', async () => {
    try {
        Dynfor({
            host: 'localhost',
            username: 'foo',
            password: 'bar',
            sshForwardPort: 1080,
            keepaliveInterval: 60000,
            keepaliveCountMax: 10,
        });
    } catch (e) {
        expect(e).toBeNull();
    }
});

test('Connection successful and disconnect after 5s w/ no error ', async () => {
    try {
        const conn = Dynfor({
            host: 'localhost',
            username: 'foo',
            password: 'bar',
            sshForwardPort: 1080,
            keepaliveInterval: 60000,
            keepaliveCountMax: 10,
        });

        setTimeout(async () => {
            await conn.StopAccepting();
            await conn.CloseTunnel();
        }, 5000);
    } catch (e) {
        expect(e).toBeNull();
    }
});

test('Connection successful but throw error when call StopAccepting and CloseTunnel', async () => {
    try {
        const conn = Dynfor({
            host: 'localhost',
            username: 'foo',
            password: 'bar',
            sshForwardPort: 1080,
            keepaliveInterval: 60000,
            keepaliveCountMax: 10,
        });

        await conn.StopAccepting();
        await conn.CloseTunnel();
    } catch (e) {
        expect.any(TypeError);
    }
});
