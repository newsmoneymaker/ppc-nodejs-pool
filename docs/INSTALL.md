# Installing a PoolPayCoin pool

Paths below match the real `ppc.pool-pay.com` deployment: the pool in `/root/claude/ppc-nodejs-pool`, the node's data in `/root/claude/poolpaycoin/data`, run as root under systemd
(the unit files in `deployment/systemd/` use these paths; adjust them if you install elsewhere).

## 1. PoolPayCoin node and wallet

PoolPayCoin is Bitcoin Core 27 with RandomX (`rx/pp`) -- a **brand-new chain with its own genesis block**, forked from [Scash](https://github.com/scashnetwork/scash)'s
already-RandomX-patched source as a starting template, not a fork of an existing live network. **Bitcoin Core 27 needs GCC 10.1 or newer (or Clang 14)**: on an older host build
in a newer userland (a Debian 11 chroot, `RootDirectory=` in the systemd unit; the RPC port is reachable from the host as usual).

```
./autogen.sh
make -C depends NO_QT=1 -j4                 # downloads and builds boost, libevent, sqlite, RandomX ... (about 30 minutes)
CONFIG_SITE=depends/x86_64-pc-linux-gnu/share/config.site ./configure --disable-tests --disable-bench --without-gui --disable-fuzz-binary
cd src && make -j4 poolpaycoind poolpaycoin-cli   # poolpaycoind auto-selects chain=poolpay from its own filename (no -chain= flag needed)
```

`/root/claude/poolpaycoin/data/poolpay.conf`:

```
chain=poolpay
server=1
listen=1
rpcuser=poolpaypool
rpcpassword=<a long random password>
rpcbind=127.0.0.1
rpcallowip=127.0.0.1
rpcport=8351
port=8350
dbcache=512
maxconnections=40
fallbackfee=0.00010000
wallet=operator
```

The chain has **no peers at all at launch**: the operator is the only node (no DNS seed, no addnode entries needed or possible yet). `poolpaycoin-cli getblockchaininfo` shows the
height; since this chain starts from its own fresh genesis, there is nothing to synchronise against until other nodes exist.

Create the pool wallet and its address (Core 27 has no default wallet):

```
poolpaycoin-cli createwallet operator
poolpaycoin-cli -rpcwallet=operator getnewaddress "" bech32          # ppc1q... : the pool address (poolServer.poolAddress)
poolpaycoin-cli -rpcwallet=operator listdescriptors true > wallet-descriptors.json   # THE recovery data: keep it offline, chmod 600, then shred the on-disk copy
```

Keep exactly one wallet loaded (the pool talks to the node's root RPC path, not `/wallet/<name>`) -- `wallet=operator` in `poolpay.conf` already does this and survives restarts.
`fallbackfee=0.0001` is needed: a node without fee estimates refuses `sendmany` otherwise.

## 2. RandomX helper

The helper must use PoolPayCoin's **own** RandomX build (its own Argon2 salt `RandomX-PoolPay`) -- never another coin's `librandomx.a`, even one built from the same depends system,
or shares will be checked against the wrong hash function and every real share will look invalid.

```
cd ppc-nodejs-pool/hasher && make STATIC=-static RANDOMX=/root/claude/poolpaycoin/src/depends/x86_64-pc-linux-gnu
```

`"hasher": {"light": true}` (256 MB RandomX cache, slower) is what this pool actually runs with; full/fast mode needs about 2.3 GB of RAM per thread for the dataset. Sanity-check
the binary with a known key/blob pair (`K <64 hex>` then `H <id> <224 hex>` over stdin) before trusting it against real shares.

## 3. Redis

Use a dedicated instance with a password and AOF (`deployment/redis-pool.conf.example`, unit `ppc-pool-redis`, port 6406).

## 4. The pool

```
cd ppc-nodejs-pool && npm install --production
cp config_examples/ppc.json config.json      # then edit it
```

Edit `config.json`: `poolHost`, `poolServer.poolAddress`, the ports and the certificate for TLS (`poolServer.sslCert/sslKey`), `redis`, `api.password`, `node.password` or `node.passwordFile`,
`blockUnlocker.poolFee` and `donations`, `payments`. **Keep `payments.dryRun: true` until the rehearsal below.**

```
cp deployment/systemd/*.service /etc/systemd/system/ && systemctl daemon-reload
systemctl enable --now ppc-pool-redis poolpay-node
systemctl enable --now ppc-pool ppc-pool-api ppc-pool-unlocker ppc-pool-payments ppc-pool-charts
```

The pool runs as separate modules (`init.js -module=pool|api|unlocker|payments|chartsDataCollector`), each in its own unit. The pool module keeps one hasher process (and its RandomX
dataset), so run it as one process. The RandomX key changes every 7 days (an epoch of PoolPayCoin): the pool re-initialises the helper by itself (jobs pause briefly). Until payouts
are proven, consider restricting the stratum ports with `poolServer.allowIPs`.

## 5. Website

`ppc.pool-pay.com` is a custom-built site, not `website_example/` as-is -- that directory is only a generic starting template from the upstream pool software. Whatever site is used,
proxy `/api`/`/stats` to the pool API on 127.0.0.1:8149 (`deployment/apache-vhost.conf.example` shows exposing only the read-only methods).

## 6. Rehearse the payments

1. `payments.dryRun: true`: the log of `ppc-pool-payments` shows what would be paid.
2. Fund the pool wallet with a few coins (or wait for the first real block), credit a small balance in Redis to your own test addresses (`PPC:workers:<address>`, field `balance`),
   set `payments.onlyAccounts` to them, `dryRun: false`, and watch the payout confirm.
3. Remove the test accounts from Redis and set `onlyAccounts` to `[]`.

Good to know: block rewards can be spent after 100 blocks (coinbase maturity); `deployment/pause-payments.sh` stops new payouts at once; the wallet must stay unlocked and online for
the payouts (the pool wallet runs unencrypted with only working balances in it, same as every other coin's pool wallet in this fleet).
