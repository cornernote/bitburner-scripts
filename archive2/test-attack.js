import {assignAttack, buildHackAttack, launchAttack} from "./lib/Attack";
import {getHackingServers, getServers} from "./lib/Server";
import {formatDelay, formatTime} from "./lib/Helper";

/**
 * @param {NS} ns
 */
export async function main(ns) {

    const cycles = 5
    const target = ns.getServer('n00dles')
    const servers = getHackingServers(ns, getServers(ns))
    const attack = buildHackAttack(ns, ns.getPlayer(), target, servers, 1, 0.8)
    const commands = assignAttack(ns, attack, servers, 'hack', cycles)
    //await launchAttack(ns, attack, commands, cycles)

    ns.tprint(`${formatTime()}: ${cycles} attack cycles ends at ${formatTime(attack.end)}, with delay time ${formatDelay(attack.time)}`)
    //await getStats(ns, attack.end + attack.time)
    ns.tprint('done...')
}


export async function getStats(ns, end) {
    const header = [
        'target',
        'type',
        'host',
        'threads',
        'data',
        'start',
        'delay',
        'time',
        'finish',
        'estStart',
        'estDelay',
        'estTime',
        'estFinish',
    ]
    await ns.write('/data/port-stats.csv.txt', header.join(','), 'w')

    while (end > new Date().getTime()) {
        while (ns.peek(1) !== 'NULL PORT DATA') {
            const payload = JSON.parse(ns.readPort(1))
            switch (payload.type) {
                case 'hack':
                case 'grow':
                case 'weaken':
                case 'check':
                    const row = [
                        payload.target,
                        payload.type,
                        payload.host,
                        payload.threads,
                        payload.data.amount ? payload.data.amount : JSON.stringify(payload.data),
                        payload.start,
                        payload.delay,
                        payload.time,
                        payload.finish,
                        payload.estStart,
                        payload.estDelay,
                        payload.estTime,
                        payload.estFinish,
                    ]
                    await ns.write('/data/port-stats.csv.txt', '\n' + row.join(','), 'a')
                    break;
            }
        }
        await ns.sleep(20)
    }

}
