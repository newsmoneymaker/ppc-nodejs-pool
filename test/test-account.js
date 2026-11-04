// Unit checks of the PoolPayCoin address handling (bech32 basecoin addresses). Run: node test/test-account.js
const path = require('path');
global.config = {};
const u = require(path.join(__dirname, '../lib/utils.js'));

// a valid basecoin address (the developer donation address of the project)
const {makeAddress} = require('./testaddr.js');
const OK = makeAddress(1);
let failed = 0;
function check (name, cond) { console.log((cond ? 'ok   ' : 'FAIL ') + name); if (!cond) failed++; }

check('valid basecoin address', u.validateMinerAddress(OK));
check('canonical form is the address itself', u.canonicalMinerAddress(OK) === OK);
const flipped = OK.slice(0, -1) + (OK.slice(-1) === 'q' ? 'p' : 'q');
check('bad checksum rejected', !u.validateMinerAddress(flipped));
check('upper case rejected', !u.validateMinerAddress(OK.toUpperCase()));
check('other prefix rejected', !u.validateMinerAddress(makeAddress(1, 'bc')) && !u.validateMinerAddress(makeAddress(1, 'tppc')));
check('real address from the network', u.validateMinerAddress('ppc1qnsl3wsepdfjt9xvctsglj3q0kj27ce8w7653a0') && u.addressScript('ppc1qnsl3wsepdfjt9xvctsglj3q0kj27ce8w7653a0') === '00149c3f1743216a64b299985c11f9440fb495ec64ee');
check('too short rejected', !u.validateMinerAddress(OK.slice(0, 30)));
check('too long rejected', !u.validateMinerAddress(OK + 'q'));
check('empty and non-string rejected', !u.validateMinerAddress('') && !u.validateMinerAddress(null) && !u.validateMinerAddress(42));
check('account = address, no note', u.parseMinerAccount(OK).account === OK && u.parseMinerAccount(OK).note === null);
check('split back', u.splitMinerAccount(OK).address === OK && u.splitMinerAccount(OK).note === null);
check('reward mode prefix', u.determineRewardData('solo:' + OK).rewardType === 'solo' && u.determineRewardData('solo:' + OK).address === OK);

const dev = u.donationTable({donations: {[OK]: 0.5, 'nonsense': 1, [OK.slice(0, -1) + 'q']: 50}});
check('donation table keeps valid entries only', Object.keys(dev).length === 1 && dev[OK] === 0.5);

console.log(failed ? '\n' + failed + ' check(s) failed' : '\nall checks passed');
process.exit(failed ? 1 : 0);
