import {ServerSettings, getFreeRam, getOwnedServers, getServers, getTotalRam} from './lib/Server';
import {formatMoney, formatRam} from './lib/Helper';
import {Runner} from "./lib/Runner";

/**
 * Command options
 */
const argsSchema = [
    ['once', false],
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
    const runner = new Runner(ns)
    ns.disableLog('ALL')
    // work, sleep, repeat
    do {
        if (!await manageHosts(runner)) {
            break
        }
        await ns.sleep(10 * 1000)
    } while (!args.once)
}


/**
 * Manage purchased servers.
 *
 * @param {Runner} runner
 * @returns {Promise<boolean>} false if we cannot purchase any more servers
 */
export async function manageHosts(runner) {
    const servers = getServers(runner)
    const purchasedServers = getOwnedServers(runner.ns, servers)
    const totalMaxRam = purchasedServers.length
        ? getTotalRam(runner.ns, purchasedServers)
        : 0
    const utilizationTotal = purchasedServers.length
        ? totalMaxRam - getFreeRam(runner.ns, purchasedServers)
        : 0
    const utilizationRate = purchasedServers.length
        ? utilizationTotal / totalMaxRam
        : 1

    // Check for other reasons not to go ahead with the purchase
    let prefix = 'tried to buy server, but '
    const player = runner.nsProxy['getPlayer']()
    const budget = player.money

    // Stop if utilization is below target. We probably don't need another server.
    if (utilizationRate < ServerSettings.utilizationTarget) {
        runner.ns.print(prefix + 'current utilization is below target ' + runner.ns.nFormat(ServerSettings.utilizationTarget, '0%') + '.')
        return true
    }
    // Determine the most ram we can buy with this money
    let exponentLevel
    for (exponentLevel = 1; exponentLevel < ServerSettings.maxRamExponent; exponentLevel++) {
        if (runner.nsProxy['getPurchasedServerCost'](Math.pow(2, exponentLevel + 1)) > budget) {
            break
        }
    }
    const maxRamPossibleToBuy = Math.pow(2, exponentLevel)

    // Abort if we don't have enough money
    const cost = runner.nsProxy['getPurchasedServerCost'](maxRamPossibleToBuy)
    if (budget < cost) {
        runner.ns.print(prefix + 'budget ' + formatMoney(runner.ns, budget) + ' is less than ' + formatMoney(runner.ns, cost) + ' for ' + formatRam(runner.ns, maxRamPossibleToBuy))
        return true
    }

    // if (exponentLevel < SERVER.minRamExponent) {
    //     ns.print(`${prefix}The highest ram exponent we can afford (2^${exponentLevel} for ${formatMoney(ns, cost)}) on our budget of ${formatMoney(ns, budget)} `
    //         + `is less than the minimum ram exponent (2^${SERVER.minRamExponent} for ${formatMoney(ns, ns.getPurchasedServerCost(Math.pow(2, SERVER.minRamExponent)))})'`)
    //     return
    // }

    if (exponentLevel < ServerSettings.maxRamExponent) {
        // Abort if purchasing this server wouldn't improve our total RAM by more than 10% (ensures we buy in meaningful increments)
        if (maxRamPossibleToBuy / totalMaxRam < 0.1) {
            runner.ns.print(prefix + 'the most RAM we can buy (' + formatRam(runner.ns, maxRamPossibleToBuy) + ') is less than 10% of total available RAM ' + formatRam(runner.ns, totalMaxRam) + ')')
            return true
        }
    }

    // check compared to current purchased servers
    let maxPurchasableServerRam = Math.pow(2, ServerSettings.maxRamExponent)
    let worstServerName = null
    let worstServerRam = maxPurchasableServerRam
    let bestServerName = null
    let bestServerRam = 0
    for (const server of purchasedServers.filter(s => s.hostname !== 'home')) {
        if (server.maxRam < worstServerRam) {
            worstServerName = server.hostname
            worstServerRam = server.maxRam
        }
        if (server.maxRam >= bestServerRam) {
            bestServerName = server.hostname
            bestServerRam = server.maxRam
        }
    }

    // Abort if our worst previously-purchased server is better than the one we're looking to buy (ensures we buy in sane increments of capacity)
    if (worstServerName != null && maxRamPossibleToBuy < worstServerRam) {
        runner.ns.print(prefix + 'the most RAM we can buy (' + formatRam(runner.ns, maxRamPossibleToBuy) +
            ') is less than our worst purchased server ' + worstServerName + '\'s RAM ' + formatRam(runner.ns, worstServerRam))
        return true
    }
    // Only buy new servers as good as or better than our best bought server (anything less is considered a regression in value)
    if (bestServerRam != null && maxRamPossibleToBuy < bestServerRam) {
        runner.ns.print(prefix + 'the most RAM we can buy (' + formatRam(runner.ns, maxRamPossibleToBuy) +
            ') is less than our previously purchased server ' + bestServerName + " RAM " + formatRam(runner.ns, bestServerRam))
        return true
    }

    // if we're at capacity, check to see if we can do better than the current worst purchased server. If so, delete it to make room.
    if (purchasedServers.length >= ServerSettings.maxPurchasedServers) {
        if (worstServerRam === maxPurchasableServerRam) {
            runner.ns.print('All purchasable servers are maxed.')
            return false
        }

        // It's only worth deleting our old server if the new server will be 16x bigger or more (or if it's the biggest we can buy)
        if (exponentLevel === ServerSettings.maxRamExponent || worstServerRam * 16 <= maxRamPossibleToBuy) {
            runner.nsProxy['killall'](worstServerName)
            if (runner.nsProxy['deleteServer'](worstServerName)) {
                runner.ns.print(`deleted server ${worstServerName} (${formatRam(runner.ns, worstServerRam)} RAM) ` +
                    `to make room for a new ${formatRam(ns, maxRamPossibleToBuy)} Server.`)
            } else {
                runner.ns.print(`WARNING: failed to delete server ${worstServerName} (${formatRam(runner.ns, worstServerRam)} RAM), perhaps it is running scripts?`)
            }
            return true
        } else {
            runner.ns.print(`${prefix}the most RAM we can buy (${formatRam(runner.ns, maxRamPossibleToBuy)}) is less than 16x the RAM ` +
                `of the server it must delete to make room: ${worstServerName} (${formatRam(runner.ns, worstServerRam)} RAM)`)
            return true
        }
    }

    let purchasedServer = runner.nsProxy['purchaseServer'](ServerSettings.purchasedServerName, maxRamPossibleToBuy)
    if (purchasedServer) {
        await runner.nsProxy['scp'](ServerSettings.hackScripts, purchasedServer)
    }
    if (!purchasedServer) {
        runner.ns.print(prefix + `Could not purchase a server with ${formatRam(runner.ns, maxRamPossibleToBuy)} RAM for ${formatMoney(runner.ns, cost)} ` +
            `with a budget of ${formatMoney(runner.ns, budget)}. This is either a bug, or we in a SF.9`)
    } else {
        runner.ns.print('Purchased a new server ' + purchasedServer + ' with ' + formatRam(runner.ns, maxRamPossibleToBuy) + ' RAM for ' + formatMoney(runner.ns, cost))
    }
    return true

}
