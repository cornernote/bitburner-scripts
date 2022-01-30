import {getFreeRam, getOwnedServers, getServers, getTotalRam, SERVER} from "./lib/Server";
import {formatMoney, formatRam} from "./lib/Helpers";

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
    ns.disableLog('ALL')
    // work, sleep, repeat
    do {
        if (!await manageHosts(ns)) {
            break
        }
        await ns.sleep(10 * 1000)
    } while (!args.once)
}


/**
 * Manage purchased servers.
 *
 * @param {NS} ns
 * @returns {Promise<boolean>} false if we cannot purchase any more servers
 */
export async function manageHosts(ns) {
    const servers = getServers(ns)
    const purchasedServers = getOwnedServers(ns, servers)
    const totalMaxRam = purchasedServers.length
        ? getTotalRam(ns, purchasedServers)
        : 0
    const utilizationTotal = purchasedServers.length
        ? totalMaxRam - getFreeRam(ns, purchasedServers)
        : 0
    const utilizationRate = purchasedServers.length
        ? utilizationTotal / totalMaxRam
        : 1

    // Check for other reasons not to go ahead with the purchase
    let prefix = 'tried to buy server, but '
    const player = ns.getPlayer()
    const budget = player.money

    // Stop if utilization is below target. We probably don't need another server.
    if (utilizationRate < SERVER.utilizationTarget) {
        ns.print(prefix + 'current utilization is below target ' + ns.nFormat(SERVER.utilizationTarget, '0%') + '.')
        return true
    }
    // Determine the most ram we can buy with this money
    let exponentLevel
    for (exponentLevel = 1; exponentLevel < SERVER.maxRamExponent; exponentLevel++) {
        if (ns.getPurchasedServerCost(Math.pow(2, exponentLevel + 1)) > budget) {
            break
        }
    }
    const maxRamPossibleToBuy = Math.pow(2, exponentLevel)

    // Abort if we don't have enough money
    const cost = ns.getPurchasedServerCost(maxRamPossibleToBuy)
    if (budget < cost) {
        ns.print(prefix + 'budget ' + formatMoney(ns, budget) + ' is less than ' + formatMoney(ns, cost) + ' for ' + formatRam(ns, maxRamPossibleToBuy))
        return true
    }

    // if (exponentLevel < SERVER.minRamExponent) {
    //     ns.print(`${prefix}The highest ram exponent we can afford (2^${exponentLevel} for ${formatMoney(ns, cost)}) on our budget of ${formatMoney(ns, budget)} `
    //         + `is less than the minimum ram exponent (2^${SERVER.minRamExponent} for ${formatMoney(ns, ns.getPurchasedServerCost(Math.pow(2, SERVER.minRamExponent)))})'`)
    //     return
    // }

    if (exponentLevel < SERVER.maxRamExponent) {
        // Abort if purchasing this server wouldn't improve our total RAM by more than 10% (ensures we buy in meaningful increments)
        if (maxRamPossibleToBuy / totalMaxRam < 0.1) {
            ns.print(prefix + 'the most RAM we can buy (' + formatRam(ns, maxRamPossibleToBuy) + ') is less than 10% of total available RAM ' + formatRam(ns, totalMaxRam) + ')')
            return true
        }
    }

    // check compared to current purchased servers
    let maxPurchasableServerRam = Math.pow(2, SERVER.maxRamExponent)
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
        ns.print(prefix + 'the most RAM we can buy (' + formatRam(ns, maxRamPossibleToBuy) +
            ') is less than our worst purchased server ' + worstServerName + '\'s RAM ' + formatRam(ns, worstServerRam))
        return true
    }
    // Only buy new servers as good as or better than our best bought server (anything less is considered a regression in value)
    if (bestServerRam != null && maxRamPossibleToBuy < bestServerRam) {
        ns.print(prefix + 'the most RAM we can buy (' + formatRam(ns, maxRamPossibleToBuy) +
            ') is less than our previously purchased server ' + bestServerName + " RAM " + formatRam(ns, bestServerRam))
        return true
    }

    // if we're at capacity, check to see if we can do better than the current worst purchased server. If so, delete it to make room.
    if (purchasedServers.length >= SERVER.maxPurchasedServers) {
        if (worstServerRam === maxPurchasableServerRam) {
            ns.print('All purchasable servers are maxed.')
            return false
        }

        // It's only worth deleting our old server if the new server will be 16x bigger or more (or if it's the biggest we can buy)
        if (exponentLevel === SERVER.maxRamExponent || worstServerRam * 16 <= maxRamPossibleToBuy) {
            ns.killall(worstServerName)
            if (ns.deleteServer(worstServerName)) {
                ns.print(`deleted server ${worstServerName} (${formatRam(ns, worstServerRam)} RAM) ` +
                    `to make room for a new ${formatRam(ns, maxRamPossibleToBuy)} Server.`)
            } else {
                ns.print(`WARNING: failed to delete server ${worstServerName} (${formatRam(ns, worstServerRam)} RAM), perhaps it is running scripts?`)
            }
            return true
        } else {
            ns.print(`${prefix}the most RAM we can buy (${formatRam(ns, maxRamPossibleToBuy)}) is less than 16x the RAM ` +
                `of the server it must delete to make room: ${worstServerName} (${formatRam(ns, worstServerRam)} RAM)`)
            return true
        }
    }

    let purchasedServer = ns.purchaseServer(SERVER.purchasedServerName, maxRamPossibleToBuy)
    if (purchasedServer) {
        await ns.scp(['/hacks/hack.js', '/hacks/grow.js', '/hacks/weaken.js'], 'home', purchasedServer)
    }
    if (!purchasedServer) {
        ns.print(prefix + `Could not purchase a server with ${formatRam(ns, maxRamPossibleToBuy)} RAM for ${formatMoney(ns, cost)} ` +
            `with a budget of ${formatMoney(ns, budget)}. This is either a bug, or we in a SF.9`)
    } else {
        ns.print('Purchased a new server ' + purchasedServer + ' with ' + formatRam(ns, maxRamPossibleToBuy) + ' RAM for ' + formatMoney(ns, cost))
    }
    return true

}
