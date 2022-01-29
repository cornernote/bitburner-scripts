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
        const stats = await readStats(ns)
        currentAttacks = await manageAttacks(ns, currentAttacks, stats)
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
export async function manageAttacks(ns, currentAttacks, stats) {
    // split attacks into hack/prep
    // remove completed attacks from the list
    const now = new Date().getTime()
    currentAttacks = currentAttacks
        .filter(ca => ca.attack.end > now) // || ca.nextCycle)

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
        .filter(s => currentHackAttacks.filter(ca => ca.attack.target === s.hostname).length === 0) // exclude currentHackAttacks
    const prepTargetServers = getPrepTargetServers(ns, servers)
        .filter(s => currentHackAttacks.filter(ca => ca.attack.target === s.hostname).length === 0) // exclude currentHackAttacks
        .filter(s => currentPrepAttacks.filter(ca => ca.attack.target === s.hostname).length === 0) // exclude currentPrepAttacks

    // update HUD
    if (lastHudUpdate + 1000 < now) {
        lastHudUpdate = now
        const ownedServers = hackingServers.filter(s => s.hostname.includes(SERVER.purchasedServerName))
        const rootedServers = hackingServers.filter(s => !s.hostname.includes(SERVER.purchasedServerName))

        const hud = {
            'Script Inc:': `${ns.nFormat(ns.getScriptIncome()[0], '$0.0a')}/sec`,
            'Script Exp:': `${ns.nFormat(ns.getScriptExpGain(), '0.0a')}/sec`,
            'Servers:': `owned=${ownedServers.length}|pwnt=${rootedServers.length}`,
            'RAM:': `${ns.nFormat(getFreeRam(ns, hackingServers) * 1000000000, '0.0b')}/${ns.nFormat(getTotalRam(ns, hackingServers) * 1000000000, '0.0b')}`,
            'Threads:': `${ns.nFormat(getFreeThreads(ns, hackingServers), '0.0a')}/${ns.nFormat(getTotalThreads(ns, hackingServers), '0.0a')}`,
            'Targets:': `hack=${hackTargetServers.length}|prep=${prepTargetServers.length}`,
            'Attacks:': `hack=${currentHackAttacks.length}|prep=${currentPrepAttacks.length}`,
        }
        for (const currentHackAttack of currentHackAttacks.sort((a, b) => b.attack.end - a.attack.end)) {
            hud[`A ${currentHackAttack.attack.target}`] = ns.nFormat(currentHackAttack.attack.hackValue, '$0.0a')
                + ' ' + currentHackAttack.attack.cycles
                + ' ' + formatDelay(currentHackAttack.attack.end - now)
        }
        for (const currentPrepAttack of currentPrepAttacks.sort((a, b) => b.attack.end - a.attack.end)) {
            hud[`P ${currentPrepAttack.attack.target}`] = ns.nFormat(currentPrepAttack.attack.prepValue, '$0.0a')
                + ' ' + currentPrepAttack.attack.cycles
                + ' ' + formatDelay(currentPrepAttack.attack.end - now)
        }
        updateHUD(hud, true)
    }

    // // continue existing attacks
    // for (const currentHackTarget of Object.values(currentHackAttacks)) {
    //     if (currentHackTarget.nextCycle && currentHackTarget.nextCycle < new Date().getTime()) {
    //         const hackAttack = currentHackTarget.attack
    //         // check if we have enough threads to run it
    //         const freeThreads = getFreeThreads(ns, hackingServers)
    //         if (hackAttack.info.cycleThreads > getFreeThreads(ns, hackingServers)) {
    //             ns.print(`${hackAttack.info.cycleThreads} threads needed, ${freeThreads} were available... delaying`)
    //             currentHackTarget.nextCycle += 1000
    //             continue
    //         }
    //         // continue the attack
    //         if (assignAttack(ns, hackAttack, hackingServers, 'continue-' + currentHackTarget.nextCycle)) {
    //             await launchAttack(ns, hackAttack)
    //             currentHackTarget.nextCycle += 1000
    //             ns.print(formatAttack(ns, hackAttack, 'continue'))
    //         } else {
    //             ns.print(`cannot start attack, cancelling`)
    //             currentHackTarget.nextCycle = false
    //         }
    //     }
    // }

    // launch new hack attacks
    if (currentHackAttacks.length < 10) {
        const hackAttack = getBestAttack(ns, player, hackTargetServers, 'hackValue', getFreeThreads(ns, hackingServers), cores)
        if (hackAttack && assignAttack(ns, hackAttack, hackingServers, 'launch', hackAttack.cycles)) {
            await launchAttack(ns, hackAttack)
            currentAttacks.push({
                type: 'hack',
                attack: hackAttack,
                //nextCycle: hackAttack.end + 1000,
            })
            ns.print(formatAttack(ns, hackAttack, 'hack'))
        }
    }

    // launch new prep attacks
    const totalThreads = getTotalThreads(ns, hackingServers)
    const freeThreads = getFreeThreads(ns, hackingServers)
    const prepAttack = getBestAttack(ns, player, prepTargetServers, 'prepValue', freeThreads, cores)
    // if no prep attacks, or the current prep can be half done in the available threads, or there are more than half the threads available
    if (currentPrepAttacks.length === 0 || prepAttack.prepThreads / 2 < freeThreads || freeThreads > totalThreads / 2) {
        if (prepAttack && assignAttack(ns, prepAttack, hackingServers, 'prep', 1, true)) {
            await launchAttack(ns, prepAttack)
            currentAttacks.push({
                type: 'prep',
                attack: prepAttack,
                //nextCycle: false,
            })
            ns.print(formatAttack(ns, prepAttack, 'prep'))
        }
    }

    // return attacks
    return currentAttacks
}


/**
 * Show the targets
 *
 * @param {NS} ns
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

/**
 * Reads port data for stats.
 *
 * @param {NS} ns
 * @returns {Promise<{Object}>}
 */
async function readStats(ns) {
    // const statsContents = ns.read('/data/stats.json.txt')
    // const stats = statsContents
    //     ? JSON.parse(statsContents)
    //     : {}
    // let changed = false
    const stats = {}
    while (ns.peek(1) !== 'NULL PORT DATA') {
        const data = JSON.parse(ns.readPort(1))
        // changed = true
        switch (data.action) {

            case 'hack':
                if (!stats[data.target]) {
                    stats[data.target] = {
                        target: data.target,
                        total: 0,
                        attempts: 0,
                        average: 0,
                        success: 0,
                        consecutiveFailures: 0,
                    }
                }
                if (data.amount > 0) {
                    stats[data.target].total += data.amount
                    stats[data.target].success++
                    stats[data.target].consecutiveFailures = 0
                } else {
                    stats[data.target].consecutiveFailures++
                }
                stats[data.target].attempts++
                stats[data.target].average = stats[data.target].total / stats[data.target].attempts
                break;

            case 'start':
            case 'restart':
                stats[data.target] = {
                    target: data.target,
                    total: 0,
                    attempts: 0,
                    average: 0,
                    success: 0,
                    consecutiveFailures: 0,
                }
                break;
        }
    }

    // if (changed) {
    //     await ns.write('/data/stats.json', JSON.stringify(stats), 'w')
    // }
    return stats
}
