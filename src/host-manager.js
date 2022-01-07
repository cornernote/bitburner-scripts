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
        let reservedMoneyAmount = 0 //250000000 // Enable if needed (Can also use reserve.txt)
        let reservedMoneyPercent = 0.99 // Don't spend more than 1% of our money on temporary RAM
        let minRamExponent = 10
        // The name to give all purchased servers. Also used to determine which servers were purchased
        const purchasedServerName = "daemon"
        // Frequency of update
        const interval = 10000

        let _ns = null
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


        /** Helper to log a message, and optionally also tprint it and toast it
         * @param {NS} ns - The nestcript instance passed to your script's main entry point */
        function log(ns, message = "", alsoPrintToTerminal = false, toastStyle = "", maxToastLength = 100) {
            ns.print(message)
            if (alsoPrintToTerminal) ns.tprint(message)
            if (toastStyle) ns.toast(message.length <= maxToastLength ? message : message.substring(0, maxToastLength - 3) + "...", toastStyle)
            return message
        }

        /** Generate a hashCode for a string that is pretty unique most of the time */
        function hashCode(s) {
            return s.split("").reduce(function (a, b) {
                a = ((a << 5) - a) + b.charCodeAt(0)
                return a & a
            }, 0)
        }

        /**
         * Retrieve the result of an ns command by executing it in a temporary .js script, writing the result to a file, then shuting it down
         * Importing incurs a maximum of 1.1 GB RAM (0 GB for ns.read, 1 GB for ns.run, 0.1 GB for ns.isRunning).
         * Has the capacity to retry if there is a failure (e.g. due to lack of RAM available). Not recommended for performance-critical code.
         * @param {NS} ns - The nestcript instance passed to your script's main entry point
         * @param {string} command - The ns command that should be invoked to get the desired data (e.g. "ns.getServer('home')" )
         * @param {string=} fName - (default "/Temp/{commandhash}-data.txt") The name of the file to which data will be written to disk by a temporary process
         * @param {bool=} verbose - (default false) If set to true, pid and result of command are logged.
         **/
        async function getNsDataThroughFile(ns, command, fName, verbose = false, maxRetries = 5, retryDelayMs = 50) {
            return await getNsDataThroughFile_Custom(ns, ns.run, ns.isRunning, command, fName, verbose, maxRetries, retryDelayMs)
        }

        /** @param {NS} ns
         * getActiveSourceFiles Helper that allows the user to pass in their chosen implementation of getNsDataThroughFile to minimize RAM usage **/
        async function getActiveSourceFiles_Custom(ns, fnGetNsDataThroughFile) {
            let tempFile = '/Temp/owned-source-files.txt'
            // Find out what source files the user has unlocked
            let dictSourceFiles = await fnGetNsDataThroughFile(ns, `Object.fromEntries(ns.getOwnedSourceFiles().map(sf => [sf.n, sf.lvl]))`, tempFile)
            if (!dictSourceFiles) { // Bit of a hack, but if RAM is so low that this fails, we can fallback to using an older version of this file, and even assuming we have no source files.
                dictSourceFiles = ns.read(tempFile)
                dictSourceFiles = dictSourceFiles ? JSON.parse(dictSourceFiles) : {}
            }
            // If the user is currently in a given bitnode, they will have its features unlocked
            dictSourceFiles[(await fnGetNsDataThroughFile(ns, 'ns.getPlayer()', '/Temp/player-info.txt')).bitNodeN] = 3
            return dictSourceFiles
        }

        /**
         * An advanced version of waitForProcessToComplete that lets you pass your own "isAlive" test to reduce RAM requirements (e.g. to avoid referencing ns.isRunning)
         * Importing incurs 0 GB RAM (assuming fnIsAlive is implemented using another ns function you already reference elsewhere like ns.ps)
         * @param {NS} ns - The nestcript instance passed to your script's main entry point
         * @param {function} fnIsAlive - A single-argument function used to start the new sript, e.g. `ns.isRunning` or `pid => ns.ps("home").some(process => process.pid === pid)`
         **/
        async function waitForProcessToComplete_Custom(ns, fnIsAlive, pid, verbose) {
            // Wait for the PID to stop running (cheaper than e.g. deleting (rm) a possibly pre-existing file and waiting for it to be recreated)
            for (var retries = 0; retries < 1000; retries++) {
                if (!fnIsAlive(pid)) break // Script is done running
                if (verbose && retries % 100 === 0) ns.print(`Waiting for pid ${pid} to complete... (${retries})`)
                await ns.sleep(10)
            }
            // Make sure that the process has shut down and we haven't just stopped retrying
            if (fnIsAlive(pid)) {
                let errorMessage = `run-command pid ${pid} is running much longer than expected. Max retries exceeded.`
                ns.print(errorMessage)
                throw errorMessage
            }
        }

        /** @param {NS} ns
         * Return bitnode multiplers, or null if they cannot be accessed. **/
        async function tryGetBitNodeMultipliers(ns) {
            return await tryGetBitNodeMultipliers_Custom(ns, getNsDataThroughFile)
        }

        /** @param {NS} ns
         * tryGetBitNodeMultipliers Helper that allows the user to pass in their chosen implementation of getNsDataThroughFile to minimize RAM usage **/
        async function tryGetBitNodeMultipliers_Custom(ns, fnGetNsDataThroughFile) {
            let canGetBitNodeMultipliers = false
            try {
                canGetBitNodeMultipliers = 5 in (await getActiveSourceFiles_Custom(ns, fnGetNsDataThroughFile))
            } catch {
            }
            if (!canGetBitNodeMultipliers) return null
            try {
                return await fnGetNsDataThroughFile(ns, 'ns.getBitNodeMultipliers()', '/Temp/bitnode-multipliers.txt')
            } catch {
            }
            return null
        }

        /**
         * An advanced version of getNsDataThroughFile that lets you pass your own "fnRun" and "fnIsAlive" implementations to reduce RAM requirements
         * Importing incurs no RAM (now that ns.read is free) plus whatever fnRun / fnIsAlive you provide it
         * Has the capacity to retry if there is a failure (e.g. due to lack of RAM available). Not recommended for performance-critical code.
         * @param {NS} ns - The nestcript instance passed to your script's main entry point
         * @param {function} fnRun - A single-argument function used to start the new sript, e.g. `ns.run` or `(f,...args) => ns.exec(f, "home", ...args)`
         * @param {function} fnIsAlive - A single-argument function used to start the new sript, e.g. `ns.isRunning` or `pid => ns.ps("home").some(process => process.pid === pid)`
         **/
        async function getNsDataThroughFile_Custom(ns, fnRun, fnIsAlive, command, fName, verbose = false, maxRetries = 5, retryDelayMs = 50) {
            const commandHash = hashCode(command)
            fName = fName || `/Temp/${commandHash}-data.txt`
            const fNameCommand = (fName || `/Temp/${commandHash}-command`) + '.js'
            // Prepare a command that will write out a new file containing the results of the command
            // unless it already exists with the same contents (saves time/ram to check first)
            // If an error occurs, it will write an empty file to avoid old results being misread.
            const commandToFile = `let result = "" try { result = JSON.stringify(${command}) } catch { }
        if (ns.read("${fName}") != result) await ns.write("${fName}", result, 'w')`
            // Run the command with auto-retries if it fails
            const pid = await runCommand_Custom(ns, fnRun, commandToFile, fNameCommand, false, maxRetries, retryDelayMs)
            // Wait for the process to complete
            await waitForProcessToComplete_Custom(ns, fnIsAlive, pid, verbose)
            if (verbose) ns.print(`Process ${pid} is done. Reading the contents of ${fName}...`)
            // Read the file, with auto-retries if it fails
            const fileData = await autoRetry(ns, () => ns.read(fName), f => f !== undefined && f !== "",
                () => `ns.read('${fName}') somehow returned undefined or an empty string`,
                maxRetries, retryDelayMs, undefined, verbose)
            if (verbose) ns.print(`Read the following data for command ${command}:\n${fileData}`)
            return JSON.parse(fileData) // Deserialize it back into an object/array and return
        }

        /**
         * An advanced version of runCommand that lets you pass your own "isAlive" test to reduce RAM requirements (e.g. to avoid referencing ns.isRunning)
         * Importing incurs 0 GB RAM (assuming fnRun, fnWrite are implemented using another ns function you already reference elsewhere like ns.exec)
         * @param {NS} ns - The nestcript instance passed to your script's main entry point
         * @param {function} fnRun - A single-argument function used to start the new sript, e.g. `ns.run` or `(f,...args) => ns.exec(f, "home", ...args)`
         **/
        async function runCommand_Custom(ns, fnRun, command, fileName, verbose = false, maxRetries = 5, retryDelayMs = 50, ...args) {
            let script = `import { formatMoney, formatNumberShort, formatDuration, parseShortNumber, scanAllServers } fr` + `om "helpers.js"\n` +
                `export async function main(ns) { try { ` +
                (verbose ? `let output = ${command} ns.tprint(output)` : command) +
                ` } catch(err) { ns.tprint(String(err)) throw(err) } }`
            fileName = fileName || `/Temp/${hashCode(command)}-command.js`
            // To improve performance and save on garbage collection, we can skip writing this exact same script was previously written (common for repeatedly-queried data)
            if (ns.read(fileName) != script) await ns.write(fileName, script, "w")
            return await autoRetry(ns, () => fnRun(fileName, ...args), temp_pid => temp_pid !== 0,
                () => `Run command returned no pid. Destination: ${fileName} Command: ${command}\nEnsure you have sufficient free RAM to run this temporary script.`,
                maxRetries, retryDelayMs, undefined, verbose)
        }

        /** Helper to retry something that failed temporarily (can happen when e.g. we temporarily don't have enough RAM to run)
         * @param {NS} ns - The nestcript instance passed to your script's main entry point */
        async function autoRetry(ns, fnFunctionThatMayFail, fnSuccessCondition, errorContext = "Success condition not met",
                                 maxRetries = 5, initialRetryDelayMs = 50, backoffRate = 3, verbose = false) {
            let retryDelayMs = initialRetryDelayMs
            while (maxRetries-- > 0) {
                try {
                    const result = await fnFunctionThatMayFail()
                    if (!fnSuccessCondition(result)) throw typeof errorContext === 'string' ? errorContext : errorContext()
                    return result
                } catch (error) {
                    const fatal = maxRetries === 0
                    const errorLog = `${fatal ? 'FAIL' : 'WARN'}: (${maxRetries} retries remaining): ${String(error)}`
                    log(ns, errorLog, fatal, !verbose ? undefined : (fatal ? 'error' : 'warning'))
                    if (fatal) throw error
                    await ns.sleep(retryDelayMs)
                    retryDelayMs *= backoffRate
                }
            }
        }

        /**
         * Return a formatted representation of the monetary amount using scale sympols (e.g. $6.50M)
         * @param {number} num - The number to format
         * @param {number=} maxSignificantFigures - (default: 6) The maximum significant figures you wish to see (e.g. 123, 12.3 and 1.23 all have 3 significant figures)
         * @param {number=} maxDecimalPlaces - (default: 3) The maximum decimal places you wish to see, regardless of significant figures. (e.g. 12.3, 1.2, 0.1 all have 1 decimal)
         **/
        function formatMoney(num, maxSignificantFigures = 6, maxDecimalPlaces = 3) {
            let numberShort = formatNumberShort(num, maxSignificantFigures, maxDecimalPlaces)
            return num >= 0 ? "$" + numberShort : numberShort.replace("-", "-$")
        }

        const symbols = ["", "k", "m", "b", "t", "q", "Q", "s", "S", "o", "n", "e33", "e36", "e39"]

        /**
         * Return a formatted representation of the monetary amount using scale sympols (e.g. 6.50M)
         * @param {number} num - The number to format
         * @param {number=} maxSignificantFigures - (default: 6) The maximum significant figures you wish to see (e.g. 123, 12.3 and 1.23 all have 3 significant figures)
         * @param {number=} maxDecimalPlaces - (default: 3) The maximum decimal places you wish to see, regardless of significant figures. (e.g. 12.3, 1.2, 0.1 all have 1 decimal)
         **/
        function formatNumberShort(num, maxSignificantFigures = 6, maxDecimalPlaces = 3) {
            for (var i = 0, sign = Math.sign(num), num = Math.abs(num); num >= 1000 && i < symbols.length; i++) num /= 1000
            // TODO: A number like 9.999 once rounted to show 3 sig figs, will become 10.00, which is now 4 sig figs.
            return ((sign < 0) ? "-" : "") + num.toFixed(Math.max(0, Math.min(maxDecimalPlaces, maxSignificantFigures - Math.floor(1 + Math.log10(num))))) + symbols[i]
        }

        /** Formats some RAM amount as a round number of GB with thousands separators e.g. `1,028 GB` */
        function formatRam(num) {
            return `${Math.round(num).toLocaleString()} GB`
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

            const reserve = Number.parseFloat(ns.read('reserve.txt'))
            let currentMoney = _ns.getServerMoneyAvailable("home")
            let spendableMoney = currentMoney - reserve
            // Reserve at least enough money to buy the final hack tool, if we do not already have it (once we do, remember and stop checking)
            if (!ns.fileExists("SQLInject.exe", "home")) {
                prefix += '(reserving an extra 250M for SQLInject) '
                spendableMoney = Math.max(0, spendableMoney - 250000000)
            }
            // Additional reservations
            spendableMoney = Math.max(0, Math.min(spendableMoney * (1 - reservedMoneyPercent), spendableMoney - reservedMoneyAmount))
            if (spendableMoney === 0)
                return setStatus(prefix + 'all cash is currently reserved.')

            // Determine the most ram we can buy with this money
            let exponentLevel = 1
            for (; exponentLevel < maxPurchasableServerRamExponent; exponentLevel++)
                if (ns.getPurchasedServerCost(Math.pow(2, exponentLevel + 1)) > spendableMoney)
                    break

            let maxRamPossibleToBuy = Math.pow(2, exponentLevel)

            // Abort if it would put us below our reserve (shouldn't happen, since we calculated how much to buy based on reserve amount)
            let cost = ns.getPurchasedServerCost(maxRamPossibleToBuy)
            if (spendableMoney < cost)
                return setStatus(prefix + 'spendableMoney (' + formatMoney(spendableMoney) + ') is less than the cost (' + formatMoney(cost) + ')')

            if (exponentLevel < minRamExponent)
                return setStatus(`${prefix}The highest ram exponent we can afford (2^${exponentLevel} for ${formatMoney(cost)}) on our budget of ${formatMoney(spendableMoney)} ` +
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
                    `with a budget of ${formatMoney(spendableMoney)}. This is either a bug, or we in a SF.9`)
            else
                announce('Purchased a new server ' + purchasedServer + ' with ' + formatRam(maxRamPossibleToBuy) + ' RAM for ' + formatMoney(cost), 'success')

        }


        // main ...
        ns.disableLog('ALL')
        bitnodeMults = (await tryGetBitNodeMultipliers(ns)) ?? {PurchasedServerMaxRam: 1, PurchasedServerLimit: 1}
        maxPurchasableServerRamExponent = Math.round(20 + Math.log2(bitnodeMults.PurchasedServerMaxRam))
        maxPurchasedServers = Math.round(25 * bitnodeMults.PurchasedServerLimit)

        options = ns.flags(argsSchema)
        reservedMoneyAmount = options['absolute-reserve']
        reservedMoneyPercent = options['reserve-percent']
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
