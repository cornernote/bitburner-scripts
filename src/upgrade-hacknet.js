import {Runner} from "./lib/Runner.js"
import {settings} from "./_settings.js"

/**
 * Command options
 */
const argsSchema = [
    ['loop', false],
    ['max-payoff-time', '1h'], // Controls how far to upgrade hacknets. Can be a number of seconds, or an expression of minutes/hours (e.g. '123m', '4h')
    ['time', null], // alias for max-payoff-time
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
 * Entry method
 *
 * @param {NS} ns
 */
export async function main(ns) {
    const args = ns.flags(argsSchema)
    const runner = new Runner(ns)
    const upgradeHacknet = new UpgradeHacknet(ns, runner, {
        maxPayoffTime: args['time'] || args['max-payoff-time'],
    })
    // print help
    if (args.help) {
        ns.tprint(upgradeHacknet.getHelp())
        ns.exit()
    }
    // get ready
    do {
        // work, sleep, repeat
        await upgradeHacknet.doJob()
        await ns.sleep(10)
    } while (args.loop)
}

/**
 * UpgradeHacknet
 *
 * Manages and upgrades the hacknet servers.
 */
export class UpgradeHacknet {

    /**
     * The BitBurner instance
     * @type {NS}
     */
    ns

    /**
     * The Runner instance
     * @type {Runner}
     */
    runner

    /**
     * The time we last ran
     * @type {Number}
     */
    lastRun

    /**
     * Player data
     * @type {Player}
     */
    player

    /**
     * Server data
     * @type {Server[]}
     */
    servers

    /**
     * List of upgrades
     * @type {Array}
     */
    upgrades

    /**
     * If we own servers
     * @type {Boolean}
     */
    haveHacknetServers

    /**
     * Construct the class
     *
     * @param {NS} ns - the NS instance passed into the scripts main() entry method
     * @param {Runner} runner - the runner object
     * @param {Object} config - key/value pairs used to set object properties
     */
    constructor(ns, runner, config = {}) {
        this.ns = ns
        this.runner = runner
        // allow override of properties in this class
        Object.entries(config).forEach(([key, value]) => this[key] = value)
    }

    /**
     * The main job function.
     *
     * @returns {Promise<void>}
     */
    async doJob() {
        // check if we need to run
        if (this.lastRun + settings.intervals['upgrade-hacknet'] > new Date().getTime()) {
            return
        }
        // run
        //this.ns.tprint('UpgradeHacknet...')
        await this.upgradeHacknet()
        // set the last run time
        this.lastRun = new Date().getTime()
        // display the report
        //this.ns.tprint(this.getRootServersReport())

    }

    /**
     * Upgrade hacknet servers
     *
     * @returns {Promise<void>}
     */
    async upgradeHacknet() {

        await this.loadPlayer()
        await this.loadUpgrades()

        const currentHacknetMult = this.player.hacknet_node_money_mult
        // Get the lowest cache level, we do not consider upgrading the cache level of servers above this until all have the same cache level

        // TODO: Change this all to use https://bitburner.readthedocs.io/en/latest/netscript/formulasapi/hacknetServers/hashGainRate.html

        // Find the best upgrade we can make to an existing node
        let formulas = true
        let nodeToUpgrade = -1
        let bestUpgrade
        let bestUpgradePayoff = 0 // Hashes per second per dollar spent. Bigger is better.
        let cost = 0
        let upgradedValue = 0
        let worstNodeProduction = Number.MAX_VALUE // Used to how productive a newly purchased node might be
        for (let i = 0; i < this.ns.hacknet.numNodes(); i++) {
            let nodeStats = this.ns.hacknet.getNodeStats(i)
            if (formulas && this.haveHacknetServers) { // When a hacknet server runs scripts, nodeStats.production lags behind what it should be for current ram usage. Get the "raw" rate
                try {
                    nodeStats.production = this.ns.formulas.hacknetServers.hashGainRate(nodeStats.level, 0, nodeStats.ram, nodeStats.cores, currentHacknetMult)
                } catch {
                    formulas = false
                }
            }
            worstNodeProduction = Math.min(worstNodeProduction, nodeStats.production)
            for (let up = 1; up < this.upgrades.length; up++) {
                let currentUpgradeCost = this.upgrades[up].cost(i)
                let payoff = this.upgrades[up].addedProduction(nodeStats) / currentUpgradeCost // Production (Hashes per second) per dollar spent
                if (payoff > bestUpgradePayoff) {
                    nodeToUpgrade = i
                    bestUpgrade = this.upgrades[up]
                    bestUpgradePayoff = payoff
                    cost = currentUpgradeCost
                    upgradedValue = this.upgrades[up].nextValue(nodeStats)
                }
            }
        }
        // Compare this to the cost of adding a new node. This is an imperfect science. We are paying to unlock the ability to buy all the same upgrades our
        // other nodes have - all of which have been deemed worthwhile. Not knowing the sum total that will have to be spent to reach that same production,
        // the "most optimistic" case is to treat "price" of all that production to be just the cost of this server, but this is **very** optimistic.
        // In practice, the cost of new hacknodes scales steeply enough that this should come close to being true (cost of server >> sum of cost of upgrades)
        let newNodeCost = this.ns.hacknet.getPurchaseNodeCost()
        let newNodePayoff = this.ns.hacknet.numNodes() === this.ns.hacknet.maxNumNodes() ? 0 : worstNodeProduction / newNodeCost
        let shouldBuyNewNode = newNodePayoff > bestUpgradePayoff
        if (newNodePayoff === 0 && bestUpgradePayoff === 0) {
            this.ns.tprint(`All upgrades have no value (is hashNet income disabled in this BN?)`)
            return false // As long as maxSpend doesn't change, we will never purchase another upgrade
        }
        // If specified, only buy upgrades that will pay for themselves in {payoffTimeSeconds}.
        const hashDollarValue = this.haveHacknetServers ? 2.5e5 : 1 // Dollar value of one hash-per-second (0.25m dollars per production).
        let payoffTimeSeconds = 1 / (hashDollarValue * (shouldBuyNewNode ? newNodePayoff : bestUpgradePayoff))
        if (shouldBuyNewNode) cost = newNodeCost

        // Prepare info about the next uprade. Whether we end up purchasing or not, we will display this info.
        let strPurchase = (shouldBuyNewNode
                ? `a new node "hacknet-node-${this.ns.hacknet.numNodes()}"`
                : `hacknet-node-${nodeToUpgrade} ${bestUpgrade.name} ${upgradedValue}`)
            + ` for ${this.ns.nFormat(cost, '$0.00a')}`
        let strPayoff = `production ${((shouldBuyNewNode ? newNodePayoff : bestUpgradePayoff) * cost).toPrecision(3)} payoff time ${this.ns.nFormat(payoffTimeSeconds, '00:00:00')}`
        if (settings.hacknetMaxSpend && cost > settings.hacknetMaxSpend) {
            this.ns.tprint(`The next best purchase would be ${strPurchase} but the cost ${this.ns.nFormat(cost, '$0.00a')} exceeds the limit (${this.ns.nFormat(settings.hacknetMaxSpend, '$0.00a')})`)
            return false // As long as maxSpend doesn't change, we will never purchase another upgrade
        }
        if (settings.hacknetMaxPayoffTime && payoffTimeSeconds > settings.hacknetMaxPayoffTime) {
            this.ns.tprint(`The next best purchase would be ${strPurchase} but the ${strPayoff} is worse than the limit (${this.ns.nFormat(settings.hacknetMaxPayoffTime, '00:00:00')})`)
            return false // As long as maxPayoffTime doesn't change, we will never purchase another upgrade
        }
        let success = shouldBuyNewNode ? this.ns.hacknet.purchaseNode() !== -1 : bestUpgrade.upgrade(nodeToUpgrade, 1)
        this.ns.tprint(success ? `Purchased ${strPurchase} with ${strPayoff}` : `Insufficient funds to purchase the next best upgrade: ${strPurchase}`)
        return success ? cost : 0
    }

    /**
     * Loads the player information.
     *
     * @returns {Promise<*[]>}
     */
    async loadPlayer() {
        this.player = await this.runner.nsProxy['getPlayer']()
    }

    /**
     * Loads the upgrades
     *
     * @returns {Promise<*[]>}
     */
    async loadUpgrades() {
        this.haveHacknetServers = this.ns.hacknet.hashCapacity() > 0
        const minCacheLevel = [...Array(this.ns.hacknet.numNodes()).keys()]
            .reduce((min, i) => Math.min(min, this.ns.hacknet.getNodeStats(i).cache), Number.MAX_VALUE)
        this.upgrades = [
            {
                name: "none",
                cost: 0,
            },
            {
                name: "level",
                upgrade: this.ns.hacknet.upgradeLevel,
                cost: i => this.ns.hacknet.getLevelUpgradeCost(i, 1),
                nextValue: nodeStats => nodeStats.level + 1,
                addedProduction: nodeStats => nodeStats.production * ((nodeStats.level + 1) / nodeStats.level - 1),
            },
            {
                name: "ram",
                upgrade: this.ns.hacknet.upgradeRam,
                cost: i => this.ns.hacknet.getRamUpgradeCost(i, 1),
                nextValue: nodeStats => nodeStats.ram * 2,
                addedProduction: nodeStats => nodeStats.production * 0.07,
            },
            {
                name: "cores",
                upgrade: this.ns.hacknet.upgradeCore,
                cost: i => this.ns.hacknet.getCoreUpgradeCost(i, 1),
                nextValue: nodeStats => nodeStats.cores + 1,
                addedProduction: nodeStats => nodeStats.production * ((nodeStats.cores + 5) / (nodeStats.cores + 4) - 1),
            },
            {
                name: "cache",
                upgrade: this.ns.hacknet.upgradeCache,
                cost: i => this.ns.hacknet.getCacheUpgradeCost(i, 1),
                nextValue: nodeStats => nodeStats.cache + 1,
                // Note: Does not actually give production, but it has "worth" to us so we can buy more things,
                addedProduction: nodeStats => nodeStats.cache > minCacheLevel || !this.haveHacknetServers ? 0 : nodeStats.production * 0.01 / nodeStats.cache
            },
        ]
    }

    /**
     * Help text
     *
     * Player boss is stuck, let's get them some help.
     *
     * @returns {string}
     */
    getHelp() {
        return [
            '',
            '',
            'Manages and upgrades the hacknet servers.',
            '',
            `USAGE: run ${this.ns.getScriptName()}`,
            '',
            'Example:',
            `> run ${this.ns.getScriptName()}`,
            '',
            '',
        ].join("\n")
    }

}