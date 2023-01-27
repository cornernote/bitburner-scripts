/**
 * Command options
 */
import {Server} from "./lib/Server";

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
        if (!manageHacknet(ns)) {
            break
        }
        await ns.sleep(1000)
    } while (!args.once)
}


/**
 * Manage hacknet servers.
 *
 * @param {NS} ns
 * @returns {number|boolean} price of the purchased server, or false if we cannot purchase a server
 */
export function manageHacknet(ns) {

    const player = ns.getPlayer()

    const haveHacknetServers = ns.hacknet.hashCapacity() > 0
    // Get the lowest cache level, we do not consider upgrading the cache level of servers above this until all have the same cache level
    let nodeStats = []
    for (let i = 0; i < ns.hacknet.numNodes(); i++) {
        nodeStats.push(ns.hacknet.getNodeStats(i))
    }
    const minCacheLevel = Math.max.apply(Math, nodeStats.map(n => n.cache))
    const upgrades = [
        {
            name: "none",
            cost: null,
        },
        {
            name: "level",
            upgrade: ns.hacknet.upgradeLevel,
            cost: ns.hacknet.getLevelUpgradeCost,
            nextValue: nodeStats => nodeStats.level + 1,
            addedProduction: nodeStats => nodeStats.production * ((nodeStats.level + 1) / nodeStats.level - 1),
        },
        {
            name: "ram",
            upgrade: ns.hacknet.upgradeRam,
            cost: ns.hacknet.getRamUpgradeCost,
            nextValue: nodeStats => nodeStats.ram * 2,
            addedProduction: nodeStats => nodeStats.production * 0.07,
        },
        {
            name: "cores",
            upgrade: ns.hacknet.upgradeCore,
            cost: ns.hacknet.getCoreUpgradeCost,
            nextValue: nodeStats => nodeStats.cores + 1,
            addedProduction: nodeStats => nodeStats.production * ((nodeStats.cores + 5) / (nodeStats.cores + 4) - 1),
        },
        {
            name: "cache",
            upgrade: ns.hacknet.upgradeCache,
            cost: ns.hacknet.getCacheUpgradeCost,
            nextValue: nodeStats => nodeStats.cache + 1,
            // Note: Does not actually give production, but it has "worth" to us so we can buy more things,
            addedProduction: nodeStats => nodeStats.cache > minCacheLevel || !haveHacknetServers ? 0 : nodeStats.production * 0.01 / nodeStats.cache
        },
    ]

    // TODO: Change this all to use https://bitburner.readthedocs.io/en/latest/netscript/formulasapi/hacknetServers/hashGainRate.html

    // Find the best upgrade we can make to an existing node
    let formulas = true
    let nodeToUpgrade = -1
    let bestUpgrade
    let bestUpgradePayoff = 0 // Hashes per second per dollar spent. Bigger is better.
    let cost = 0
    let upgradedValue = 0
    let worstNodeProduction = Number.MAX_VALUE // Used to how productive a newly purchased node might be
    let numNodes = ns.hacknet.numNodes()
    for (let i = 0; i < numNodes; i++) {
        let nodeStats = ns.hacknet.getNodeStats(i)
        if (formulas && haveHacknetServers) { // When a hacknet server runs scripts, nodeStats.production lags behind what it should be for current ram usage. Get the "raw" rate
            try {
                nodeStats.production = ns.formulas.hacknetServers.hashGainRate(nodeStats.level, 0, nodeStats.ram, nodeStats.cores, player.hacknet_node_money_mult)
            } catch {
                formulas = false
            }
        }
        worstNodeProduction = Math.min(worstNodeProduction, nodeStats.production)

        for (const upgrade of upgrades) {
            let currentUpgradeCost = upgrade.cost ? upgrade.cost(i, 1) : 0
            let payoff = upgrade.addedProduction ? upgrade.addedProduction(nodeStats) / currentUpgradeCost : 0 // Production (Hashes per second) per dollar spent
            if (payoff > bestUpgradePayoff) {
                nodeToUpgrade = i
                bestUpgrade = upgrade
                bestUpgradePayoff = payoff
                cost = currentUpgradeCost
                upgradedValue = upgrade.nextValue(nodeStats)
            }
        }
    }

    // Compare this to the cost of adding a new node. This is an imperfect science. We are paying to unlock the ability to buy all the same upgrades our
    // other nodes have - all of which have been deemed worthwhile. Not knowing the sum total that will have to be spent to reach that same production,
    // the "most optimistic" case is to treat "price" of all that production to be just the cost of this server, but this is **very** optimistic.
    // In practice, the cost of new hacknodes scales steeply enough that this should come close to being true (cost of server >> sum of cost of upgrades)
    let newNodeCost = ns.hacknet.getPurchaseNodeCost()
    let newNodePayoff = ns.hacknet.numNodes() === ns.hacknet.maxNumNodes() ? 0 : worstNodeProduction / newNodeCost
    let shouldBuyNewNode = newNodePayoff > bestUpgradePayoff
    if (newNodePayoff === 0 && bestUpgradePayoff === 0) {
        ns.print(`All upgrades have no value (is hashNet income disabled in this BN?)`)
        return false // As long as maxSpend doesn't change, we will never purchase another upgrade
    }
    // If specified, only buy upgrades that will pay for themselves in {payoffTimeSeconds}.
    const hashDollarValue = haveHacknetServers ? 2.5e5 : 1 // Dollar value of one hash-per-second (0.25m dollars per production).
    let payoffTimeSeconds = 1 / (hashDollarValue * (shouldBuyNewNode ? newNodePayoff : bestUpgradePayoff))
    if (shouldBuyNewNode) cost = newNodeCost

    // Prepare info about the next upgrade. Whether we end up purchasing or not, we will display this info.
    let strPurchase = (shouldBuyNewNode
            ? `a new node "hacknet-node-${ns.hacknet.numNodes()}"`
            : `hacknet-node-${nodeToUpgrade} ${bestUpgrade.name} ${upgradedValue}`)
        + ` for ${ns.nFormat(cost, '$0.00a')}`
    let strPayoff = `production ${((shouldBuyNewNode ? newNodePayoff : bestUpgradePayoff) * cost).toPrecision(3)} payoff time ${ns.nFormat(payoffTimeSeconds, '00:00:00')}`
    if (Server.hacknetMaxSpend && cost > Server.hacknetMaxSpend) {
        ns.print(`The next best purchase would be ${strPurchase} but the cost ${ns.nFormat(cost, '$0.00a')} exceeds the limit (${ns.nFormat(Server.hacknetMaxSpend, '$0.00a')})`)
        return false // As long as maxSpend doesn't change, we will never purchase another upgrade
    }

    // limit payoff time
    let nextPayoffTime = Server.hacknetMaxPayoffTime
    if (nextPayoffTime && payoffTimeSeconds > nextPayoffTime) {
        ns.print(`The next best purchase would be ${strPurchase} but the ${strPayoff} is worse than the limit (${ns.nFormat(nextPayoffTime, '00:00:00')})`)
        return false // As long as maxPayoffTime doesn't change, we will never purchase another upgrade
    }
    let success = shouldBuyNewNode
        ? ns.hacknet.purchaseNode() !== -1
        : bestUpgrade.upgrade(nodeToUpgrade, 1)
    if (!success) {
        ns.print(`Insufficient funds to purchase the next best upgrade: ${strPurchase}`)
        return 0
    }
    ns.print(`Purchased ${strPurchase} with ${strPayoff}`)
    return cost

}
