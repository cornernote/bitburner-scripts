import {assignAttack, getBestAttack, getBestAttacks, launchAttack} from './lib/Attack'
import {
    getServers,
    getHackTargetServers,
    getHackingServers,
    getPrepTargetServers,
    getFreeThreads,
    getTotalThreads,
    getFreeRam,
    getTotalRam, SERVER
} from './lib/Server'
import {formatAttack, formatAttacks, formatDelay, updateHUD} from "./lib/Helpers";

let lastHudUpdate = 0


/**
 * Command options
 */
const argsSchema = [
    ['loop', false],
    ['help', false],
    ['show-targets', false],
]

/**
 * Command auto-complete
 */
export function autocomplete(data, _) {
    data.flags(argsSchema)
    return []
}


/**
 * Entry point
 *
 * @param {NS} ns
 */
export async function main(ns) {
    // get some stuff ready
    const args = ns.flags(argsSchema)
    ns.disableLog('ALL')
    // show help
    if (args.help) {
        ns.tprint(getHelp())
        ns.exit()
    }
    // show targets
    if (args['show-targets']) {
        ns.tprint(showTargets(ns))
        ns.exit()
    }
    // load existing attacks from disk - TODO
    let currentAttacks = []
    // work, sleep, repeat
    do {
        currentAttacks = await manageAttacks(ns, currentAttacks)
        await ns.sleep(20)
    } while (args.loop)
}

/**
 * Help text
 *
 * Player boss is stuck, let's get them some help.
 *
 * @returns {string}
 */
function getHelp() {
    return [
        '',
        '',
        'Reads port data for stats.',
        '',
        `USAGE: run ${this.ns.getScriptName()}`,
        '',
        'Example:',
        `> run ${this.ns.getScriptName()}`,
        '',
        '',
    ].join("\n")
}

/**
 * Manage the attacks.
 *
 * @param {NS} ns
 * @param {Array} currentAttacks
 * @return {Promise<[]>}
 */
export async function manageAttacks(ns, currentAttacks) {
    // split attacks into hack/prep
    // remove completed attacks from the list
    const now = new Date().getTime()
    currentAttacks = currentAttacks
        .filter(ca => ca.nextCycle || ca.attack.end > now)

    const currentHackAttacks = currentAttacks
        .filter(ca => ca.type === 'hack')
    const currentPrepAttacks = currentAttacks
        .filter(ca => ca.type === 'prep')

    // load some data
    const player = ns.getPlayer()
    const servers = getServers(ns)
    const cores = 1 // assume we won't run on home, or home has 1 core
    const hackingServers = getHackingServers(ns, servers) //.filter(s => s.hostname !== 'home') // exclude if it has a different number of cores
    const hackTargetServers = getHackTargetServers(ns, servers)
        .filter(s => currentHackAttacks.filter(ca => ca.attack.target === s.hostname).length === 0) // exclude current attacks
    const prepTargetServers = getPrepTargetServers(ns, servers)
        .filter(s => currentHackAttacks.filter(ca => ca.attack.target === s.hostname).length === 0) // exclude currentHackAttacks
        .filter(s => currentPrepAttacks.filter(ca => ca.attack.target === s.hostname).length === 0) // exclude currentPrepAttacks

    // update HUD
    if (lastHudUpdate + 1000 < now) {
        lastHudUpdate = now
        const ownedServers = hackingServers.filter(s => s.hostname.includes(SERVER.purchasedServerName))
        const rootedServers = hackingServers.filter(s => !s.hostname.includes(SERVER.purchasedServerName))
        updateHUD({
            'Servers:': `owned=${ownedServers.length}|pwnt=${rootedServers.length}]`,
            'RAM:': `${ns.nFormat(getFreeRam(ns, hackingServers) * 1000000000, '0.0b')}/${ns.nFormat(getTotalRam(ns, hackingServers) * 1000000000, '0.0b')}`,
            'Threads:': `${ns.nFormat(getFreeThreads(ns, hackingServers), '0.0a')}/${ns.nFormat(getTotalThreads(ns, hackingServers), '0.0a')}`,
            'Targets:': `hack=${hackTargetServers.length}|prep=${prepTargetServers.length}`,
            'Attacks:': `hack=${currentHackAttacks.length}|prep=${currentPrepAttacks.length}`,
        })
    }

    // continue existing attacks
    for (const currentHackTarget of Object.values(currentHackAttacks)) {
        if (currentHackTarget.nextCycle && currentHackTarget.nextCycle < new Date().getTime()) {
            const hackAttack = currentHackTarget.attack
            // check if we have enough threads to run it
            const freeThreads = getFreeThreads(ns, hackingServers)
            if (hackAttack.info.cycleThreads > getFreeThreads(ns, hackingServers)) {
                ns.print(`${hackAttack.info.cycleThreads} threads needed, ${freeThreads} were available... delaying`)
                currentHackTarget.nextCycle += 1000
                continue
            }
            // continue the attack
            if (assignAttack(ns, hackAttack, hackingServers, 'continue-' + currentHackTarget.nextCycle)) {
                await launchAttack(ns, hackAttack)
                currentHackTarget.nextCycle += 1000
                ns.print(formatAttack(ns, hackAttack, 'continue'))
            } else {
                ns.print(`cannot start attack, cancelling`)
                currentHackTarget.nextCycle = false
            }
        }
    }

    // launch new hack attacks
    const hackAttack = getBestAttack(ns, player, hackTargetServers, 'hackValue', getFreeThreads(ns, hackingServers), cores)
    if (hackAttack && assignAttack(ns, hackAttack, hackingServers, 'launch', hackAttack.cycles)) {
        await launchAttack(ns, hackAttack)
        currentAttacks.push({
            type: 'hack',
            attack: hackAttack,
            nextCycle: hackAttack.end + 1000,
        })
        ns.print(formatAttack(ns, hackAttack, 'hack'))
    }

    // launch new prep attacks
    const prepAttack = getBestAttack(ns, player, prepTargetServers, 'prepValue', getFreeThreads(ns, hackingServers), cores)
    if (prepAttack && assignAttack(ns, prepAttack, hackingServers, 'prep', 1, true)) {
        await launchAttack(ns, prepAttack)
        currentAttacks.push({
            type: 'prep',
            attack: prepAttack,
            nextCycle: false,
        })
        ns.print(formatAttack(ns, prepAttack, 'prep'))
    }

    // return attacks
    return currentAttacks
}


/**
 * Show the targets
 *
 * @returns {string}
 */
function showTargets(ns) {
    const player = ns.getPlayer()
    const servers = getServers(ns)
    const cores = 1 // assume we won't run on home, or home has 1 core
    const hackingServers = getHackingServers(ns, servers)
    const hackTargetServers = getHackTargetServers(ns, servers)
    const hackAttacks = getBestAttacks(ns, player, hackTargetServers, 'hackValue', getFreeThreads(ns, hackingServers), cores)
    const prepTargetServers = getPrepTargetServers(ns, servers)
    const prepAttacks = getBestAttacks(ns, player, prepTargetServers, 'prepValue', getFreeThreads(ns, hackingServers), cores)
    return [
        ``,
        `SERVERS`,
        `${servers.map(s => s.hostname).join(', ')}`,
        ``,
        `HACKS`,
        `${hackTargetServers.map(s => s.hostname).join(', ')}`,
        formatAttacks(ns, hackAttacks, 'hack'),
        ``,
        `PREPS`,
        `${prepTargetServers.map(s => s.hostname).join(', ')}`,
        formatAttacks(ns, prepAttacks, 'prep'),
    ].join('\n')
}
