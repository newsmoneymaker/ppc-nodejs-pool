# Changes

## 1.0.0

* First release: PoolPayCoin (PPC, Bitcoin Core 27 with RandomX) pool derived from scash-nodejs-pool (itself derived from veil-nodejs-pool, qwc-nodejs-pool and
  epic-nodejs-pool). PoolPayCoin is a brand-new chain with its own genesis block, not a fork of an existing network's live chain.
* The pool builds the blocks itself from `getblocktemplate` (`lib/blockBuilder.js`): coinbase with the BIP34 height, an extranonce, the pool's output and the SegWit
  witness commitment, the merkle root, the 112 byte PoolPayCoin header; a solved block is sent with `submitblock`.
* Proof of work: RandomX 1.2.1 with PoolPayCoin's own Argon2 salt, key = SHA256d of the epoch string (7 days), input = the 112 byte header
  with hashRandomX zero, blocks judged by the RandomX commitment. The helper `hasher/rxhash --poolpay` answers the hash and the commitment; it is built against
  PoolPayCoin's own RandomX library (its own Argon2 salt, never borrowed from another coin's build).
* Payments and unlocker as in Bitcoin based pools (`sendmany`, `gettransaction`, coinbase maturity 100), native SegWit addresses (`ppc1q...`, 45 characters).
* The variable difficulty of a worker is remembered across reconnects (`poolServer.diffMemoryMinutes`, default 15).
* Block reward: 10 PPC, halved every 1,050,000 blocks (21,000,000 PPC cap), matching the node's own `GetBlockSubsidy()`/`nSubsidyHalvingInterval` -- NOT the
  template's inherited 50-coin/210,000-block Bitcoin default.
* Tests: address handling, a simulated node (`test-poolpay-pool.js`, `test-poolpay-payments.js`), real mainnet blocks (`test-real-blocks.js`, no vectors yet --
  this chain just launched) and an END TO END test against a real `poolpaycoind` on regtest (`test-poolpay-regtest.js`): a block built by the pool is accepted
  by the node, optionally mined by a real miner.
* Not yet checked on a block found on mainnet: the payout with the real wallet (`sendmany` with `subtractfeefrom`). `payments.dryRun` stays `true` until a real
  block is found and paid out correctly end to end.
