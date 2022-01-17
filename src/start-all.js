/**
 * Start hacking stuff
 *
 * @param {NS} ns
 */
export async function main(ns) {
    ns.run('root-servers.js', 1, '--loop')
    ns.run('buy-cracks.js', 1, '--loop')
    ns.run('host-manager.js', 1, '--loop')
    ns.run('port-reader.js', 1, '--loop')
    ns.run('attack-servers.js', 1, '--loop')
}

