import {assignAttack, buildAttack, launchAttack} from "./lib/Attack";
import {getHackingServers, getServers} from "./lib/Server";
import {formatDelay, formatTime} from "./lib/Helpers";

/**
 * @param {NS} ns
 */
export async function main(ns) {

    const cycles = 5
    const target = ns.getServer('foodnstuff')
    const servers = getHackingServers(ns, getServers(ns))
    const attack = buildAttack(ns, ns.getPlayer(), target, 0.8, servers)
    const type = attack.info.prepThreads ? 'prep' : 'hack'
    attack.parts.h.threads = 0
    attack.parts.g.threads = 0
    attack.parts.gw.threads = 0
    const commands = assignAttack(ns, attack, servers, type, cycles)
    await launchAttack(ns, attack, commands, cycles)

    ns.tprint(`${formatTime()}: ${cycles} attack cycles ends at ${formatTime(attack.end)}, with delay time ${formatDelay(attack.time)}`)
    await ns.sleep(attack.end + attack.time - new Date().getTime())
    ns.tprint('done...')
}
