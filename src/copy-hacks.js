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
    const copyHacks = new CopyHacks(ns, nsProxy)
    // print help
    if (args.help) {
        ns.tprint(copyHacks.getHelp())
        ns.exit()
    }
    // get ready
    do {
        // work, sleep, repeat
        await copyHacks.doJob()
        await ns.sleep(10)
    } while (args.loop)
}

// fake method to count towards memory usage, used by nsProxy
function countedTowardsMemory(ns) {
    ns.run()
    ns.isRunning(0)
    // comment below here if using nsProxy
    ns.brutessh()
    ns.ftpcrack()
    ns.relaysmtp()
    ns.httpworm()
    ns.sqlinject()
    ns.nuke()
    ns.scp()
    ns.getPlayer()
    ns.fileExists()
    ns.scan()
    ns.getServer()
}

/**
 * CopyHacks
 *
 * Copies hack script to all hacking servers.
 */
export class CopyHacks {

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
     * List of hacks that are used to attack servers
     * @type {Object}
     */
    hacks = {
        weaken: {
            script: '/hacks/weaken.js',
        },
        grow: {
            script: '/hacks/grow.js',
        },
        hack: {
            script: '/hacks/hack.js',
        },
    }

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
        if (this.lastRun + settings.intervals['root-servers'] > new Date().getTime()) {
            return
        }
        // run
        this.ns.tprint('CopyHacks...')
        await this.copyHacks()
        // set the last run time
        this.lastRun = new Date().getTime()
    }


    /**
     * Copies hack script to all hacking servers.
     *
     * @returns {Promise<void>}
     */
    async copyHacks() {
        // refresh data
        await this.loadPlayer()
        await this.loadServers()

        // get servers used for hacking
        const hackingServers = this.servers
            // exclude hacknet-
            .filter(s => !s.hostname.includes('hacknet-'))
            // include servers with root access
            .filter(s => s.hasAdminRights)

        // copy hack scripts (needed for purchased servers, ideally do this somewhere else, maybe RootServers?)
        for (const server of hackingServers) {
            await this.nsProxy['scp'](Object.values(this.hacks).map(h => h.script), server.hostname)
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
        // run until the spider array is empty
        for (let i = 0; i < spider.length; i++) {
            const hostname = spider[i]
            // for all the connected hosts
            for (const scannedHostName of await this.nsProxy['scan'](hostname)) {
                // if they are not in the list
                if (this.servers.filter(s => s.hostname === scannedHostName).length === 0) {
                    // add them to the spider list
                    spider.push(scannedHostName)
                }
            }
            // get the server info
            const server = await this.nsProxy['getServer'](hostname)
            // add this server to the list
            this.servers.push(server)
        }

    }

    /**
     * Help text
     *
     * Player boss is stuck, let's get them some help.
     *
     * @returns {string}
     */
    getHelp() {
        const script = this.ns.getScriptName()
        return [
            '',
            '',
            'Copies hack script to all hacking servers.',
            '',
            `USAGE: run ${script}`,
            '',
            'Example:',
            `> run ${script}`,
            '',
            '',
        ].join("\n")
    }

}
