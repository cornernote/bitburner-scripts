import {assignAttack, buildAttack, launchAttack} from "./lib/Attack";
import {getFreeThreads, getHackingServers, getServers} from "./lib/Server";

/**
 * @param {NS} ns
 */
export async function main(ns) {

    const target = ns.getServer('foodnstuff')
    const servers = getHackingServers(ns, getServers(ns))
    const attack = buildAttack(ns, ns.getPlayer(), target, 0.8, getFreeThreads(ns, servers, 1.75))
    const type = attack.info.prepThreads ? 'prep' : 'hack'
    const commands = assignAttack(ns, attack, servers, type, 1000)
    await launchAttack(ns, attack, commands)


}
