/**
 * Block reward of PoolPayCoin mainnet: 10 PPC, halved every 1,050,000 blocks (21,000,000 PPC cap, same
 * reward*interval*2 ratio Bitcoin itself uses, scaled for our 5x-faster 120s block time). Amounts in
 * atomic units (1 PPC = 1e8). The fees of the transactions in a block come on top; the pool reads the
 * exact reward of its own blocks from its wallet.
 **/
const PPC_BASE = 100000000;

exports.minerReward = function (height) {
	if (!(height > 0)) return 0;
	let halvings = Math.floor(height / 1050000);
	if (halvings >= 64) return 0;
	return Math.floor(10 * PPC_BASE / Math.pow(2, halvings));
};
