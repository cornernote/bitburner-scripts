import {Runner} from './lib/Runner';

/**
 * @param {NS} ns
 */
export async function main(ns) {

    const runner = new Runner(ns)
    const hostname = 'n00dles'
    const output = await runner.nsProxy['scan'](hostname);

    ns.tprint(output)
}


function countedTowardsMemory(ns) {
    ns.run('fake.js')
    ns.isRunning('fake.js', 'home')
    ns.scan()
    // adds 0.5gb, which is enough to run .hacknet locally
    //ns.getPlayer()
}
