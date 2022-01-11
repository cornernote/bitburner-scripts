import {Runner} from "./lib/Runner.js"
import {settings} from "./_settings.js"

/**
 * Command options
 */
const argsSchema = [
    ['loop', false],
    ['proxy', true], // run the NS methods through the proxy
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
    const runner = new Runner(ns)
    let nsProxy = runner.nsProxy
    if (!args['proxy']) {
        nsProxy = ns
    }
    // load job module
    const hostManager = new HostManager(ns, nsProxy)
    // print help
    if (args.help) {
        ns.tprint(hostManager.getHelp())
        ns.exit()
    }
    // get ready
    do {
        // work, sleep, repeat
        await hostManager.doJob()
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
 * HostManager
 *
 * Manages and upgrades your servers.
 */
export class HostManager {

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
     * The time we last ran
     * @type {Number}
     */
    lastRun

    /**
     * Construct the class
     *
     * @param {NS} ns - the NS instance passed into the scripts main() entry method
     * @param {NS} nsProxy - the nsProxy object
     * @param {Object} config - key/value pairs used to set object properties
     */
    constructor(ns, nsProxy, config = {}) {
        this.ns = ns
        this.nsProxy = nsProxy
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
        if (this.lastRun + settings.intervals['host-manager'] > new Date().getTime()) {
            return
        }
        // run
        //this.ns.tprint('HostManager...')
        await this.hostManager()
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
    async hostManager() {
        const ns = this.ns

        // The purpose of the host manager is to buy the best servers it can
        // until it thinks RAM is underutilized enough that you don't need to anymore.

        // the max server ram you can buy (it's a petabyte) as an exponent (power of 2)
        let maxPurchasableServerRamExponent = 20
        // the max number of servers you can have in your farm
        let maxPurchasedServers = 25
        // Don't attempt to buy any new servers if we're under this utilization
        let utilizationTarget = 0.5
        // Keep at least this much money on hand (so we arent blocked from buying necessary things)
        let reservedMoneyPercent = 0.99 // Don't spend more than 1% of our money on temporary RAM
        let minRamExponent = 10
        // The name to give all purchased servers. Also used to determine which servers were purchased
        const purchasedServerName = settings.purchasedServerPrefix
        // Frequency of update
        const interval = 10000

        let _ns = this.ns
        let keepRunning = false
        let options
        let bitnodeMults


        // Logging system to only print a log if it is different from the last log printed.
        let lastStatus = ""

        function setStatus(log) {
            return log !== lastStatus ? _ns.print(lastStatus = log) : false
        }

        // Log and print to the terminal when something important happens
        function announce(log, toastStyle = 'info') {
            _ns.print(log)
            _ns.tprint(log)
            _ns.toast(log, toastStyle)
        }

        function formatMoney(num, maxSignificantFigures = 6, maxDecimalPlaces = 3) {
            return ns.nFormat(num, '$0.0a')
        }

        function formatRam(num) {
            return ns.nFormat(num, '0.0a') + ' GB' // ??
        }


        /**
         * Attempts to buy a server at or better than your home machine. **/
        async function tryToBuyBestServerPossible() {
            // Scan the set of all servers on the network that we own (or rooted) to get a sense of RAM utilization
            let rootedServers = []
            let ignoredServers = []
            let hostsToScan = ["home"]
            let utilizationTotal = 0
            let totalMaxRam = 0
            let infLoopProtection = 1000
            while (hostsToScan.length > 0 && infLoopProtection-- > 0) {
                let hostName = hostsToScan.pop()
                if (rootedServers.includes(hostName) || ignoredServers.includes(hostName))
                    continue
                ns.scan(hostName).forEach(connectedHost => hostsToScan.push(connectedHost))

                let serverMaxRam = ns.getServerMaxRam(hostName)
                // Don't count unrooted or useless servers
                if (ns.getServerMaxRam(hostName) <= 0 || ns.hasRootAccess(hostName) === false) {
                    ignoredServers.push(hostName)
                    continue
                }
                rootedServers.push(hostName)
                totalMaxRam += serverMaxRam
                utilizationTotal += ns.getServerUsedRam(hostName)
            }
            if (infLoopProtection <= 0)
                return announce('host-manager.js Infinite Loop Detected!', 'error')

            // Gether up the list of servers that were previously purchased.
            // Note: You can request the official list of purchased servers (cost 2.25 GB RAM), but we have that commented out here.
            //let purchasedServers = ns.getPurchasedServers()
            // If you're willing to remember to always name manually purchased severs "daemon", then this should work
            //let purchasedServers = ns.getPurchasedServers()
            let purchasedServers = rootedServers.filter(hostName => hostName.startsWith(purchasedServerName)).sort()

            // analyze the utilization rates
            let utilizationRate = utilizationTotal / totalMaxRam
            setStatus(`Using ${Math.round(utilizationTotal).toLocaleString()}/${formatRam(totalMaxRam)} (` +
                `${(utilizationRate * 100).toFixed(1)}%) across ${rootedServers.length} servers (${purchasedServers.length} bought)`)

            // Stop if utilization is below target. We probably don't need another server.
            if (utilizationRate < utilizationTarget)
                return

            // Check for other reasons not to go ahead with the purchase
            let prefix = 'Host-manager wants to buy another server, but '

            let budget = _ns.getServerMoneyAvailable("home")

            // Reserve at least enough money to buy the final hack tool, if we do not already have it (once we do, remember and stop checking)
            if (!ns.fileExists("SQLInject.exe", "home")) {
                prefix += '(reserving an extra 250M for SQLInject) '
                budget = Math.max(0, budget - 250000000)
            }
            // Additional reservations
            if (budget === 0)
                return setStatus(prefix + 'all cash is currently reserved.')

            // Determine the most ram we can buy with this money
            let exponentLevel = 1
            for (; exponentLevel < maxPurchasableServerRamExponent; exponentLevel++)
                if (ns.getPurchasedServerCost(Math.pow(2, exponentLevel + 1)) > budget)
                    break

            let maxRamPossibleToBuy = Math.pow(2, exponentLevel)

            // Abort if it would put us below our reserve (shouldn't happen, since we calculated how much to buy based on reserve amount)
            let cost = ns.getPurchasedServerCost(maxRamPossibleToBuy)
            if (budget < cost)
                return setStatus(prefix + 'budget (' + formatMoney(budget) + ') is less than the cost (' + formatMoney(cost) + ')')

            if (exponentLevel < minRamExponent)
                return setStatus(`${prefix}The highest ram exponent we can afford (2^${exponentLevel} for ${formatMoney(cost)}) on our budget of ${formatMoney(budget)} ` +
                    `is less than the minimum ram exponent (2^${minRamExponent} for ${formatMoney(ns.getPurchasedServerCost(Math.pow(2, minRamExponent)))})'`)

            // Under some conditions, we consider the new server "not worthwhile". but only if it isn't the biggest possible server we can buy
            if (exponentLevel < maxPurchasableServerRamExponent) {
                // Abort if our home server is more than 2x bettter (rough guage of how much we 'need' Daemon RAM at the current stage of the game?)
                // Unless we're looking at buying the maximum purchasable server size - in which case we can do no better
                if (maxRamPossibleToBuy < ns.getServerMaxRam("home") / 4)
                    return setStatus(prefix + 'the most RAM we can buy (' + formatRam(maxRamPossibleToBuy) + ') is way less than (<0.25*) home RAM ' + formatRam(ns.getServerMaxRam("home")))
                // Abort if purchasing this server wouldn't improve our total RAM by more than 10% (ensures we buy in meaningful increments)
                if (maxRamPossibleToBuy / totalMaxRam < 0.1)
                    return setStatus(prefix + 'the most RAM we can buy (' + formatRam(maxRamPossibleToBuy) + ') is less than 10% of total available RAM ' + formatRam(totalMaxRam) + ')')
            }

            let maxPurchasableServerRam = Math.pow(2, maxPurchasableServerRamExponent)
            let worstServerName = null
            let worstServerRam = maxPurchasableServerRam
            let bestServerName = null
            let bestServerRam = 0
            for (const server of purchasedServers) {
                let ram = ns.getServerMaxRam(server)
                if (ram < worstServerRam) {
                    worstServerName = server
                    worstServerRam = ram
                }
                if (ram >= bestServerRam) {
                    bestServerName = server
                    bestServerRam = ram
                }
            }

            // Abort if our worst previously-purchased server is better than the one we're looking to buy (ensures we buy in sane increments of capacity)
            if (worstServerName != null && maxRamPossibleToBuy < worstServerRam)
                return setStatus(prefix + 'the most RAM we can buy (' + formatRam(maxRamPossibleToBuy) +
                    ') is less than our worst purchased server ' + worstServerName + '\'s RAM ' + formatRam(worstServerRam))
            // Only buy new servers as good as or better than our best bought server (anything less is considered a regression in value)
            if (bestServerRam != null && maxRamPossibleToBuy < bestServerRam)
                return setStatus(prefix + 'the most RAM we can buy (' + formatRam(maxRamPossibleToBuy) +
                    ') is less than our previously purchased server ' + bestServerName + " RAM " + formatRam(bestServerRam))

            // if we're at capacity, check to see if we can do better better than the current worst purchased server. If so, delete it to make room.
            if (purchasedServers.length >= maxPurchasedServers) {
                if (worstServerRam === maxPurchasableServerRam) {
                    keepRunning = false
                    return announce('All purchaseable servers are maxed.')
                }

                // It's only worth deleting our old server if the new server will be 16x bigger or more (or if it's the biggest we can buy)
                if (exponentLevel === maxPurchasableServerRamExponent || worstServerRam * 16 <= maxRamPossibleToBuy) {
                    ns.run("remove-worst-server.js")
                    return setStatus(`hostmanager.js requested to delete server ${worstServerName} (${formatRam(worstServerRam)} RAM) ` +
                        `to make room for a new ${formatRam(maxRamPossibleToBuy)} Server.`)
                } else {
                    return setStatus(`${prefix}the most RAM we can buy (${formatRam(maxRamPossibleToBuy)}) is less than 16x the RAM ` +
                        `of the server it must delete to make room: ${worstServerName} (${formatRam(worstServerRam)} RAM)`)
                }
            }

            let purchasedServer = ns.purchaseServer(purchasedServerName, maxRamPossibleToBuy)
            if (!purchasedServer)
                setStatus(prefix + `Could not purchase a server with ${formatRam(maxRamPossibleToBuy)} RAM for ${formatMoney(cost)} ` +
                    `with a budget of ${formatMoney(budget)}. This is either a bug, or we in a SF.9`)
            else
                announce('Purchased a new server ' + purchasedServer + ' with ' + formatRam(maxRamPossibleToBuy) + ' RAM for ' + formatMoney(cost), 'success')

        }


        // main ...
        ns.disableLog('ALL')
        // bitnodeMults = (await this.nsProxy['getBitNodeMultipliers']()) ?? {PurchasedServerMaxRam: 1, PurchasedServerLimit: 1} // cant run until SF ... TODO ...
        bitnodeMults = {PurchasedServerMaxRam: 1, PurchasedServerLimit: 1}
        maxPurchasableServerRamExponent = Math.round(20 + Math.log2(bitnodeMults.PurchasedServerMaxRam))
        maxPurchasedServers = Math.round(25 * bitnodeMults.PurchasedServerLimit)

        options = ns.flags(argsSchema)
        utilizationTarget = options['utilization-trigger']
        minRamExponent = options['min-ram-exponent']

        await tryToBuyBestServerPossible()


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
            'Manages and upgrades your servers.',
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