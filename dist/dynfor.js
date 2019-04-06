/* eslint-disable no-underscore-dangle */

const socks = require('@hashtafak/socksv5');
const debug = require('debug');
const SshClient = require('ssh2').Client;
const validateConfig = require('./config');

class Dynfor {
    constructor(sshConfig) {
        this.SSH_CONFIG = validateConfig(sshConfig);
        this.DynforDebug = debug(`dynfor:${this.SSH_CONFIG.sshForwardPort || 0}`);
        this.DynforDebugSocks = debug(`dynfor:${this.SSH_CONFIG.sshForwardPort || 0}:socks`);
        this.DynforDebug(this.SSH_CONFIG);
        this._ = {};
    }

    Connect() {
        return new Promise((resolve, reject) => {
            this._.conn = new SshClient();

            this.DynforDebug('Started a new SSH2 session.');
            this.DynforDebug(`Connecting to SSH2 server ${this.SSH_CONFIG.host}`);

            this._.conn
                .on('ready', () => {
                    this.DynforDebug('Connection established.');
                    this._.socks = socks;
                    this._.socks = socks.createServer((info, accept) => {
                        this._.conn.forwardOut(info.srcAddr,
                            info.srcPort,
                            info.dstAddr,
                            info.dstPort,
                            (err, stream) => {
                            // if (this._.socks.waitForChannelClose) {
                            //     deny();
                            // }

                                this.DynforDebugSocks(`Accepted new proxy connection from ${info.srcAddr}:${info.srcPort} on 127.0.0.1:${this.SSH_CONFIG.sshForwardPort}.`);
                                if (err) {
                                    this.DynforDebugSocks('Failed to open channel for client-to-server SOCKSv5: ', err.message);
                                } else {
                                    this.DynforDebugSocks(`Started SOCKSv5 proxy request from ${info.srcAddr}:${info.srcPort} on 127.0.0.1:${this.SSH_CONFIG.sshForwardPort} to connect to ${info.dstAddr}:${info.dstPort}.`);
                                    const clientSocket = accept(true);
                                    if (clientSocket) {
                                        stream.pipe(clientSocket).pipe(stream).on('close', () => {
                                            this.DynforDebugSocks(`Closed channel for client-to-server SOCKSv5 proxy forwarding from ${info.srcAddr}:${info.srcPort} on 127.0.0.1:${this.SSH_CONFIG.sshForwardPort} to ${info.dstAddr}:${info.dstPort}. Bytes sent: ${clientSocket.bytesWritten}, received: ${clientSocket.bytesRead}.`);
                                        });
                                    }
                                }
                            });
                    }).on('listening', () => {
                        this._.socks.listening = true;
                        this.SSH_CONFIG.sshForwardPort = this._.socks.address().port;
                        this._.SSH_CONFIG = this.SSH_CONFIG;
                        this.DynforDebugSocks(`Enabled SOCKS/HTTP proxy forwarding on 127.0.0.1:${this.SSH_CONFIG.sshForwardPort}.`);
                        resolve();
                    }).on('error', (e) => {
                        if (this.SSH_CONFIG.sshForwardPortWever && e.code === 'EADDRINUSE') {
                            this.DynforDebugSocks(`Address 127.0.0.1:${this.SSH_CONFIG.sshForwardPort} already in use, retrying another PORT.`);

                            setTimeout(() => {
                                this._.socks.listen(0, 'localhost');
                            }, 1000);
                        } else {
                            this.DynforDebugSocks(`Failed to enable SOCKS/HTTP proxy forwarding on 127.0.0.1:${this.SSH_CONFIG.sshForwardPort}. Error: ${e.message}`);
                            this._.conn.end();
                            reject(e);
                        }
                    }).on('close', () => {
                        this.DynforDebugSocks(`Stopped SOCKS/HTTP proxy forwarding on 127.0.0.1:${this.SSH_CONFIG.sshForwardPort}.`);
                        this._.socks.listening = false;
                    })
                        .listen(this.SSH_CONFIG.sshForwardPort, 'localhost')
                        .useAuth(this._.socks.auth.None());
                })
                .on('error', async (e) => {
                    this.DynforDebug('Connection failed. Error:', e.message);

                    this._.conn.end();

                    if (this.SSH_CONFIG.reconnection.type === 2) {
                        await new Promise(r => setTimeout(r, 1000));

                        this.DynforDebug(`Reconnecting to SSH2 server ${this.SSH_CONFIG.host}. Delay: ${this.SSH_CONFIG.readyTimeout}`);
                        // this.StopAccepting();

                        if (this.SSH_CONFIG.readyTimeout < 60000) {
                            this.SSH_CONFIG.readyTimeout = this.SSH_CONFIG.reconnection
                                .firstReconnectionTimeout;
                            this.SSH_CONFIG.reconnection.firstReconnectionTimeout *= 2;
                        }

                        await this.Connect().catch(er => this.DynforDebug(`Reconnecting to SSH2 server ${this.SSH_CONFIG.host}. Delay: ${this.SSH_CONFIG.readyTimeout}. Error: ${er}`));
                    } else {
                        reject(e);
                    }
                })
                .on('end', async () => {
                    this.DynforDebug('The SSH2 session has been terminated.');

                    if (this._.socks.listening && !this._.conn.endByUser
                        && this.SSH_CONFIG.reconnection.type === 1) {
                        await new Promise(r => setTimeout(r, 1000));

                        this.DynforDebug(`Reconnecting to SSH2 server 
                        ${this.SSH_CONFIG.host}. Delay: ${this.SSH_CONFIG.readyTimeout}`);
                        this.StopAccepting()
                            .catch(e => this
                                .DynforDebug(`Reconnecting to SSH2 server 
                                ${this.SSH_CONFIG.host}. Delay: 
                                ${this.SSH_CONFIG.readyTimeout}. Error: ${e}`));

                        if (this.SSH_CONFIG.readyTimeout < 60000) {
                            this.SSH_CONFIG.readyTimeout = this.SSH_CONFIG.reconnection
                                .firstReconnectionTimeout;
                            this.SSH_CONFIG.reconnection.firstReconnectionTimeout *= 2;
                        }

                        await this.Connect().catch(e => this.DynforDebug(`Reconnecting to SSH2 server ${this.SSH_CONFIG.host}. Delay: ${this.SSH_CONFIG.readyTimeout}. Error: ${e}`));
                    } else {
                        reject(new Error('The SSH2 session has been terminated without a reason.'));
                    }
                })
                .connect(this.SSH_CONFIG);
        });
    }

    ConnectList() {
        this.DynforDebug('Total SSH in List: ', this.SSH_CONFIG.list.length);

        const sshList = this.SSH_CONFIG.parallelConnect < this.SSH_CONFIG.list.length
            ? this.SSH_CONFIG.list.slice(0, this.SSH_CONFIG.parallelConnect)
            : this.SSH_CONFIG.list;

        this.SSH_CONFIG.list = sshList;

        this.DynforDebug('Total SSH in use to connect: ', sshList.length);

        let isOver = false;

        const promises = sshList.map((ssh, id) => new Promise((resolve) => {
            const conn = new SshClient();

            this.DynforDebug(id, 'Started a new SSH2 session.');
            this.DynforDebug(id, `Connecting to SSH2 server ${ssh.host}`);

            let connInterval;

            conn
                .on('ready', () => {
                    this.DynforDebug(id, 'Connection established.');
                    if (isOver === false) {
                        clearInterval(connInterval);
                        resolve({ conn, id });
                    } else {
                        conn.end();
                    }
                }).on('error', (e) => {
                    clearInterval(connInterval);
                    this.DynforDebug(id, 'Connection failed. Error:', e.message);
                    conn.end();
                    // reject(e);
                }).on('end', () => {
                    clearInterval(connInterval);
                    this.DynforDebug(id, 'The SSH2 session has been terminated.');
                    // reject();
                }).connect(Object.assign(this.SSH_CONFIG, ssh));

            connInterval = setInterval(() => {
                try {
                    if (isOver === true) {
                        this.DynforDebug(id, 'Dynfor Force Terminate Session.');

                        clearTimeout(conn._readyTimeout);
                        conn.end();
                        conn._sock.destroy();
                        conn.emit('close');
                        conn.emit('end');
                    }
                } catch (e) {
                    // catch e
                    this.DynforDebug(id, e);
                }
            }, 2000);
        }).catch((e) => {
            this.DynforDebug('Unexpected Err', e);
            e = undefined; // eslint-disable-line no-param-reassign
        }));

        return Promise.race(promises)
            .then((race) => {
                isOver = true;

                this._.conn = race.conn;

                this.DynforDebugSocks('Racer ID', race.id, 'is faster!', this.SSH_CONFIG.list[race.id]);
                this.SSH_CONFIG.list.concat(this.SSH_CONFIG.list.splice(race.id, 1));

                this.DynforDebugSocks(this.SSH_CONFIG.list);

                return new Promise((resolve, reject) => {
                    this._.socks = socks;
                    this._.socks = socks.createServer((info, accept) => {
                        this._.conn.forwardOut(info.srcAddr,
                            info.srcPort,
                            info.dstAddr,
                            info.dstPort,
                            (err, stream) => {
                                // if (this._.socks.waitForChannelClose) {
                                //     deny();
                                // }

                                this.DynforDebugSocks(`Accepted new proxy connection from ${info.srcAddr}:${info.srcPort} on 127.0.0.1:${this.SSH_CONFIG.sshForwardPort}.`);
                                if (err) {
                                    this.DynforDebugSocks('Failed to open channel for client-to-server SOCKSv5: ', err.message);
                                } else {
                                    this.DynforDebugSocks(`Started SOCKSv5 proxy request from ${info.srcAddr}:${info.srcPort} on 127.0.0.1:${this.SSH_CONFIG.sshForwardPort} to connect to ${info.dstAddr}:${info.dstPort}.`);
                                    const clientSocket = accept(true);
                                    if (clientSocket) {
                                        stream.pipe(clientSocket).pipe(stream).on('close', () => {
                                            this.DynforDebugSocks(`Closed channel for client-to-server SOCKSv5 proxy forwarding from ${info.srcAddr}:${info.srcPort} on 127.0.0.1:${this.SSH_CONFIG.sshForwardPort} to ${info.dstAddr}:${info.dstPort}. Bytes sent: ${clientSocket.bytesWritten}, received: ${clientSocket.bytesRead}.`);
                                        });
                                    }
                                }
                            });
                    }).on('listening', () => {
                        this._.socks.listening = true;
                        this.SSH_CONFIG.sshForwardPort = this._.socks.address().port;
                        this._.SSH_CONFIG = this.SSH_CONFIG;
                        this.DynforDebugSocks(`Enabled SOCKS/HTTP proxy forwarding on 127.0.0.1:${this.SSH_CONFIG.sshForwardPort}.`);
                        resolve();
                    }).on('error', (e) => {
                        if (this.SSH_CONFIG.sshForwardPortWever && e.code === 'EADDRINUSE') {
                            this.DynforDebugSocks(`Address 127.0.0.1:${this.SSH_CONFIG.sshForwardPort} already in use, retrying another PORT.`);

                            setTimeout(() => {
                                this._.socks.listen(0, 'localhost');
                            }, 1000);
                        } else {
                            this.DynforDebugSocks(`Failed to enable SOCKS/HTTP proxy forwarding on 127.0.0.1:${this.SSH_CONFIG.sshForwardPort}. Error: ${e.message}`);
                            this._.conn.end();
                            reject(e);
                        }
                    }).on('close', () => {
                        this.DynforDebugSocks(`Stopped SOCKS/HTTP proxy forwarding on 127.0.0.1:${this.SSH_CONFIG.sshForwardPort}.`);
                        this._.socks.listening = false;
                    })
                        .listen(this.SSH_CONFIG.sshForwardPort, 'localhost')
                        .useAuth(this._.socks.auth.None());
                });
            });
    }

    StopAccepting() {
        return new Promise((resolve, reject) => {
            if (!this._.socks || !this._.socks.listening) {
                reject(new Error('Not yet listening to the Socks5 Server.'));
            }

            this.DynforDebug(`Stop SOCKS/HTTP proxy forwarding on 127.0.0.1:${this.SSH_CONFIG.sshForwardPort}.`);
            resolve(this._.socks.close());
        });
    }

    CloseTunnel(waitForChannelClose) {
        return new Promise((resolve, reject) => {
        // this._.socks.waitForChannelClose = waitForChannelClose;

            if (!this._.conn) {
                reject(new Error('Not yet connected to the SSH tunnel.'));
            }

            if (waitForChannelClose) {
                new Promise((r) => {
                    const interval = setInterval(() => {
                        if (this._.socks.listening === false) {
                            r(clearInterval(interval));
                        }
                    }, 1000);
                }).then();
            }

            this._.conn.endByUser = true;
            this.DynforDebug("Session disconnected on user's request.");
            resolve(this._.conn.end());
        });
    }
}

module.exports = Dynfor;
