import {getServers, getHackingServers,} from './lib/Server'

/**
 * @param {NS} ns
 */
export async function main(ns) {
    const servers = getServers(ns)
    const hackingServers = getHackingServers(ns, servers)
    ns.tprint(hackingServers.map(s => s.hostname + '=' + Math.floor((s.maxRam - s.ramUsed) / 1.75)))

}
