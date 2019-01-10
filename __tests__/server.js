const fs = require('fs');
// const crypto = require('crypto');
const utilInspect = require('util').inspect;

// const buffersEqual = require('buffer-equal-constant-time');
const SshServer = require('ssh2').Server;

// const ssh2Utils = ssh2.utils;
// const pubKey = ssh2Utils.genPublicKey(ssh2Utils.parseKey(fs.readFileSync('user.pub')));

const s = new SshServer({
    hostKeys: [fs.readFileSync('__tests__/host.key')],
}, ((client) => {
    // console.log('Client connected!');

    client.on('authentication', (ctx) => {
        // Note: Don't do this in production code, see
        // https://www.brendanlong.com/timing-attacks-and-usernames.html
        // In node v6.0.0+, you can use `crypto.timingSafeEqual()` to safely
        // compare two values.

        if (ctx.method === 'password'
            && ctx.username === 'foo'
            && ctx.password === 'bar') {
            ctx.accept();
            // } else if (ctx.method === 'publickey'
            //     && ctx.key.algo === pubKey.fulltype
            //     && buffersEqual(ctx.key.data, pubKey.public)) {
            //     if (ctx.signature) {
            //         const verifier = crypto.createVerify(ctx.sigAlgo);
            //         verifier.update(ctx.blob);
            //         if (verifier.verify(pubKey.publicOrig, ctx.signature)) {
            //             ctx.accept();
            //         } else {
            //             ctx.reject();
            //         }
            //     } else {
            //         // if no signature present, that means the client is just checking
            //         // the validity of the given public key
            //         ctx.accept();
            //     }
        } else {
            ctx.reject();
        }
    }).on('ready', () => {
        // console.log('Client authenticated!');

        client.on('session', (accept) => {
            const session = accept();
            session.once('exec', (acpt, rejc, info) => {
                console.log(`Client wants to execute: ${utilInspect(info.command)}`);
                const stream = acpt();
                stream.stderr.write('Oh no, the dreaded errors!\n');
                stream.write('Just kidding about the errors!\n');
                stream.exit(0);
                stream.end();
            });
        });

        // setTimeout(() => {
        //     client.end();
        // }, 5000);
    }).on('end', () => {
        // console.log('Client disconnected');
        // s.close();
    });
})).listen(22, '127.0.0.1', () => {
    // console.log('Listening on port 22');
});
