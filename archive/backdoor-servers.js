import {Runner} from "./lib/Runner.js"
import {settings} from "./_settings.js"

/**
 * Command options
 */
const argsSchema = [
    ['loop', false],
    ['proxy', false],
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
    let nsProxy = runner.nsProxy
    if (!args['proxy']) {
        nsProxy = ns
    }
    // load job module
    const backdoorServers = new BackdoorServers(ns, nsProxy)
    // print help
    if (args.help) {
        ns.tprint(backdoorServers.getHelp())
        ns.exit()
    }
    // get ready
    do {
        // work, sleep, repeat
        await backdoorServers.doJob()
        await ns.sleep(10)
    } while (args.loop)
}

// fake method to count towards memory usage, used by nsProxy
function countedTowardsMemory(ns) {
    // comment if using nsProxy
    ns.getPlayer()
    ns.scan()
    ns.getServer()
}

/**
 * BackdoorServers
 *
 * Installs backdoor on any available servers.
 */
export class BackdoorServers {

    /**
     * The BitBurner instance
     * @type {NS}
     */
    ns

    /**
     * The nsProxy instance
     * @type {NS}
     */
    nsProxy

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
        if (this.lastRun + settings.intervals['backdoor-servers'] > new Date().getTime()) {
            return
        }
        // run
        this.ns.tprint('BackdoorServers...')
        await this.backdoorServers()
        // set the last run time
        this.lastRun = new Date().getTime()
    }


    /**
     * Installs backdoor on any available servers.
     *
     * @returns {Promise<void>}
     */
    async backdoorServers() {
        // refresh data
        await this.loadPlayer()
        await this.loadServers()
        // get backdoorable servers
        const backdoorableServers = this.servers
            // include servers with root access and no backdoor
            .filter(s => s.hasAdminRights && !s.backdoorInstalled)
            // exclude owned servers
            .filter(s => !s.hostname.includes('home') && !s.hostname.includes('hacknet') && !s.hostname.includes(settings.purchasedServerPrefix))
        // run backdoor on backdoorable servers
        for (const server of backdoorableServers) {
            // run backdoor
            server.route.shift() // remove home
            for (const path of server.route) {
                await this.terminalCommand(`connect ${path}`)
            }
            await this.terminalCommand('analyze')
            await this.terminalCommand('backdoor')
            await this.terminalCommand('home')
        }
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
     * Loads a list of servers in the network.
     *
     * @returns {Promise<*[]>}
     */
    async loadServers() {
        // get servers in network
        this.servers = []
        const spider = ['home']
        const routes = {home: ["home"]}
        // run until the spider array is empty
        for (let i = 0; i < spider.length; i++) {
            const hostname = spider[i]
            // for all the connected hosts
            for (const scannedHostName of await this.nsProxy['scan'](hostname)) {
                // if they are not in the list
                if (this.servers.filter(s => s.hostname === scannedHostName).length === 0) {
                    // add them to the spider list
                    spider.push(scannedHostName)
                    // record the route
                    routes[scannedHostName] = routes[hostname].slice()
                    routes[scannedHostName].push(scannedHostName)
                }
            }
            // get the server info
            const server = await this.nsProxy['getServer'](hostname)
            server.route = routes[hostname]
            // add this server to the list
            this.servers.push(server)
        }
    }


    /**
     * Hacky way to run a terminal command
     *
     * @param message
     * @param delay
     * @returns {Promise<void>}
     */
    async terminalCommand(message, delay = 100) {
        const docs = globalThis['document']
        const terminalInput = /** @type {HTMLInputElement} */ (docs.getElementById("terminal-input"))
        while (!terminalInput) {
            await this.ns.sleep(delay)
        }
        terminalInput.value = message
        const handler = Object.keys(terminalInput)[1]
        terminalInput[handler].onChange({target: terminalInput})
        terminalInput[handler].onKeyDown({keyCode: 13, preventDefault: () => null})
        while (terminalInput.disabled) {
            await this.ns.sleep(delay)
        }
    }

    /**
     * Format RAM as string
     *
     * @param gb
     * @returns {string}
     */
    formatRam(gb) {
        return this.ns.nFormat(gb * 1000 * 1000 * 1000, '0.0b')
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
            'Installs backdoor on any available servers.',
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
