import {Runner} from "./lib/Runner.js"
import {settings} from "./_settings.js"

/**
 * Command options
 */
const argsSchema = [
    ['loop', false],
    ['proxy', false], // run the NS methods through the proxy
    ['spawn', ''], // name of a script to spawn after this
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

    // load runner
    // default is not running anything in background, or it won't run in under 8gb...
    const runner = new Runner(ns)
    let nsProxy = runner.nsProxy
    let hacknetProxy = runner.hacknetProxy
    if (!args['proxy']) {
        nsProxy = ns
        hacknetProxy = ns.hacknet
    }
    // load job module
    const upgradeHacknet = new UpgradeHacknet(ns, nsProxy, hacknetProxy)
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
    // spawn another task before we exit
    if (args['spawn']) {
        const runAfter = args['spawn'].split(' ');
        const script = runAfter.shift()
        ns.tprint(`starting ${script} with args ${JSON.stringify(runAfter)}`)
        ns.run(script, 1, ...runAfter); // use run instead of spawn, we already have run loaded, saves 2GB
    }
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
     * The BitBurner proxy instance
     * @type {NS}
     */
    nsProxy

    /**
     * The Hacknet proxy instance
     * @type {Hacknet}
     */
    hacknetProxy

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
     * @param {NS} nsProxy - the nsProxy object
     * @param {Hacknet} hacknetProxy - the hacknetProxy object
     * @param {Object} config - key/value pairs used to set object properties
     */
    constructor(ns, nsProxy, hacknetProxy, config = {}) {
        this.ns = ns
        this.nsProxy = nsProxy
        this.hacknetProxy = hacknetProxy
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

        // TODO: Change this all to use https://bitburner.readthedocs.io/en/latest/netscript/formulasapi/hacknetServers/hashGainRate.html

        // Find the best upgrade we can make to an existing node
        let formulas = true
        let nodeToUpgrade = -1
        let bestUpgrade
        let bestUpgradePayoff = 0 // Hashes per second per dollar spent. Bigger is better.
        let cost = 0
        let upgradedValue = 0
        let worstNodeProduction = Number.MAX_VALUE // Used to how productive a newly purchased node might be
        let numNodes = await this.hacknetProxy['numNodes']();
        for (let i = 0; i < numNodes; i++) {
            let nodeStats = await this.hacknetProxy['getNodeStats'](i)
            if (formulas && this.haveHacknetServers) { // When a hacknet server runs scripts, nodeStats.production lags behind what it should be for current ram usage. Get the "raw" rate
                try {
                    nodeStats.production = this.ns.formulas.hacknetServers.hashGainRate(nodeStats.level, 0, nodeStats.ram, nodeStats.cores, this.player.hacknet_node_money_mult)
                } catch {
                    formulas = false
                }
            }
            worstNodeProduction = Math.min(worstNodeProduction, nodeStats.production)

            for (const upgrade of this.upgrades) {
                let currentUpgradeCost = upgrade.costMethod ? await this.hacknetProxy[upgrade.costMethod](i, 1) : 0
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
        let newNodeCost = await this.hacknetProxy['getPurchaseNodeCost']()
        let newNodePayoff = await this.hacknetProxy['numNodes']() === await this.hacknetProxy['maxNumNodes']() ? 0 : worstNodeProduction / newNodeCost
        let shouldBuyNewNode = newNodePayoff > bestUpgradePayoff
        if (newNodePayoff === 0 && bestUpgradePayoff === 0) {
            this.ns.print(`All upgrades have no value (is hashNet income disabled in this BN?)`)
            return false // As long as maxSpend doesn't change, we will never purchase another upgrade
        }
        // If specified, only buy upgrades that will pay for themselves in {payoffTimeSeconds}.
        const hashDollarValue = this.haveHacknetServers ? 2.5e5 : 1 // Dollar value of one hash-per-second (0.25m dollars per production).
        let payoffTimeSeconds = 1 / (hashDollarValue * (shouldBuyNewNode ? newNodePayoff : bestUpgradePayoff))
        if (shouldBuyNewNode) cost = newNodeCost

        // Prepare info about the next upgrade. Whether we end up purchasing or not, we will display this info.
        let strPurchase = (shouldBuyNewNode
                ? `a new node "hacknet-node-${await this.hacknetProxy['numNodes']()}"`
                : `hacknet-node-${nodeToUpgrade} ${bestUpgrade.name} ${upgradedValue}`)
            + ` for ${this.ns.nFormat(cost, '$0.00a')}`
        let strPayoff = `production ${((shouldBuyNewNode ? newNodePayoff : bestUpgradePayoff) * cost).toPrecision(3)} payoff time ${this.ns.nFormat(payoffTimeSeconds, '00:00:00')}`
        if (settings.hacknetMaxSpend && cost > settings.hacknetMaxSpend) {
            this.ns.print(`The next best purchase would be ${strPurchase} but the cost ${this.ns.nFormat(cost, '$0.00a')} exceeds the limit (${this.ns.nFormat(settings.hacknetMaxSpend, '$0.00a')})`)
            return false // As long as maxSpend doesn't change, we will never purchase another upgrade
        }
        if (settings.hacknetMaxPayoffTime && payoffTimeSeconds > settings.hacknetMaxPayoffTime) {
            this.ns.print(`The next best purchase would be ${strPurchase} but the ${strPayoff} is worse than the limit (${this.ns.nFormat(settings.hacknetMaxPayoffTime, '00:00:00')})`)
            return false // As long as maxPayoffTime doesn't change, we will never purchase another upgrade
        }
        let success = shouldBuyNewNode
            ? await this.hacknetProxy['purchaseNode']() !== -1
            : await bestUpgrade.upgrade(nodeToUpgrade, 1)
        if (!success) {
            this.ns.print(`Insufficient funds to purchase the next best upgrade: ${strPurchase}`)
            return 0
        }
        this.ns.tprint(`Purchased ${strPurchase} with ${strPayoff}`)
        return cost
    }

    /**
     * Loads the player information.
     *
     * @returns {Promise<*[]>}
     */
    async loadPlayer() {
        this.player = await this.nsProxy['getPlayer']()
    }

    /**
     * Loads the upgrades
     *
     * @returns {Promise<*[]>}
     */
    async loadUpgrades() {
        this.haveHacknetServers = await this.hacknetProxy['hashCapacity']() > 0
        // Get the lowest cache level, we do not consider upgrading the cache level of servers above this until all have the same cache level
        let nodeStats = []
        for (let i = 0; i < await this.hacknetProxy['numNodes'](); i++) {
            nodeStats.push(await this.hacknetProxy['getNodeStats'](i))
        }
        const minCacheLevel = Math.max.apply(Math, nodeStats.map(n => n.cache))
        this.upgrades = [
            {
                name: "none",
                costMethod: null,
            },
            {
                name: "level",
                upgrade: await this.hacknetProxy['upgradeLevel'],
                costMethod: 'getLevelUpgradeCost',
                nextValue: nodeStats => nodeStats.level + 1,
                addedProduction: nodeStats => nodeStats.production * ((nodeStats.level + 1) / nodeStats.level - 1),
            },
            {
                name: "ram",
                upgrade: await this.hacknetProxy['upgradeRam'],
                costMethod: 'getRamUpgradeCost',
                nextValue: nodeStats => nodeStats.ram * 2,
                addedProduction: nodeStats => nodeStats.production * 0.07,
            },
            {
                name: "cores",
                upgrade: await this.hacknetProxy['upgradeCore'],
                costMethod: 'getCoreUpgradeCost',
                nextValue: nodeStats => nodeStats.cores + 1,
                addedProduction: nodeStats => nodeStats.production * ((nodeStats.cores + 5) / (nodeStats.cores + 4) - 1),
            },
            {
                name: "cache",
                upgrade: await this.hacknetProxy['upgradeCache'],
                costMethod: 'getCacheUpgradeCost',
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