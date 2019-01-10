const socks = require('socksv5');
const debug = require('debug');
const SshClient = require('ssh2').Client;
const validateConfig = require('./config');

function Dynfor(sshConfig) {
    const SSH_CONFIG = validateConfig(sshConfig);

    const DynforDebug = debug(`dynfor:${SSH_CONFIG.sshForwardPort || 0}`);

    DynforDebug(SSH_CONFIG);

    this._ = {};

    this.Connect = () => new Promise((resl, reject) => {
        this._.socks = socks;
        this._.conn = new SshClient();

        DynforDebug('Started a new SSH2 session.');
        DynforDebug(`Connecting to SSH2 server ${SSH_CONFIG.host}.`);
        this._.conn.on('ready', () => {
            DynforDebug('Connection established.');
            this._.socks = socks.createServer((info, accept) => {
                this._.conn.forwardOut(info.srcAddr,
                    info.srcPort,
                    info.dstAddr,
                    info.dstPort,
                    (err, stream) => {
                        // if (this._.socks.waitForChannelClose) {
                        //     deny();
                        // }

                        DynforDebug(`Accepted new proxy connection from ${info.srcAddr}:${info.srcPort} on 127.0.0.1:${SSH_CONFIG.sshForwardPort}.`);
                        if (err) {
                            DynforDebug('Failed to open channel for client-to-server SOCKSv5: ', err.message);
                        } else {
                            DynforDebug(`Started SOCKSv5 proxy request from ${info.srcAddr}:${info.srcPort} on 127.0.0.1:${SSH_CONFIG.sshForwardPort} to connect to ${info.dstAddr}:${info.dstPort}.`);
                            const clientSocket = accept(true);
                            if (clientSocket) {
                                stream.pipe(clientSocket).pipe(stream).on('close', () => {
                                    DynforDebug(`Closed channel for client-to-server SOCKSv5 proxy forwarding from ${info.srcAddr}:${info.srcPort} on 127.0.0.1:${SSH_CONFIG.sshForwardPort} to ${info.dstAddr}:${info.dstPort}. Bytes sent: ${clientSocket.bytesWritten}, received: ${clientSocket.bytesRead}.`);
                                });
                            }
                        }
                    });
            }).on('listening', () => {
                this._.socks.listening = true;
                SSH_CONFIG.sshForwardPort = this._.socks.address().port;
                this._.SSH_CONFIG = SSH_CONFIG;
                DynforDebug(`Enabled SOCKS/HTTP proxy forwarding on 127.0.0.1:${SSH_CONFIG.sshForwardPort}.`);
                resl();
            }).on('error', (e) => {
                if (SSH_CONFIG.sshForwardPortWever && e.code === 'EADDRINUSE') {
                    DynforDebug(`Address 127.0.0.1:${SSH_CONFIG.sshForwardPort} already in use, retrying another PORT.`);

                    setTimeout(() => {
                        this._.socks.listen(0, 'localhost');
                    }, 1000);
                } else {
                    DynforDebug(`Failed to enable SOCKS/HTTP proxy forwarding on 127.0.0.1:${SSH_CONFIG.sshForwardPort}. Error: ${e.message}`);
                    this._.conn.end();
                    reject(e);
                }
            }).on('close', () => {
                DynforDebug(`Stopped SOCKS/HTTP proxy forwarding on 127.0.0.1:${SSH_CONFIG.sshForwardPort}.`);
                this._.socks.listening = false;
            })
                .listen(SSH_CONFIG.sshForwardPort, 'localhost')
                .useAuth(this._.socks.auth.None());
        }).on('error', async (e) => {
            DynforDebug('Connection failed. Error:', e.message);

            this._.conn.end();

            if (SSH_CONFIG.reconnection.type === 2) {
                await new Promise(resolve => setTimeout(resolve, 1000));

                DynforDebug(`Reconnecting to SSH2 server ${SSH_CONFIG.host}. Delay: ${SSH_CONFIG.readyTimeout}`);
                // this.StopAccepting();

                if (SSH_CONFIG.readyTimeout < 60000) {
                    SSH_CONFIG.readyTimeout = SSH_CONFIG.reconnection
                        .firstReconnectionTimeout;
                    SSH_CONFIG.reconnection.firstReconnectionTimeout *= 2;
                }

                await this.Connect();
            } else {
                reject(e);
            }
        }).on('end', async () => {
            DynforDebug('The SSH2 session has been terminated.');

            if (!this._.conn.endByUser && SSH_CONFIG.reconnection.type > 0) {
                await new Promise(resolve => setTimeout(resolve, 1000));

                DynforDebug(`Reconnecting to SSH2 server ${SSH_CONFIG.host}. Delay: ${SSH_CONFIG.readyTimeout}`);
                this.StopAccepting();

                if (SSH_CONFIG.readyTimeout < 60000) {
                    SSH_CONFIG.readyTimeout = SSH_CONFIG.reconnection
                        .firstReconnectionTimeout;
                    SSH_CONFIG.reconnection.firstReconnectionTimeout *= 2;
                }

                await this.Connect();
            }
        })
            .connect(SSH_CONFIG);
    });

    this.StopAccepting = () => {
        // this._.socks.waitForChannelClose = waitForChannelClose;

        // if (waitForChannelClose) {
        //     Promise(resolve => this._.socks.stream.on('close', () => {
        //         resolve();
        //     }));
        // }

        if (!this._.socks || !this._.socks.listening) {
            throw new Error('Not yet listening to the Socks5 Server.');
        }

        DynforDebug(`Stop SOCKS/HTTP proxy forwarding on 127.0.0.1:${SSH_CONFIG.sshForwardPort}.`);
        return this._.socks.close();
    };

    this.CloseTunnel = (waitForChannelClose) => {
        // this._.socks.waitForChannelClose = waitForChannelClose;

        if (waitForChannelClose) {
            Promise((resolve) => {
                const interval = setInterval(() => {
                    if (this._.socks.listening === false) {
                        resolve(clearInterval(interval));
                    }
                }, 1000);
            });
        }

        if (!this._.conn) {
            throw new Error('Not yet connected to the SSH tunnel.');
        }

        this._.conn.endByUser = true;
        DynforDebug("Session disconnected on user's request.");
        return this._.conn.end();
    };
}

module.exports = Dynfor;
