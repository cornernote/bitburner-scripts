import {
    SERVER,
    getFreeRam,
    getFreeThreads,
    getHackingServers,
    getHackTargetServers,
    getPrepTargetServers,
    getServers,
    getTotalRam,
    getTotalThreads
} from "./lib/Server";
import {formatDelay, updateHUD} from "./lib/Helpers";

/**
 * Command options
 */
const argsSchema = [
    ['help', false],
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

    // load data from disk
    // const dataContents = ns.read('/data/hud-data.json.txt')
    // let data = dataContents
    //     ? JSON.parse(dataContents)
    //     : {}
    let data = {
        stats: {},
        currentAttacks: [],
    }

    // work, sleep, repeat
    do {

        // read data
        data = await manageHud(ns, 1, data)
        writeHud(ns, data)

        await ns.sleep(1000)
    } while (!args.once)
}

/**
 * Help text
 *
 * Player boss is stuck, let's get them some help.
 *
 * @returns {string}
 */
function getHelp(ns) {
    const script = ns.getScriptName()
    return [
        'Displays data on the HUD (head up display).',
        '',
        `USAGE: run ${script}`,
        '',
        'Example:',
        `> run ${script}`,
    ].join("\n")
}

/**
 * Reads port data for hud.
 *
 * @param {NS} ns
 * @param {number} port
 * @param {Object} data
 * @returns {Promise<{Object}>}
 */
async function manageHud(ns, port, data) {
    let changed = false
    while (ns.peek(port) !== 'NULL PORT DATA') {
        const payload = JSON.parse(ns.readPort(port))
        changed = true
        switch (payload.type) {

            case 'hack':
                if (!data.stats[payload.target]) {
                    data.stats[payload.target] = {
                        target: payload.target,
                        total: 0,
                        attempts: 0,
                        average: 0,
                        success: 0,
                        failures: 0,
                    }
                }
                if (payload.data.amount > 0) {
                    data.stats[payload.target].total += payload.data.amount
                    data.stats[payload.target].success++
                    data.stats[payload.target].failures = 0
                } else {
                    data.stats[payload.target].failures++
                }
                data.stats[payload.target].attempts++
                data.stats[payload.target].average = data.stats[payload.target].total / data.stats[payload.target].attempts
                break

            case 'add-hack':
            case 'add-prep':
                data.currentAttacks.push(payload.attack)
                data.stats[payload.attack.target] = {
                    target: payload.target,
                    total: 0,
                    attempts: 0,
                    average: 0,
                    success: 0,
                    failures: 0,
                }
                break

        }
    }
    if (changed) {
        //await ns.write('/data/hud-data.json.txt', JSON.stringify(data), 'w')
    }
    return data
}


/**
 *
 * @param {NS} ns
 * @param {Object} data
 */
function writeHud(ns, data) {
    const now = new Date().getTime()
    data.currentAttacks = data.currentAttacks
        .filter(a => a.end > now)
    const currentHackAttacks = data.currentAttacks
        .filter(c => c.type === 'hack')
    const currentPrepAttacks = data.currentAttacks
        .filter(c => c.type === 'prep')

    // const servers = getServers(ns)
    // const hackingServers = getHackingServers(ns, servers) //.filter(s => s.hostname !== 'home') // exclude if it has a different number of cores
    // const hackTargetServers = getHackTargetServers(ns, servers)
    //     .filter(s => data.currentAttacks.filter(a => a.target === s.hostname).length === 0) // exclude currentAttacks
    // const prepTargetServers = getPrepTargetServers(ns, servers)
    //     .filter(s => data.currentAttacks.filter(a => a.target === s.hostname).length === 0) // exclude currentAttacks

    // const ownedServers = hackingServers.filter(s => s.hostname.includes(SERVER.purchasedServerName))
    // const rootedServers = hackingServers.filter(s => !s.hostname.includes(SERVER.purchasedServerName))

    const hud = {
        'Time SLA:': `${ns.nFormat(ns.getTimeSinceLastAug() / 1000, '00:00:00')}`,
        'Script Inc:': `${ns.nFormat(ns.getScriptIncome()[0], '$0.0a')}/sec`,
        'Script Exp:': `${ns.nFormat(ns.getScriptExpGain(), '0.0a')}/sec`,
        'Share Pwr:': `${ns.nFormat(ns.getSharePower(), '0.0a')}`,
        // 'Servers:': `owned=${ownedServers.length}|pwnt=${rootedServers.length}`,
        // 'RAM:': `${ns.nFormat(getFreeRam(ns, hackingServers) * 1000000000, '0.0b')}/${ns.nFormat(getTotalRam(ns, hackingServers) * 1000000000, '0.0b')}`,
        // 'Threads:': `${ns.nFormat(getFreeThreads(ns, hackingServers, 1.75), '0.0a')}/${ns.nFormat(getTotalThreads(ns, hackingServers, 1.75), '0.0a')}`,
        // 'Targets:': `hack=${hackTargetServers.length}|prep=${prepTargetServers.length}`,
        'Attacks:': `hack=${currentHackAttacks.length}|prep=${currentPrepAttacks.length}`,
    }
    for (const currentHackAttack of currentHackAttacks.sort((a, b) => b.info.cycleValue - a.info.cycleValue)) {
        const timer = currentHackAttack.start + currentHackAttack.time > now
            ? '✈' + formatDelay(currentHackAttack.start + currentHackAttack.time - now)
            : '💣' + formatDelay(currentHackAttack.end - now)
        hud[`${currentHackAttack.target} \n${timer}`] = 'on=' + ns.nFormat(currentHackAttack.activePercent, '0.0%') + ' take=' + ns.nFormat(currentHackAttack.info.hackedPercent, '0.0%') + '\n'
            + '~' + ns.nFormat(currentHackAttack.info.cycleValue, '$0.0a')
            + '=' + ns.nFormat(data.stats[currentHackAttack.target].average, '$0.0a')
            + ' ' + currentHackAttack.cycles
    }
    updateHUD(hud, true)
}