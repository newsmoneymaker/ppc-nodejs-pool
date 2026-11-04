# ppc-nodejs-pool

Mining pool software for **PoolPayCoin (PPC)** written in Node.js: a stratum server for PoolPayCoin's RandomX with share checking, block building from the node's
block template, block accounting through the pool wallet, and batch payouts. It is a fork of [cryptonote-nodejs-pool](https://github.com/dvandal/cryptonote-nodejs-pool)
by Dvandal (GNU GPL v2) and of its adaptations [epic-nodejs-pool](https://github.com/newsmoneymaker/epic-nodejs-pool), [veil-nodejs-pool](https://github.com/newsmoneymaker/veil-nodejs-pool),
[qwc-nodejs-pool](https://github.com/newsmoneymaker/qwc-nodejs-pool), [c64-nodejs-pool](https://github.com/newsmoneymaker/c64-nodejs-pool) and [scash-nodejs-pool](https://github.com/newsmoneymaker/scash-nodejs-pool),
written for the Bitcoin Core based node and wallet RPC of PoolPayCoin. Live example: <https://ppc.pool-pay.com>.

## What it does

* **Stratum server** (plain TCP and TLS ports, XMRig protocol with the `algo` extension): the pool asks the node for a block template (`getblocktemplate`), **builds the
  block itself** (coinbase with the BIP34 height, an extranonce and the SegWit witness commitment, merkle root, the 112 byte PoolPayCoin header) and gives every miner the header
  with its own nonce start and a share target that follows the miner's hashrate (vardiff, remembered across reconnects). It checks every share itself with a small C++
  helper (`hasher/rxhash --poolpay`): the RandomX hash and the RandomX commitment of the header, using PoolPayCoin's own RandomX library (its own Argon2 salt, built from
  PoolPayCoin's own source, never borrowed from another coin). A share that meets the network target is submitted to the node as a whole block with `submitblock`.
* **PoolPayCoin proof of work**: RandomX 1.2.1 with the Argon2 salt `RandomX-PoolPay`, key = SHA256d(`PoolPay/RandomX/Epoch/<time / 7 days>`),
  input = the 112 byte header (nonce at byte 76, hashRandomX zero), the block is valid when the RandomX commitment is not above the target and the header carries the hash.
  The algorithm is `rx/pp` in [poolpayminer](https://github.com/newsmoneymaker/poolpayminer).
* **Accounts** are native SegWit addresses (`ppc1q...`, 45 characters, bech32 checksum verified), optionally `+worker`, with a reward mode prefix `prop:` (shared, default) or `solo:`.
* **Rewards:** PROP with time weighting (slush) or SOLO.
* **Block unlocker:** a block is settled after `depth` blocks (PoolPayCoin's coinbase maturity is 100). The reward is what the pool wallet received in the block's coinbase transaction
  (`gettransaction`); a block that is no longer on the chain is marked orphaned and nothing is credited.
* **Payment processor:** everyone who is due is paid in **one `sendmany` transaction per round** (the network fee is shared by the paid miners or paid by the pool). The balance is debited
  before sending; a batch whose outcome is unknown (crash, timeout) is found again in the wallet by its comment and never sent twice; refused or stuck batches go back to the balances.
  Dry-run mode, a whitelist for rehearsals and an emergency brake (`deployment/pause-payments.sh`).
* **Website and API:** an example website (`website_example/`) with the dashboard and its four graphs, blocks, payments, top miners, worker statistics, a "Getting started" page with a config
  generator, and the public read-only JSON API. (PoolPayCoin's own `ppc.pool-pay.com` site is a separate, custom build, not this example as-is.)
* **Protection against connection floods:** limits per IP, a login deadline, an optional IP allow list, banning of miners with many invalid shares.
* **Tests** (`test/`): the hashing is checked against real PoolPayCoin blocks once real chain history exists (`test/test-real-blocks.js` has no vectors yet -- this chain just launched
  with its own fresh genesis block), a simulated node lets a real RandomX miner find shares and blocks against the pool code, and `test/test-poolpay-regtest.js` runs the whole chain
  against a **real `poolpaycoind` on regtest**: the block built by the pool must be accepted by the node.

## Pool fee

Configured in `config.json` (see `config_examples/ppc.json`):

```json
"blockUnlocker": {
  "poolFee": 1,
  "donations": {}
}
```

* `poolFee` is the fee of the pool operator (percent). `donations` is an optional table `PPC address -> percent` (up to 10% per entry); PoolPayCoin's own pool ships with no forced
  donation cut (`{}`).
* It is included in the "Pool Fee" figure that the pool's website and API show to the miners (as in the original software).
* You are free to change the percentage or add a donation entry: it is your pool and the license is the GPL. Please tell your miners the truth about the fees of your pool.
* This has nothing to do with the miner poolpayminer (a separate project with its own fee).

## Installation

See [docs/INSTALL.md](docs/INSTALL.md): the PoolPayCoin node and wallet (build from source), the RandomX helper, Redis, the pool services (systemd templates in `deployment/`), the website and the first payout rehearsal.

Requirements: Linux, Node.js 18 or newer, Redis, a PoolPayCoin node (`poolpaycoind` 1.0.0 / Bitcoin Core 27 based) synchronised with the network, a C++ compiler for the helper and the node's RandomX library, a web server
for the website and a TLS certificate for the TLS stratum ports.

## Miners

[poolpayminer](https://github.com/newsmoneymaker/poolpayminer) (Windows and Linux, free, has its own fee) knows the algorithm `rx/pp`.
Example: `poolpayminer -a rx/pp --tls -o ppc.pool-pay.com:5401 -u ppc1qYourAddress+rigname -p x -k`.

## Tests

```
npm install
node test/test-account.js                 # address handling, needs nothing else
make -C hasher RANDOMX=/path/to/prefix    # the node's depends/<host> directory has include/randomx.h and lib/librandomx.a
node test/test-real-blocks.js             # the hash and commitment of real mainnet blocks, needs only the helper
# The others use test/config.test.json and a THROWAWAY Redis on port 16379 (they flush it, never point them at a real database):
redis-server --port 16379 --requirepass CHANGE_ME_REDIS_PASSWORD --save "" --appendonly no &
node test/test-poolpay-pool.js            # simulated node + pool + a miner that really mines
node test/test-poolpay-payments.js        # unlocker and payments against a simulated node and wallet
node test/test-poolpay-regtest.js         # a real poolpaycoind on regtest accepts a block built by the pool (MINER_BIN=<poolpayminer> also mines with the real miner)
```

## Money warning

The payment processor moves real coins. Rehearse first: `"dryRun": true`, then a whitelist (`onlyAccounts`) with a few small payouts of your own, then enable it. A transaction that has been sent to the network
can not be cancelled. Keep the wallet backup (`listdescriptors true`) and the RPC password private.

## License and credits

GNU GPL v2 (see [LICENSE](LICENSE)). Based on cryptonote-nodejs-pool, Copyright (c) Dvandal and contributors. PoolPayCoin and RandomX are separate programs and are not included.
